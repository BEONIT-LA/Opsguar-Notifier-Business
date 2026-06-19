/**
 * waSessionService.js
 * Persistencia ligera de las sesiones de WhatsApp en la tabla wa_sessions.
 *
 * La fuente de verdad operativa sigue siendo el SessionManager (memoria) +
 * las carpetas auth_sessions/. Esta tabla existe para: contar sesiones por
 * tenant, mostrarlas en el panel del admin y conservar el último estado/numero
 * conocido. Por eso todas las operaciones son "best-effort" (no rompen el flujo
 * si fallan).
 */

const db = require('../config/database');

async function register(tenantId, sessionId, label = null) {
  await db.query(
    `INSERT INTO wa_sessions (tenant_id, session_id, label, status)
     VALUES ($1, $2, $3, 'connecting')
     ON CONFLICT (tenant_id, session_id)
     DO UPDATE SET label = COALESCE(EXCLUDED.label, wa_sessions.label), updated_at = NOW()`,
    [tenantId, sessionId, label]
  );
}

async function markStatus(tenantId, sessionId, status, phone = undefined) {
  if (phone !== undefined) {
    await db.query(
      `UPDATE wa_sessions SET status = $3, phone = $4, updated_at = NOW()
        WHERE tenant_id = $1 AND session_id = $2`,
      [tenantId, sessionId, status, phone]
    );
  } else {
    await db.query(
      `UPDATE wa_sessions SET status = $3, updated_at = NOW()
        WHERE tenant_id = $1 AND session_id = $2`,
      [tenantId, sessionId, status]
    );
  }
}

async function remove(tenantId, sessionId) {
  await db.query(
    'DELETE FROM wa_sessions WHERE tenant_id = $1 AND session_id = $2',
    [tenantId, sessionId]
  );
}

async function listByTenant(tenantId) {
  const { rows } = await db.query(
    'SELECT session_id, label, phone, status, created_at FROM wa_sessions WHERE tenant_id = $1 ORDER BY created_at ASC',
    [tenantId]
  );
  return rows;
}

module.exports = { register, markStatus, remove, listByTenant };
