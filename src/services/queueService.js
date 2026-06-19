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

// Cuántos jobs en la lista pertenecen al tenant. Se limita la inspección para
// no recorrer colas enormes; suficiente para las métricas de la UI.
const SCAN_LIMIT = 1000;
function countForTenant(jobs, tenantId) {
  return jobs.filter(j => String(j?.data?.tenantId) === String(tenantId)).length;
}

/**
 * Estadísticas de cola SCOPEADAS por tenant.
 * - waiting/active/delayed: jobs en vuelo de ESE tenant (cola global compartida)
 * - ready: sesiones listas del tenant
 * - completed/failed: histórico del tenant desde audit_logs
 */
async function getQueueStats(tenantId, sessionManager) {
  const auditService = require('./auditService');

  const [waitingJobs, activeJobs, delayedJobs, stats] = await Promise.all([
    messageQueue.getWaiting(0, SCAN_LIMIT),
    messageQueue.getActive(0, SCAN_LIMIT),
    messageQueue.getDelayed(0, SCAN_LIMIT),
    auditService.getStats(tenantId).catch(() => ({ completed: 0, failed: 0 })),
  ]);

  const ready = sessionManager
    ? Object.values(sessionManager.getAllSessions(tenantId)).filter(s => s.isReady).length
    : 0;

  const completed = parseInt(stats.completed || 0, 10);
  const failed    = parseInt(stats.failed    || 0, 10);

  return {
    waiting:  countForTenant(waitingJobs, tenantId),
    active:   countForTenant(activeJobs, tenantId),
    delayed:  countForTenant(delayedJobs, tenantId),
    ready,
    completed,
    failed,
    totalCompleted: completed,
    totalFailed:    failed,
  };
}

module.exports = { messageQueue, enqueueMessage, getQueueStats };
