-- ─────────────────────────────────────────────────────────────
-- 006 · Tenants (empresas)
--
-- Cada tenant es una empresa con su responsable, cuota de mensajes,
-- ventana de vigencia y tope de sesiones de WhatsApp. El admin de
-- plataforma (superadmin) crea y administra los tenants.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id             SERIAL       PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  slug           VARCHAR(100) NOT NULL UNIQUE,         -- identificador estable (carpetas de sesiones, etc.)
  status         VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),

  -- Vigencia: el tenant solo opera dentro de esta ventana
  valid_from     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valid_until    TIMESTAMPTZ,                          -- NULL = sin caducidad

  -- Cuota de mensajes
  message_quota  INTEGER      NOT NULL DEFAULT 0,      -- 0 = sin límite
  messages_used  INTEGER      NOT NULL DEFAULT 0,      -- consumo del periodo actual
  quota_period   VARCHAR(10)  NOT NULL DEFAULT 'total' CHECK (quota_period IN ('total','monthly')),
  period_anchor  DATE         NOT NULL DEFAULT CURRENT_DATE,  -- inicio del periodo actual (para reinicio mensual)

  -- Tope de números/sesiones de WhatsApp que puede conectar
  max_sessions   INTEGER      NOT NULL DEFAULT 1,

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Reutiliza la función update_updated_at() definida en 001_users.sql
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
