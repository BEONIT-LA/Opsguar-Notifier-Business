-- ─────────────────────────────────────────────────────────────
-- 008 · Sesiones de WhatsApp por tenant
--
-- Hasta ahora las sesiones solo vivían en el filesystem (auth_sessions/)
-- y en memoria. Esta tabla las registra para poder consultarlas y, sobre
-- todo, scopearlas por tenant (qué número pertenece a qué empresa).
--
-- El session_id es único DENTRO de un tenant; en disco se guardan en
-- auth_sessions/{tenant_slug}/{session_id}/.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wa_sessions (
  id          SERIAL       PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id  VARCHAR(100) NOT NULL,
  label       VARCHAR(200),                 -- nombre amistoso opcional
  phone       VARCHAR(30),                  -- número detectado al conectar
  status      VARCHAR(20)  NOT NULL DEFAULT 'connecting',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_tenant ON wa_sessions(tenant_id);

DROP TRIGGER IF EXISTS trg_wa_sessions_updated_at ON wa_sessions;
CREATE TRIGGER trg_wa_sessions_updated_at
  BEFORE UPDATE ON wa_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
