/**
 * tenantContext.js
 * Guards de autorización que se apoyan en el contexto dejado por
 * authMiddleware (req.auth / req.role / req.tenantId).
 */

const tenantService = require('../services/tenantService');

/** Solo superadmin de plataforma. */
function requireSuperadmin(req, res, next) {
  if (req.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Requiere rol superadmin' });
  }
  next();
}

/** Rechaza autenticación por token de API (operaciones solo de panel/JWT). */
function requireJwt(req, res, next) {
  if (req.auth?.type !== 'jwt') {
    return res.status(403).json({ success: false, message: 'Esta operación requiere sesión de panel (no token de API)' });
  }
  next();
}

/**
 * Exige que el request esté ligado a un tenant y que ese tenant esté operativo
 * (activo y dentro de su vigencia). Deja el tenant en req.tenant.
 * El superadmin sin tenant pasa de largo (no opera sobre un workspace).
 */
async function requireActiveTenant(req, res, next) {
  if (req.role === 'superadmin' && !req.tenantId) {
    return res.status(403).json({
      success: false,
      message: 'El superadmin no tiene workspace de tenant. Usa /api/admin.',
    });
  }
  if (!req.tenantId) {
    return res.status(403).json({ success: false, message: 'Sin tenant asignado' });
  }

  try {
    const { ok, reason, tenant } = await tenantService.checkOperational(req.tenantId);
    if (!ok) {
      const map = {
        tenant_not_found: [404, 'Tenant no encontrado'],
        suspended:        [403, 'La empresa está suspendida'],
        not_started:      [403, 'La vigencia de la empresa aún no comienza'],
        expired:          [403, 'La vigencia de la empresa ha expirado'],
      };
      const [code, msg] = map[reason] || [403, 'Tenant no operativo'];
      return res.status(code).json({ success: false, message: msg, reason });
    }
    req.tenant = tenant;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error validando el tenant' });
  }
}

module.exports = { requireSuperadmin, requireJwt, requireActiveTenant };
