-- ─────────────────────────────────────────────────────────────
-- 001: Tabla de usuarios
-- Reemplaza las credenciales hardcodeadas en .env
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(100) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash (nunca texto plano)
  role        VARCHAR(20)  NOT NULL DEFAULT 'operator',  -- admin | operator
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  first_name  VARCHAR(100),                   -- Nombre
  last_name   VARCHAR(100),                   -- Apellido
  email       VARCHAR(200) UNIQUE,            -- Correo electrónico
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice para búsqueda por username (login)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Trigger: actualiza updated_at automáticamente al hacer UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
