-- ─────────────────────────────────────────────────────────────────
-- 005 · Pools de envío (asignación sesiones → grupos)
--
-- Un "pool" define qué sesiones/números están autorizados
-- a enviar mensajes a un grupo de WhatsApp específico.
-- Si un grupo no tiene pool, el sistema usa round-robin global.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_pools (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  group_id    TEXT         NOT NULL UNIQUE,
  session_ids TEXT[]       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_pools_group_id ON group_pools (group_id);
