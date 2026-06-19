-- ─────────────────────────────────────────────────────────────
-- 010 · Multi-tenant en audit_logs
--
-- Cada entrada de auditoría se asocia al tenant que originó el mensaje,
-- para que cada empresa solo vea su propio historial.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
