/**
 * tenantService.js
 * Lógica de negocio de tenants (empresas): CRUD, alta de responsable,
 * vigencia y cuota de mensajes.
 *
 * Reglas:
 *  - Un tenant "opera" solo si status='active' y NOW() está dentro de la
 *    ventana [valid_from, valid_until] (valid_until NULL = sin caducidad).
 *  - La cuota es message_quota (0 = ilimitada). messages_used cuenta el
 *    consumo del periodo actual. Si quota_period='monthly', el contador se
 *    reinicia al cambiar de mes (period_anchor marca el inicio del periodo).
 */

const bcrypt = require('bcryptjs');
const db     = require('../config/database');

const SLUG_RE = /[^a-z0-9-]/g;

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .trim()
    .replace(/\s+/g, '-')
    .replace(SLUG_RE, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

// ── Lecturas ──────────────────────────────────────────────────

async function getTenantById(id) {
  const { rows } = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getTenantBySlug(slug) {
  const { rows } = await db.query('SELECT * FROM tenants WHERE slug = $1', [slug]);
  return rows[0] || null;
}

/** Lista tenants con datos del responsable y conteo de sesiones registradas. */
async function listTenants() {
  const { rows } = await db.query(
    `SELECT t.*,
            m.id        AS manager_id,
            m.username  AS manager_username,
            m.email     AS manager_email,
            (SELECT COUNT(*) FROM wa_sessions s WHERE s.tenant_id = t.id) AS session_count
       FROM tenants t
       LEFT JOIN LATERAL (
         SELECT id, username, email FROM users
         WHERE tenant_id = t.id AND role = 'manager'
         ORDER BY id ASC LIMIT 1
       ) m ON true
      ORDER BY t.created_at DESC`
  );
  return rows;
}

// ── Vigencia y cuota ──────────────────────────────────────────

/**
 * Reinicia el contador mensual si el periodo cambió. Solo afecta a tenants
 * con quota_period='monthly'. Idempotente: no hace nada si el mes no cambió.
 */
async function refreshQuotaWindow(tenantId) {
  await db.query(
    `UPDATE tenants
        SET messages_used = 0,
            period_anchor = date_trunc('month', CURRENT_DATE)::date
      WHERE id = $1
        AND quota_period = 'monthly'
        AND date_trunc('month', period_anchor) < date_trunc('month', CURRENT_DATE)`,
    [tenantId]
  );
}

/**
 * Devuelve { ok, reason, tenant } indicando si el tenant puede enviar AHORA.
 * Hace primero el refresh de cuota mensual.
 */
async function checkCanSend(tenantId) {
  await refreshQuotaWindow(tenantId);
  const tenant = await getTenantById(tenantId);

  if (!tenant) return { ok: false, reason: 'tenant_not_found', tenant: null };
  if (tenant.status !== 'active') return { ok: false, reason: 'suspended', tenant };

  const now = Date.now();
  if (tenant.valid_from && new Date(tenant.valid_from).getTime() > now) {
    return { ok: false, reason: 'not_started', tenant };
  }
  if (tenant.valid_until && new Date(tenant.valid_until).getTime() < now) {
    return { ok: false, reason: 'expired', tenant };
  }
  if (tenant.message_quota > 0 && tenant.messages_used >= tenant.message_quota) {
    return { ok: false, reason: 'quota_exceeded', tenant };
  }
  return { ok: true, reason: null, tenant };
}

/** Igual que checkCanSend pero solo valida vigencia/estado (no cuota). */
async function checkOperational(tenantId) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant_not_found', tenant: null };
  if (tenant.status !== 'active') return { ok: false, reason: 'suspended', tenant };
  const now = Date.now();
  if (tenant.valid_from && new Date(tenant.valid_from).getTime() > now) {
    return { ok: false, reason: 'not_started', tenant };
  }
  if (tenant.valid_until && new Date(tenant.valid_until).getTime() < now) {
    return { ok: false, reason: 'expired', tenant };
  }
  return { ok: true, reason: null, tenant };
}

/** Incrementa el consumo en 1 (se llama cuando un mensaje se envía con éxito). */
async function incrementUsage(tenantId, n = 1) {
  await db.query(
    'UPDATE tenants SET messages_used = messages_used + $2 WHERE id = $1',
    [tenantId, n]
  );
}

/** Resumen de uso pensado para la UI del responsable. */
function usageSummary(tenant) {
  const quota     = tenant.message_quota || 0;
  const used      = tenant.messages_used || 0;
  const unlimited = quota === 0;
  return {
    status:        tenant.status,
    quota,
    used,
    remaining:     unlimited ? null : Math.max(0, quota - used),
    unlimited,
    quotaPeriod:   tenant.quota_period,
    validFrom:     tenant.valid_from,
    validUntil:    tenant.valid_until,
    maxSessions:   tenant.max_sessions,
  };
}

// ── Escrituras ────────────────────────────────────────────────

/**
 * Crea un tenant y su usuario responsable (manager) en una transacción.
 * @returns { tenant, manager:{ id, username } }
 */
async function createTenantWithManager({
  name, slug, validFrom, validUntil,
  messageQuota = 0, quotaPeriod = 'total', maxSessions = 1,
  manager,
}) {
  if (!name || !name.trim()) throw new Error("'name' es requerido");
  if (!manager || !manager.username || !manager.password) {
    throw new Error('Datos del responsable (username y password) requeridos');
  }

  const finalSlug = slugify(slug || name);
  if (!finalSlug) throw new Error('No se pudo derivar un slug válido del nombre');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const t = await client.query(
      `INSERT INTO tenants
         (name, slug, valid_from, valid_until, message_quota, quota_period, max_sessions, period_anchor)
       VALUES ($1, $2, COALESCE($3, NOW()), $4, $5, $6, $7, date_trunc('month', CURRENT_DATE)::date)
       RETURNING *`,
      [name.trim(), finalSlug, validFrom || null, validUntil || null,
       messageQuota, quotaPeriod, maxSessions]
    );
    const tenant = t.rows[0];

    const hash = await bcrypt.hash(manager.password, 12);
    const u = await client.query(
      `INSERT INTO users (username, password, role, tenant_id, first_name, last_name, email)
       VALUES ($1, $2, 'manager', $3, $4, $5, $6)
       RETURNING id, username, email`,
      [manager.username.trim(), hash, tenant.id,
       manager.firstName || null, manager.lastName || null, manager.email || null]
    );

    await client.query('COMMIT');
    return { tenant, manager: u.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Actualiza campos editables del tenant. */
async function updateTenant(id, fields) {
  const allowed = ['name', 'valid_from', 'valid_until', 'message_quota',
                   'quota_period', 'max_sessions', 'status'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) return getTenantById(id);
  params.push(id);
  const { rows } = await db.query(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function setStatus(id, status) {
  const { rows } = await db.query(
    'UPDATE tenants SET status = $2 WHERE id = $1 RETURNING *',
    [id, status]
  );
  return rows[0] || null;
}

/** Restablece el contador de consumo manualmente (recarga de bolsa). */
async function resetUsage(id) {
  const { rows } = await db.query(
    `UPDATE tenants
        SET messages_used = 0, period_anchor = date_trunc('month', CURRENT_DATE)::date
      WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

/** Cambia la contraseña del responsable del tenant. */
async function resetManagerPassword(tenantId, newPassword) {
  const hash = await bcrypt.hash(newPassword, 12);
  const { rows } = await db.query(
    `UPDATE users SET password = $2
      WHERE tenant_id = $1 AND role = 'manager'
      RETURNING id, username`,
    [tenantId, hash]
  );
  return rows[0] || null;
}

module.exports = {
  slugify,
  getTenantById,
  getTenantBySlug,
  listTenants,
  refreshQuotaWindow,
  checkCanSend,
  checkOperational,
  incrementUsage,
  usageSummary,
  createTenantWithManager,
  updateTenant,
  setStatus,
  resetUsage,
  resetManagerPassword,
};
