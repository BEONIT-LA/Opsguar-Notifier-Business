/**
 * poolService.js
 * CRUD para la tabla group_pools + caché en memoria.
 *
 * Caché (Map en memoria, TTL 30s):
 *   - El worker consulta el pool por cada job, pero gracias al caché
 *     la DB solo se toca una vez cada 30 segundos por groupId.
 *   - Cuando se crea, edita o elimina un pool, el caché se invalida
 *     de inmediato → el próximo job ve el cambio sin esperar.
 */

const db = require('../config/database');

// ── Caché en memoria ──────────────────────────────────────────
const CACHE_TTL = 30_000;                   // 30 segundos
const cache     = new Map();                // groupId → { pool, expiresAt }

function cacheGet(groupId) {
  const entry = cache.get(groupId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(groupId); return undefined; }
  return entry.pool;
}

function cacheSet(groupId, pool) {
  cache.set(groupId, { pool, expiresAt: Date.now() + CACHE_TTL });
}

function cacheInvalidate(groupId) {
  if (groupId) cache.delete(groupId);
  else         cache.clear();              // sin groupId → limpia todo
}

// ─────────────────────────────────────────────────────────────

/** Devuelve todos los pools ordenados por nombre */
async function listPools() {
  const { rows } = await db.query('SELECT * FROM group_pools ORDER BY name ASC');
  return rows;
}

/**
 * Busca el pool de un groupId.
 * Primera llamada → DB. Llamadas siguientes (< 30s) → caché.
 * Modificar/eliminar el pool invalida el caché al instante.
 */
async function getPoolByGroupId(groupId) {
  const cached = cacheGet(groupId);
  if (cached !== undefined) return cached;   // null también es válido (sin pool)

  const { rows } = await db.query(
    'SELECT * FROM group_pools WHERE group_id = $1', [groupId]
  );
  const pool = rows[0] || null;
  cacheSet(groupId, pool);
  return pool;
}

/** Crea un nuevo pool e invalida el caché del groupId */
async function createPool({ name, groupId, sessionIds = [] }) {
  const { rows } = await db.query(
    `INSERT INTO group_pools (name, group_id, session_ids)
     VALUES ($1, $2, $3) RETURNING *`,
    [name.trim(), groupId.trim(), sessionIds]
  );
  cacheInvalidate(groupId.trim());
  return rows[0];
}

/** Actualiza el pool e invalida el caché del groupId anterior y nuevo */
async function updatePool(id, { name, groupId, sessionIds }) {
  // Primero obtenemos el groupId anterior para invalidar ese caché también
  const prev = await db.query('SELECT group_id FROM group_pools WHERE id = $1', [id]);
  if (prev.rows[0]) cacheInvalidate(prev.rows[0].group_id);

  const { rows } = await db.query(
    `UPDATE group_pools
        SET name        = $1,
            group_id    = $2,
            session_ids = $3,
            updated_at  = NOW()
      WHERE id = $4
  RETURNING *`,
    [name.trim(), groupId.trim(), sessionIds, id]
  );
  cacheInvalidate(groupId.trim());
  return rows[0] || null;
}

/** Elimina el pool e invalida su caché */
async function deletePool(id) {
  const prev = await db.query('SELECT group_id FROM group_pools WHERE id = $1', [id]);
  if (prev.rows[0]) cacheInvalidate(prev.rows[0].group_id);
  await db.query('DELETE FROM group_pools WHERE id = $1', [id]);
}

/**
 * Fix 3 — Al eliminar una sesión del sistema, la remueve automáticamente
 * de todos los pools donde aparezca.
 * PostgreSQL array_remove() elimina todas las ocurrencias del valor en el array.
 */
async function removeSessionFromAllPools(sessionId) {
  await db.query(
    `UPDATE group_pools
        SET session_ids = array_remove(session_ids, $1),
            updated_at  = NOW()
      WHERE $1 = ANY(session_ids)`,
    [sessionId]
  );
  // Limpia todo el caché porque no sabemos qué pools fueron afectados
  cacheInvalidate();
  console.log(`[Pool] Sesión "${sessionId}" removida de todos los pools`);
}

module.exports = { listPools, getPoolByGroupId, createPool, updatePool, deletePool, removeSessionFromAllPools };
