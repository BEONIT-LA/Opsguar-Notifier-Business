const { Worker, UnrecoverableError } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
const fs = require('fs');
const { delay } = require('@whiskeysockets/baileys');
const sessionManager       = require('../services/sessionManager');
const { writeEntry }       = require('../services/auditService');
const { getPoolByGroupId } = require('../services/poolService');
const { redis } = require('../config');

const connection = new IORedis(redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ── Helpers ───────────────────────────────────────────────────

function randomDelay(min = 3000, max = 6000) {
  return delay(Math.floor(Math.random() * (max - min + 1)) + min);
}

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
async function waitForSession(sessionIds, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = sessionIds?.length
      ? sessionManager.getNextAvailableSessionFromPool(sessionIds)
      : sessionManager.getNextAvailableSession();

    if (session && session.sock) return session;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return null;
}

function updateConcurrency() {
  const ready = [...sessionManager.sessions.values()]
    .filter(s => s.isReady && s.status === 'ready').length;
  const newConcurrency = Math.max(1, ready);
  if (worker && worker.concurrency !== newConcurrency) {
    worker.concurrency = newConcurrency;
    console.log(`[Worker] Concurrencia actualizada → ${newConcurrency} slot(s)`);
  }
}

// ── Función de envío ──────────────────────────────────────────

async function enviarMensajes(sock, groupId, { text, imagePath, documentPath }) {
  if (text && text.trim()) {
    await sock.sendMessage(groupId, { text: text.trim() });
    await randomDelay(3000, 6000);
  }

  if (imagePath && fs.existsSync(imagePath)) {
    const buffer = fs.readFileSync(imagePath);
    if (buffer.length > 0) {
      await sock.sendMessage(groupId, {
        image: buffer,
        fileName: path.basename(imagePath),
      });
      await randomDelay(3000, 6000);
    }
  }

  if (documentPath && fs.existsSync(documentPath)) {
    const buffer = fs.readFileSync(documentPath);
    if (buffer.length > 0) {
      await sock.sendMessage(groupId, {
        document: buffer,
        fileName: path.basename(documentPath),
        mimetype: 'application/pdf',
      });
    }
  }
}

// ── Worker ────────────────────────────────────────────────────

const worker = new Worker(
  'whatsapp-messages',
  async (job) => {
    const { groupId, text, imagePath, documentPath } = job.data;

    // Consulta el pool en tiempo real — cambios al pool aplican de inmediato
    const pool = await getPoolByGroupId(groupId).catch(() => null);
    const poolSessionIds = pool?.session_ids?.length ? pool.session_ids : null;

    if (pool && !poolSessionIds) {
      console.log(`[Worker] Pool "${pool.name}" sin sesiones → usando round-robin global`);
    }

    // Sesiones del pool que ya fallaron con "no es miembro" para este job.
    // Cuando una sesión falla por membresía se agrega aquí y se omite
    // en el siguiente intento — así el job rota por el resto del pool.
    const triedSessions = new Set();

    while (true) {
      // Universo de sesiones a considerar:
      // - Con pool  → las sesiones del pool
      // - Sin pool  → todas las sesiones registradas en el sistema
      const universo = poolSessionIds
        || [...sessionManager.sessions.keys()];

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
      const session = await waitForSession(disponibles);

      if (!session) {
        const poolInfo = pool ? ` (pool "${pool.name}")` : '';
        throw new Error(`Timeout esperando sesión disponible${poolInfo} tras 10 minutos.`);
      }

      const { sock, sessionId } = session;
      job.data._sessionId = sessionId;

      sessionManager.acquireSession(sessionId);
      console.log(`[Worker] Job ${job.id} → sesión "${sessionId}" (adquirida)`);

      let noEsMiembro = false;

      try {
        await enviarMensajes(sock, groupId, { text, imagePath, documentPath });
      } catch (sendErr) {
        if (esMiembroError(sendErr.message)) {
          // Marca esta sesión como fallida para este job y rota a la siguiente
          noEsMiembro = true;
        } else {
          throw sendErr; // error real → BullMQ reintentará normalmente
        }
      } finally {
        sessionManager.releaseSession(sessionId);
        console.log(`[Worker] Job ${job.id} → sesión "${sessionId}" (liberada)`);
      }

      if (noEsMiembro) {
        triedSessions.add(sessionId);
        const universoActual = poolSessionIds || [...sessionManager.sessions.keys()];
        const restantes = universoActual.filter(id => !triedSessions.has(id)).length;
        console.warn(
          `[Worker] Job ${job.id} → "${sessionId}" no es miembro de ${groupId}. ` +
          `Rotando... (${restantes} sesión/es restantes en el pool)`
        );
        sessionManager.emit('job:warn', {
          sessionId,
          groupId,
          message: `Sesión "${sessionId}" no es miembro del grupo — rotando a otro número del pool (${restantes} restantes)`,
        });
        continue; // vuelve al inicio del while con las sesiones restantes
      }

      // Éxito ✅
      return { success: true, sessionId, jobId: job.id };
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
  console.log(`[Worker] Job ${job.id} completado → sesión "${result.sessionId}"`);
  connection.incr('wa:stats:completed').catch(() => {});
  sessionManager.emit('queue:update', {});

  const type = job.data.imagePath ? 'image' : job.data.documentPath ? 'document' : 'text';
  writeEntry({
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
  const sessionId = job?.data?._sessionId || 'desconocida';
  const groupId   = job?.data?.groupId    || '?';
  const intento   = `${job?.attemptsMade}/${job?.opts?.attempts}`;
  const msg       = err.message || '';

  const esIrrecuperable = err.name === 'UnrecoverableError';
  const esUltimoIntento = job?.attemptsMade >= (job?.opts?.attempts || 1);

  if (esIrrecuperable || esUltimoIntento) {
    connection.incr('wa:stats:failed').catch(() => {});
    sessionManager.emit('queue:update', {});
    const type = job.data?.imagePath ? 'image' : job.data?.documentPath ? 'document' : 'text';
    writeEntry({
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
      sessionId, groupId,
      message: `❌ Job ${job?.id} — ningún número del pool es miembro del grupo. Agrega los números al grupo.`,
    });
    console.error(`[Worker] Job ${job?.id} irrecuperable: ${msg}`);
  } else if (esRateLimit) {
    sessionManager.emit('job:warn', {
      sessionId, groupId,
      message: `Job ${job?.id} — rate limit de WhatsApp (intento ${intento}), reintentando...`,
    });
    console.warn(`[Worker] Job ${job?.id} rate limit (intento ${intento})`);
  } else {
    sessionManager.emit('job:warn', {
      sessionId, groupId,
      message: `Job ${job?.id} falló (intento ${intento}): ${msg}`,
    });
    console.error(`[Worker] Job ${job?.id} falló (intento ${intento}): ${msg}`);
  }
});

console.log('[Worker] MessageWorker iniciado ✓');
module.exports = worker;
