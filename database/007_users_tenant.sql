-- ─────────────────────────────────────────────────────────────
-- 007 · Multi-tenant en users
--
-- Cada usuario (salvo el superadmin de plataforma) pertenece a un
-- tenant. Roles:
--   superadmin → admin de plataforma, tenant_id NULL, gestiona tenants
--   manager    → responsable de un tenant, gestiona su workspace
--   operator   → (futuro) usuario adicional dentro de un tenant
-- ─────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- El username es único globalmente hoy; lo dejamos así (el responsable usa
-- un username único de plataforma). El email también sigue siendo único global.

-- Migrar el admin existente a superadmin de plataforma (sin tenant).
UPDATE users SET role = 'superadmin' WHERE role = 'admin';
