const db = require('../config/database');

/**
 * Servicio de auditoría — PostgreSQL.
 * Reemplaza el sistema de archivos NDJSON anterior.
 *
 * Ventajas vs archivos:
 * - Filtros y paginación reales con SQL
 * - Índices → búsquedas rápidas aunque haya millones de registros
 * - No hay límite de registros en memoria
 */

/**
 * Guarda un registro de auditoría en la DB.
 * Se llama desde messageWorker al completar o fallar un job.
 */
async function writeEntry(entry) {
  try {
    await db.query(
      `INSERT INTO audit_logs
         (job_id, status, session_id, group_id, type, text, image_path, doc_path, ip, duration, attempt, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        entry.jobId      || null,
        entry.status,
        entry.sessionId  || null,
        entry.groupId    || null,
        entry.type       || null,
        entry.text       ? entry.text.slice(0, 500) : null,
        entry.imagePath  || null,
        entry.docPath    || null,
        entry.ip         || null,
        entry.duration   || null,
        entry.attempt    || 1,
        entry.error      || null,
      ]
    );
  } catch (err) {
    console.error('[Audit] Error al guardar registro:', err.message);
  }
}

/**
 * Lee registros con filtros y paginación real.
 */
async function readEntries({ date, session, status, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params     = [];

  if (date) {
    params.push(date);
    conditions.push(`DATE(created_at AT TIME ZONE 'UTC') = $${params.length}`);
  }
  if (session) {
    params.push(session);
    conditions.push(`session_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) AS total FROM audit_logs ${where}`, params
  );

  params.push(limit, offset);
  const dataResult = await db.query(
    `SELECT id, job_id, status, session_id, group_id,
            type, text, ip, duration, attempt, error, created_at
     FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    rows:  dataResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
}

/**
 * Fechas distintas con registros (para el selector del frontend).
 */
async function listDates() {
  const result = await db.query(
    `SELECT DISTINCT DATE(created_at AT TIME ZONE 'UTC')::text AS date
     FROM audit_logs ORDER BY date DESC LIMIT 90`
  );
  return result.rows.map(r => r.date);
}

/**
 * Stats globales de auditoría.
 */
async function getStats() {
  const result = await db.query(
    `SELECT
       COUNT(*)                                        AS total,
       COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
       COUNT(*) FILTER (WHERE status = 'failed')      AS failed
     FROM audit_logs`
  );
  return result.rows[0];
}

module.exports = { writeEntry, readEntries, listDates, getStats };
