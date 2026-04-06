const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { redis } = require('../config');

const connection = new IORedis(redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('connect', () => console.log('[Redis] Conectado ✓'));
connection.on('error', (err) => console.error('[Redis] Error:', err.message));

const messageQueue = new Queue('whatsapp-messages', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 15000 },
    removeOnComplete: 1000,
    removeOnFail: 500,
  },
});

async function enqueueMessage(data) {
  const job = await messageQueue.add('send', data);
  return job.id;
}

async function getQueueStats(sessionManager) {
  const [waiting, active, completed, failed, delayed, totalCompleted, totalFailed] = await Promise.all([
    messageQueue.getWaitingCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
    messageQueue.getDelayedCount(),
    connection.get('wa:stats:completed'),
    connection.get('wa:stats:failed'),
  ]);

  // Sesiones listas en este momento (no cuántos jobs activos hay en BullMQ)
  const ready = sessionManager
    ? [...sessionManager.sessions.values()].filter(s => s.isReady && s.status === 'ready').length
    : 0;

  return {
    waiting,
    active,
    ready,      // sesiones disponibles — reemplaza "procesando" en la UI
    completed,
    failed,
    delayed,
    totalCompleted: parseInt(totalCompleted || '0', 10),
    totalFailed:    parseInt(totalFailed    || '0', 10),
  };
}

module.exports = { messageQueue, enqueueMessage, getQueueStats };
