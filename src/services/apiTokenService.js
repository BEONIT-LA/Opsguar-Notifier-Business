/**
 * apiTokenService.js
 * Tokens de API por tenant para integraciones externas.
 *
 * Formato del token: "ogt_<40 hex>". Solo se muestra en claro al crearse;
 * en la BD se guarda el SHA-256 del token completo + un prefijo visible
 * ("ogt_xxxxxx") para identificarlo en la UI.
 */

const crypto = require('crypto');
const db     = require('../config/database');

const TOKEN_PREFIX = 'ogt_';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Genera un token nuevo en claro (no se persiste tal cual). */
function generateRawToken() {
  return TOKEN_PREFIX + crypto.randomBytes(20).toString('hex'); // ogt_ + 40 hex
}

/**
 * Crea un token para un tenant. Devuelve el registro + el token EN CLARO
 * (única vez que estará disponible).
 */
async function createToken(tenantId, name) {
  const raw    = generateRawToken();
  const hash   = sha256(raw);
  const prefix = raw.slice(0, 10); // "ogt_" + 6 hex

  const { rows } = await db.query(
    `INSERT INTO tenant_api_tokens (tenant_id, name, token_hash, prefix)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, prefix, created_at`,
    [tenantId, (name || 'token').trim(), hash, prefix]
  );
  return { ...rows[0], token: raw };
}

/** Lista los tokens (sin el secreto) de un tenant. */
async function listTokens(tenantId) {
  const { rows } = await db.query(
    `SELECT id, name, prefix, last_used_at, revoked_at, created_at
       FROM tenant_api_tokens
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows;
}

/** Revoca (marca revoked_at) un token del tenant. */
async function revokeToken(tenantId, tokenId) {
  const { rows } = await db.query(
    `UPDATE tenant_api_tokens
        SET revoked_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
      RETURNING id`,
    [tokenId, tenantId]
  );
  return rows[0] || null;
}

/**
 * Verifica un token en claro. Devuelve { tenantId } si es válido y no está
 * revocado; null si no existe o está revocado. Actualiza last_used_at.
 */
async function verifyToken(raw) {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;
  const hash = sha256(raw);
  const { rows } = await db.query(
    `UPDATE tenant_api_tokens
        SET last_used_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING tenant_id`,
    [hash]
  );
  if (!rows[0]) return null;
  return { tenantId: rows[0].tenant_id };
}

module.exports = {
  TOKEN_PREFIX,
  generateRawToken,
  createToken,
  listTokens,
  revokeToken,
  verifyToken,
};
