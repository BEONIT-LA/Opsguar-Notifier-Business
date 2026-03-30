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
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

async function enqueueMessage(data) {
  const job = await messageQueue.add('send', data);
  return job.id;
}

async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    messageQueue.getWaitingCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
    messageQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

module.exports = { messageQueue, enqueueMessage, getQueueStats };
