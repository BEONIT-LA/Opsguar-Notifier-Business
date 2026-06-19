/**
 * meController.js
 * Endpoints del workspace del responsable (scope tenant):
 *   GET    /api/me              → datos del tenant + consumo/cuota
 *   GET    /api/tokens          → lista de tokens de API (sin secreto)
 *   POST   /api/tokens          → crea token (devuelve el secreto UNA vez)
 *   DELETE /api/tokens/:id       → revoca token
 *
 * La gestión de tokens requiere sesión de panel (JWT), no token de API.
 */

const tenantService   = require('../services/tenantService');
const apiTokenService = require('../services/apiTokenService');

async function me(req, res) {
  try {
    const tenant = req.tenant || await tenantService.getTenantById(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant no encontrado' });

    return res.json({
      success: true,
      data: {
        tenant: {
          id:   tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        usage: tenantService.usageSummary(tenant),
        auth:  { type: req.auth?.type, role: req.role, username: req.auth?.username || null },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listTokens(req, res) {
  try {
    const tokens = await apiTokenService.listTokens(req.tenantId);
    return res.json({ success: true, data: tokens });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createToken(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "'name' es requerido" });
    }
    const token = await apiTokenService.createToken(req.tenantId, name);
    // token.token es el secreto en claro — se devuelve SOLO aquí
    return res.status(201).json({
      success: true,
      message: 'Guarda este token ahora: no se volverá a mostrar.',
      data: token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function revokeToken(req, res) {
  try {
    const revoked = await apiTokenService.revokeToken(req.tenantId, req.params.id);
    if (!revoked) {
      return res.status(404).json({ success: false, message: 'Token no encontrado o ya revocado' });
    }
    return res.json({ success: true, message: 'Token revocado' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { me, listTokens, createToken, revokeToken };
