-- ─────────────────────────────────────────────────────────────
-- 009 · Multi-tenant en group_pools
--
-- Los pools (grupo → sesiones autorizadas) pasan a ser por tenant.
-- Antes group_id era único globalmente; ahora la unicidad es por
-- (tenant_id, group_id): dos empresas distintas pueden tener pools
-- para el mismo group_id de WhatsApp sin chocar.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE group_pools
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

-- Quitar la restricción de unicidad global sobre group_id (nombre autogenerado)
ALTER TABLE group_pools DROP CONSTRAINT IF EXISTS group_pools_group_id_key;

-- Unicidad por tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_pools_tenant_group_uniq'
  ) THEN
    ALTER TABLE group_pools
      ADD CONSTRAINT group_pools_tenant_group_uniq UNIQUE (tenant_id, group_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_group_pools_tenant ON group_pools(tenant_id);
