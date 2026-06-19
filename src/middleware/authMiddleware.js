const jwt = require('jsonwebtoken');
const { auth } = require('../config');
const { verifyToken, TOKEN_PREFIX } = require('../services/apiTokenService');

/**
 * Autenticación dual para /api/*:
 *
 *  1. Token de API ("Authorization: Bearer ogt_…")  → integraciones externas.
 *     Resuelve el tenant por el hash del token. Actúa con nivel de tenant
 *     (no puede tocar /api/admin ni gestionar tokens; eso requiere JWT).
 *
 *  2. JWT del panel ("Authorization: Bearer <jwt>") → usuarios logueados.
 *
 * En ambos casos deja un contexto normalizado en:
 *   req.auth = { type:'api'|'jwt', tenantId, role, userId?, username? }
 *   req.tenantId, req.role  (atajos)
 */
async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }

  // ── Token de API ────────────────────────────────────────────
  if (token.startsWith(TOKEN_PREFIX)) {
    try {
      const result = await verifyToken(token);
      if (!result) {
        return res.status(401).json({ success: false, message: 'Token de API inválido o revocado' });
      }
      req.auth     = { type: 'api', tenantId: result.tenantId, role: 'manager' };
      req.tenantId = result.tenantId;
      req.role     = 'manager';
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error validando token de API' });
    }
  }

  // ── JWT del panel ───────────────────────────────────────────
  try {
    const payload = jwt.verify(token, auth.jwtSecret);
    req.auth = {
      type:     'jwt',
      userId:   payload.userId,
      username: payload.user,
      role:     payload.role,
      tenantId: payload.tenantId ?? null,
    };
    req.user     = payload;            // compatibilidad con código existente
    req.tenantId = payload.tenantId ?? null;
    req.role     = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;
