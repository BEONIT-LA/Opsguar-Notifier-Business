const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
const fs = require('fs');
const { delay } = require('@whiskeysockets/baileys');
const sessionManager = require('../services/sessionManager');
const { redis } = require('../config');

const connection = new IORedis(redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

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
      await delay(800);
    }

    if (imagePath && fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      if (buffer.length > 0) {
        await sock.sendMessage(groupId, {
          image: buffer,
          fileName: path.basename(imagePath),
        });
        await delay(800);
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
  { connection, concurrency: 5 }
);

worker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completado → sesión "${result.sessionId}"`);
});

worker.on('failed', (job, err) => {
  const sessionId = job?.data?._sessionId || 'desconocida';
  const groupId   = job?.data?.groupId    || '?';
  const intento   = `${job?.attemptsMade}/${job?.opts?.attempts}`;
  const msg       = err.message || '';

  const esMembresia =
    msg.includes('not-authorized') ||
    msg.includes('forbidden')      ||
    msg.includes('not a participant') ||
    msg.includes('403');

  if (esMembresia) {
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
