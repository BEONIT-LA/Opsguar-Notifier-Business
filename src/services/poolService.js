/**
 * poolService.js
 * CRUD para la tabla group_pools (por tenant) + caché en memoria.
 *
 * Todo está scopeado por tenant: un pool pertenece a un tenant y la
 * unicidad de group_id es por (tenant_id, group_id). La clave de caché
 * incluye el tenant para no mezclar empresas.
 */

const db = require('../config/database');

// ── Caché en memoria ──────────────────────────────────────────
const CACHE_TTL = 30_000;                   // 30 segundos
const cache     = new Map();                // "tenantId::groupId" → { pool, expiresAt }

function cacheKey(tenantId, groupId) { return `${tenantId}::${groupId}`; }

function cacheGet(tenantId, groupId) {
  const entry = cache.get(cacheKey(tenantId, groupId));
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(cacheKey(tenantId, groupId)); return undefined; }
  return entry.pool;
}

function cacheSet(tenantId, groupId, pool) {
  cache.set(cacheKey(tenantId, groupId), { pool, expiresAt: Date.now() + CACHE_TTL });
}

function cacheInvalidate(tenantId, groupId) {
  if (groupId) cache.delete(cacheKey(tenantId, groupId));
  else         cache.clear();              // sin groupId → limpia todo
}

// ─────────────────────────────────────────────────────────────

/** Devuelve los pools del tenant ordenados por nombre */
async function listPools(tenantId) {
  const { rows } = await db.query(
    'SELECT * FROM group_pools WHERE tenant_id = $1 ORDER BY name ASC', [tenantId]
  );
  return rows;
}

/**
 * Busca el pool de un groupId dentro de un tenant.
 * Primera llamada → DB. Llamadas siguientes (< 30s) → caché.
 */
async function getPoolByGroupId(tenantId, groupId) {
  const cached = cacheGet(tenantId, groupId);
  if (cached !== undefined) return cached;   // null también es válido (sin pool)

  const { rows } = await db.query(
    'SELECT * FROM group_pools WHERE tenant_id = $1 AND group_id = $2', [tenantId, groupId]
  );
  const pool = rows[0] || null;
  cacheSet(tenantId, groupId, pool);
  return pool;
}

/** Crea un nuevo pool en el tenant e invalida el caché del groupId */
async function createPool(tenantId, { name, groupId, sessionIds = [] }) {
  const { rows } = await db.query(
    `INSERT INTO group_pools (tenant_id, name, group_id, session_ids)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, name.trim(), groupId.trim(), sessionIds]
  );
  cacheInvalidate(tenantId, groupId.trim());
  return rows[0];
}

/** Actualiza un pool del tenant e invalida el caché del groupId anterior y nuevo */
async function updatePool(tenantId, id, { name, groupId, sessionIds }) {
  const prev = await db.query(
    'SELECT group_id FROM group_pools WHERE id = $1 AND tenant_id = $2', [id, tenantId]
  );
  if (prev.rows[0]) cacheInvalidate(tenantId, prev.rows[0].group_id);

  const { rows } = await db.query(
    `UPDATE group_pools
        SET name        = $1,
            group_id    = $2,
            session_ids = $3,
            updated_at  = NOW()
      WHERE id = $4 AND tenant_id = $5
  RETURNING *`,
    [name.trim(), groupId.trim(), sessionIds, id, tenantId]
  );
  cacheInvalidate(tenantId, groupId.trim());
  return rows[0] || null;
}

/** Elimina un pool del tenant e invalida su caché */
async function deletePool(tenantId, id) {
  const prev = await db.query(
    'SELECT group_id FROM group_pools WHERE id = $1 AND tenant_id = $2', [id, tenantId]
  );
  if (prev.rows[0]) cacheInvalidate(tenantId, prev.rows[0].group_id);
  await db.query('DELETE FROM group_pools WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

/**
 * Al eliminar una sesión del sistema, la remueve de todos los pools del
 * tenant donde aparezca.
 */
async function removeSessionFromAllPools(tenantId, sessionId) {
  await db.query(
    `UPDATE group_pools
        SET session_ids = array_remove(session_ids, $2),
            updated_at  = NOW()
      WHERE tenant_id = $1 AND $2 = ANY(session_ids)`,
    [tenantId, sessionId]
  );
  cacheInvalidate(tenantId); // limpia el tenant entero (no sabemos qué pools cambiaron)
  console.log(`[Pool] Sesión "${sessionId}" removida de todos los pools del tenant ${tenantId}`);
}

module.exports = { listPools, getPoolByGroupId, createPool, updatePool, deletePool, removeSessionFromAllPools };
