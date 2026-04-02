const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
const fs = require('fs');
const { delay } = require('@whiskeysockets/baileys');
const sessionManager = require('../services/sessionManager');
const { writeEntry } = require('../services/auditService');
const { redis } = require('../config');

const connection = new IORedis(redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Delay aleatorio entre min y max ms para evitar patrones detectables
function randomDelay(min = 3000, max = 6000) {
  return delay(Math.floor(Math.random() * (max - min + 1)) + min);
}

// Actualiza la concurrencia según sesiones activas
function updateConcurrency() {
  const ready = [...sessionManager.sessions.values()]
    .filter(s => s.isReady && s.status === 'ready').length;
  const newConcurrency = Math.max(1, ready);
  if (worker && worker.concurrency !== newConcurrency) {
    worker.concurrency = newConcurrency;
    console.log(`[Worker] Concurrencia actualizada → ${newConcurrency} slot(s)`);
  }
}

const worker = new Worker(
  'whatsapp-messages',
  async (job) => {
    const { groupId, text, imagePath, documentPath } = job.data;

    // Round-robin: elige la siguiente sesión disponible
    const session = sessionManager.getNextAvailableSession();
    if (!session || !session.sock) {
      throw new Error('No hay sesiones WhatsApp disponibles. El job se reintentará.');
    }

    const { sock, sessionId } = session;
    job.data._sessionId = sessionId;
    console.log(`[Worker] Job ${job.id} → sesión "${sessionId}"`);

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

    return { success: true, sessionId, jobId: job.id };
  },
  { connection, concurrency: 1 }
);

// Escuchar eventos de sesiones para ajustar concurrencia automáticamente
sessionManager.on('session:ready',        updateConcurrency);
sessionManager.on('session:failed',       updateConcurrency);
sessionManager.on('session:disconnected', updateConcurrency);
sessionManager.on('session:removed',      updateConcurrency);

worker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completado → sesión "${result.sessionId}"`);
  connection.incr('wa:stats:completed').catch(() => {});

  const type = job.data.imagePath ? 'image' : job.data.documentPath ? 'document' : 'text';
  writeEntry({
    jobId:     job.id,
    status:    'completed',
    sessionId: result.sessionId,
    groupId:   job.data.groupId,
    type,
    text:      job.data.text      || null,
    imagePath: job.data.imagePath || null,
    docPath:   job.data.documentPath || null,
    ip:        job.data._ip || 'desconocida',
    duration:  job.finishedOn - job.processedOn,
  });
});

worker.on('failed', (job, err) => {
  const sessionId = job?.data?._sessionId || 'desconocida';
  const groupId   = job?.data?.groupId    || '?';
  const intento   = `${job?.attemptsMade}/${job?.opts?.attempts}`;
  const msg       = err.message || '';

  // Solo registrar como fallido definitivo en el último intento
  if (job?.attemptsMade >= (job?.opts?.attempts || 1)) {
    connection.incr('wa:stats:failed').catch(() => {});
    const type = job.data?.imagePath ? 'image' : job.data?.documentPath ? 'document' : 'text';
    writeEntry({
      jobId:     job?.id,
      status:    'failed',
      sessionId: job?.data?._sessionId    || 'desconocida',
      groupId:   job?.data?.groupId       || 'desconocido',
      type,
      text:      job?.data?.text          || null,
      imagePath: job?.data?.imagePath     || null,
      docPath:   job?.data?.documentPath  || null,
      ip:        job?.data?._ip           || 'desconocida',
      error:     err.message,
      attempts:  job?.attemptsMade,
    });
  }

  const esMembresia =
    msg.includes('not-authorized') ||
    msg.includes('forbidden')      ||
    msg.includes('not a participant') ||
    msg.includes('403');

  const esRateLimit = msg.includes('rate-overlimit') || msg.includes('rate_overlimit');

  if (esRateLimit) {
    sessionManager.emit('job:warn', {
      sessionId,
      groupId,
      message: `Job ${job?.id} — rate limit de WhatsApp (intento ${intento}), reintentando con espera...`,
    });
  } else if (esMembresia) {
    sessionManager.emit('job:warn', {
      sessionId,
      groupId,
      message: `Sesión "${sessionId}" no es miembro del grupo ${groupId} — agrégala al grupo`,
    });
  } else {
    sessionManager.emit('job:warn', {
      sessionId,
      groupId,
      message: `Job ${job?.id} falló (intento ${intento}): ${msg}`,
    });
  }

  console.error(`[Worker] Job ${job?.id} falló (intento ${intento}): ${msg}`);
});

console.log('[Worker] MessageWorker iniciado ✓');
module.exports = worker;
