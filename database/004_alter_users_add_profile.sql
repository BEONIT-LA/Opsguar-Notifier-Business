-- ─────────────────────────────────────────────────────────────
-- 004: Agrega campos de perfil a la tabla users
-- ─────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email      VARCHAR(200) UNIQUE;

-- Índice para búsqueda por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
