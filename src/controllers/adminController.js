/**
 * adminController.js
 * Endpoints de administración de plataforma (solo superadmin):
 *   GET    /api/admin/tenants                  → lista con consumo
 *   POST   /api/admin/tenants                  → crea tenant + responsable
 *   GET    /api/admin/tenants/:id              → detalle
 *   PATCH  /api/admin/tenants/:id              → editar cuota/vigencia/estado/etc.
 *   POST   /api/admin/tenants/:id/suspend      → suspender
 *   POST   /api/admin/tenants/:id/activate     → reactivar
 *   POST   /api/admin/tenants/:id/reset-usage  → reiniciar consumo (recarga)
 *   POST   /api/admin/tenants/:id/reset-password → nueva contraseña del responsable
 */

const tenantService = require('../services/tenantService');

async function listTenants(req, res) {
  try {
    const tenants = await tenantService.listTenants();
    const data = tenants.map(t => ({
      ...t,
      usage: tenantService.usageSummary(t),
    }));
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getTenant(req, res) {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    return res.json({ success: true, data: { ...tenant, usage: tenantService.usageSummary(tenant) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createTenant(req, res) {
  try {
    const {
      name, slug, validFrom, validUntil,
      messageQuota, quotaPeriod, maxSessions,
      managerUsername, managerPassword, managerEmail, managerFirstName, managerLastName,
    } = req.body;

    if (!name || !managerUsername || !managerPassword) {
      return res.status(400).json({
        success: false,
        message: "Requeridos: 'name', 'managerUsername', 'managerPassword'",
      });
    }

    const result = await tenantService.createTenantWithManager({
      name,
      slug,
      validFrom:    validFrom  || null,
      validUntil:   validUntil || null,
      messageQuota: Number.isFinite(+messageQuota) ? +messageQuota : 0,
      quotaPeriod:  quotaPeriod === 'monthly' ? 'monthly' : 'total',
      maxSessions:  Number.isFinite(+maxSessions) ? +maxSessions : 1,
      manager: {
        username:  managerUsername,
        password:  managerPassword,
        email:     managerEmail || null,
        firstName: managerFirstName || null,
        lastName:  managerLastName || null,
      },
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error.code === '23505') {
      // slug o username/email duplicado
      return res.status(409).json({
        success: false,
        message: 'Ya existe un tenant con ese slug, o el usuario/email del responsable ya está en uso',
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function updateTenant(req, res) {
  try {
    const fields = {};
    const b = req.body;
    if (b.name        !== undefined) fields.name = b.name;
    if (b.validFrom   !== undefined) fields.valid_from = b.validFrom;
    if (b.validUntil  !== undefined) fields.valid_until = b.validUntil;
    if (b.messageQuota!== undefined) fields.message_quota = +b.messageQuota;
    if (b.quotaPeriod !== undefined) fields.quota_period = b.quotaPeriod === 'monthly' ? 'monthly' : 'total';
    if (b.maxSessions !== undefined) fields.max_sessions = +b.maxSessions;
    if (b.status      !== undefined) fields.status = b.status === 'suspended' ? 'suspended' : 'active';

    const tenant = await tenantService.updateTenant(req.params.id, fields);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    return res.json({ success: true, data: { ...tenant, usage: tenantService.usageSummary(tenant) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function suspendTenant(req, res) {
  try {
    const tenant = await tenantService.setStatus(req.params.id, 'suspended');
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    return res.json({ success: true, data: tenant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function activateTenant(req, res) {
  try {
    const tenant = await tenantService.setStatus(req.params.id, 'active');
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    return res.json({ success: true, data: tenant });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function resetUsage(req, res) {
  try {
    const tenant = await tenantService.resetUsage(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    return res.json({ success: true, data: { ...tenant, usage: tenantService.usageSummary(tenant) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function resetManagerPassword(req, res) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    const manager = await tenantService.resetManagerPassword(req.params.id, newPassword);
    if (!manager) return res.status(404).json({ success: false, message: 'Responsable no encontrado para ese tenant' });
    return res.json({ success: true, data: manager });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  resetUsage,
  resetManagerPassword,
};
