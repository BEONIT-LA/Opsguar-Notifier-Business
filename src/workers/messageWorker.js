const { Worker, UnrecoverableError } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
const fs = require('fs');
const humanPacing = require('../services/humanPacing');
const sessionManager       = require('../services/sessionManager');
const { writeEntry }       = require('../services/auditService');
const { getPoolByGroupId } = require('../services/poolService');
const tenantService        = require('../services/tenantService');
const { redis } = require('../config');

const connection = new IORedis(redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ── Helpers ───────────────────────────────────────────────────

function esMiembroError(msg = '') {
  return (
    msg.includes('not-authorized')    ||
    msg.includes('forbidden')         ||
    msg.includes('not a participant') ||
    msg.includes('403')
  );
}

/**
 * Espera hasta que haya una sesión libre del conjunto indicado.
 * - sessionIds = array con IDs  → espera dentro del pool (excluyendo ya intentadas)
 * - sessionIds = null           → round-robin global
 * El job permanece "procesando" en BullMQ — no bota a "en espera".
 */
async function waitForSession(tenantId, sessionIds, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = sessionIds?.length
      ? sessionManager.getNextAvailableSessionFromPool(tenantId, sessionIds)
      : sessionManager.getNextAvailableSession(tenantId);

    if (session && session.sock) return session;
    // Sondeo con jitter: con sesiones en enfriamiento no toman turno en bloque
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.floor(Math.random() * 1500)));
  }
  return null;
}

function updateConcurrency() {
  const ready = sessionManager.countReadyGlobal();
  const newConcurrency = Math.max(1, ready);
  if (worker && worker.concurrency !== newConcurrency) {
    worker.concurrency = newConcurrency;
    console.log(`[Worker] Concurrencia actualizada → ${newConcurrency} slot(s)`);
  }
}

// ── Función de envío ──────────────────────────────────────────

function deleteTempFile(filePath) {
  if (filePath) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

function guessMimetype(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  const map = {
    '.pdf':  'application/pdf',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] || 'application/octet-stream';
}

async function enviarMensajes(sock, groupId, { text, imagePath, documentPath, imageOriginalName, documentOriginalName }) {
  const hasText     = !!(text && text.trim());
  const hasImage    = !!(imagePath && fs.existsSync(imagePath));
  const hasDocument = !!(documentPath && fs.existsSync(documentPath));

  // ── Caso: solo texto (sin archivos) ──────────────────────────
  if (hasText && !hasImage && !hasDocument) {
    await humanPacing.beforeSend(sock, groupId, text);
    await sock.sendMessage(groupId, { text: text.trim() });
    return; // el enfriamiento de la sesión lo aplica releaseSession
  }

  // ── Caso: imagen (con o sin texto como caption) ───────────────
  if (hasImage) {
    try {
      const buffer = fs.readFileSync(imagePath);
      if (buffer.length > 0) {
        const msg = { image: buffer };
        // Si hay texto y NO hay documento → el texto va como caption de la imagen
        // Si hay documento también → el texto irá como caption de la imagen igual,
        // así el documento queda libre sin repetir el texto
        if (hasText) msg.caption = text.trim();
        await humanPacing.beforeSend(sock, groupId, msg.caption);
        await sock.sendMessage(groupId, msg);
        if (hasDocument) await humanPacing.betweenMessages();
      }
    } finally {
      deleteTempFile(imagePath);
    }
  }

  // ── Caso: documento (con caption solo si no había imagen) ─────
  if (hasDocument) {
    try {
      const buffer = fs.readFileSync(documentPath);
      if (buffer.length > 0) {
        const msg = {
          document: buffer,
          fileName: documentOriginalName || path.basename(documentPath),
          mimetype: guessMimetype(documentOriginalName || documentPath),
        };
        // Si hay texto y NO hubo imagen → el texto va como caption del documento
        if (hasText && !hasImage) msg.caption = text.trim();
        await humanPacing.beforeSend(sock, groupId, msg.caption);
        await sock.sendMessage(groupId, msg);
      }
    } finally {
      deleteTempFile(documentPath);
    }
  }
}

// ── Worker ────────────────────────────────────────────────────

const worker = new Worker(
  'whatsapp-messages',
  async (job) => {
    const { tenantId, groupId, text, imagePath, documentPath,
            imageOriginalName, documentOriginalName } = job.data;

    if (!tenantId) {
      throw new UnrecoverableError('Job sin tenantId — no se puede enrutar.');
    }

    // Consulta el pool del tenant en tiempo real — cambios aplican de inmediato
    const pool = await getPoolByGroupId(tenantId, groupId).catch(() => null);
    const poolSessionIds = pool?.session_ids?.length ? pool.session_ids : null;

    if (pool && !poolSessionIds) {
      console.log(`[Worker] Pool "${pool.name}" sin sesiones → usando round-robin global`);
    }

    // Sesiones del pool que ya fallaron con "no es miembro" para este job.
    // Cuando una sesión falla por membresía se agrega aquí y se omite
    // en el siguiente intento — así el job rota por el resto del pool.
    const triedSessions = new Set();

    while (true) {
      // Universo de sesiones a considerar (siempre del tenant):
      // - Con pool  → las sesiones del pool
      // - Sin pool  → todas las sesiones registradas del tenant
      const universo = poolSessionIds
        || sessionManager.listSessionIds(tenantId);

      // Filtra las que ya fallaron con "no es miembro" en este job
      const disponibles = universo.filter(id => !triedSessions.has(id));

      // Si ya probamos todas → fallo definitivo, no hay más opciones
      if (disponibles.length === 0) {
        const contexto = pool
          ? `pool "${pool.name}"`
          : 'round-robin global';
        throw new UnrecoverableError(
          `Ningún número (${contexto}) es miembro del grupo ${groupId}. ` +
          `Probados: ${[...triedSessions].join(', ')}`
        );
      }

      // Espera turno con las sesiones disponibles (excluye las ya intentadas)
      const session = await waitForSession(tenantId, disponibles);

      if (!session) {
        const poolInfo = pool ? ` (pool "${pool.name}")` : '';
        throw new Error(`Timeout esperando sesión disponible${poolInfo} tras 10 minutos.`);
      }

      const { sock, sessionId } = session;
      job.data._sessionId = sessionId;

      sessionManager.acquireSession(tenantId, sessionId);
      console.log(`[Worker] Job ${job.id} (tenant ${tenantId}) → sesión "${sessionId}" (adquirida)`);

      let noEsMiembro = false;

      try {
        await enviarMensajes(sock, groupId, {
          text, imagePath, documentPath, imageOriginalName, documentOriginalName,
        });
      } catch (sendErr) {
        if (esMiembroError(sendErr.message)) {
          // Marca esta sesión como fallida para este job y rota a la siguiente
          noEsMiembro = true;
        } else {
          throw sendErr; // error real → BullMQ reintentará normalmente
        }
      } finally {
        // Enfriamiento "modo humano": el número no vuelve a enviar enseguida
        const cooldown = noEsMiembro ? 0 : humanPacing.cooldownMs();
        sessionManager.releaseSession(tenantId, sessionId, cooldown);
        console.log(`[Worker] Job ${job.id} → sesión "${sessionId}" (liberada, pausa ${Math.round(cooldown / 1000)}s)`);
      }

      if (noEsMiembro) {
        triedSessions.add(sessionId);
        const universoActual = poolSessionIds || sessionManager.listSessionIds(tenantId);
        const restantes = universoActual.filter(id => !triedSessions.has(id)).length;
        console.warn(
          `[Worker] Job ${job.id} → "${sessionId}" no es miembro de ${groupId}. ` +
          `Rotando... (${restantes} sesión/es restantes en el pool)`
        );
        sessionManager.emit('job:warn', {
          tenantId,
          sessionId,
          groupId,
          message: `Sesión "${sessionId}" no es miembro del grupo — rotando a otro número del pool (${restantes} restantes)`,
        });
        continue; // vuelve al inicio del while con las sesiones restantes
      }

      // Éxito ✅
      return { success: true, tenantId, sessionId, jobId: job.id };
    }
  },
  { connection, concurrency: 1 }
);

sessionManager.on('session:ready',        updateConcurrency);
sessionManager.on('session:failed',       updateConcurrency);
sessionManager.on('session:disconnected', updateConcurrency);
sessionManager.on('session:removed',      updateConcurrency);

// ── Eventos del worker ────────────────────────────────────────

worker.on('completed', (job, result) => {
  const tenantId = job.data.tenantId;
  console.log(`[Worker] Job ${job.id} (tenant ${tenantId}) completado → sesión "${result.sessionId}"`);
  connection.incr('wa:stats:completed').catch(() => {});

  // Consume 1 mensaje de la cuota del tenant (el mensaje se envió de verdad)
  if (tenantId) tenantService.incrementUsage(tenantId, 1).catch(() => {});

  sessionManager.emit('queue:update', { tenantId });

  const type = job.data.imagePath ? 'image' : job.data.documentPath ? 'document' : 'text';
  writeEntry({
    tenantId,
    jobId:     job.id,
    status:    'completed',
    sessionId: result.sessionId,
    groupId:   job.data.groupId,
    type,
    text:      job.data.text         || null,
    imagePath: job.data.imagePath    || null,
    docPath:   job.data.documentPath || null,
    ip:        job.data._ip          || 'desconocida',
    duration:  job.finishedOn - job.processedOn,
  });
});

worker.on('failed', (job, err) => {
  const tenantId  = job?.data?.tenantId || null;
  const sessionId = job?.data?._sessionId || 'desconocida';
  const groupId   = job?.data?.groupId    || '?';
  const intento   = `${job?.attemptsMade}/${job?.opts?.attempts}`;
  const msg       = err.message || '';

  const esIrrecuperable = err.name === 'UnrecoverableError';
  const esUltimoIntento = job?.attemptsMade >= (job?.opts?.attempts || 1);

  if (esIrrecuperable || esUltimoIntento) {
    connection.incr('wa:stats:failed').catch(() => {});
    sessionManager.emit('queue:update', { tenantId });
    const type = job.data?.imagePath ? 'image' : job.data?.documentPath ? 'document' : 'text';
    writeEntry({
      tenantId,
      jobId:     job?.id,
      status:    'failed',
      sessionId: job?.data?._sessionId || 'desconocida',
      groupId:   job?.data?.groupId    || 'desconocido',
      type,
      text:      job?.data?.text          || null,
      imagePath: job?.data?.imagePath     || null,
      docPath:   job?.data?.documentPath  || null,
      ip:        job?.data?._ip           || 'desconocida',
      error:     err.message,
      attempts:  job?.attemptsMade,
    });
  }

  const esRateLimit = msg.includes('rate-overlimit') || msg.includes('rate_overlimit');

  if (esIrrecuperable) {
    // Todos los números del pool fallaron — no quedan opciones
    sessionManager.emit('job:warn', {
      tenantId, sessionId, groupId,
      message: `❌ Job ${job?.id} — ningún número del pool es miembro del grupo. Agrega los números al grupo.`,
    });
    console.error(`[Worker] Job ${job?.id} irrecuperable: ${msg}`);
  } else if (esRateLimit) {
    sessionManager.emit('job:warn', {
      tenantId, sessionId, groupId,
      message: `Job ${job?.id} — rate limit de WhatsApp (intento ${intento}), reintentando...`,
    });
    console.warn(`[Worker] Job ${job?.id} rate limit (intento ${intento})`);
  } else {
    sessionManager.emit('job:warn', {
      tenantId, sessionId, groupId,
      message: `Job ${job?.id} falló (intento ${intento}): ${msg}`,
    });
    console.error(`[Worker] Job ${job?.id} falló (intento ${intento}): ${msg}`);
  }
});

console.log('[Worker] MessageWorker iniciado ✓');
module.exports = worker;
