-- ─────────────────────────────────────────────────────────────
-- 011 · Tokens de API por tenant
--
-- El responsable de un tenant genera tokens para integrar el servicio
-- desde sistemas externos. El token en claro (formato "ogt_<random>")
-- se muestra UNA sola vez; en la BD solo se guarda su hash SHA-256.
-- El prefijo (primeros chars) se guarda en claro para identificarlo en la UI.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_api_tokens (
  id            SERIAL       PRIMARY KEY,
  tenant_id     INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  token_hash    VARCHAR(128) NOT NULL UNIQUE,     -- SHA-256 hex del token completo
  prefix        VARCHAR(20)  NOT NULL,            -- ej: "ogt_a1b2c3" para mostrar en la UI
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_tenant ON tenant_api_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash   ON tenant_api_tokens(token_hash);
