-- ─────────────────────────────────────────────────────────────
-- 003: Datos iniciales
-- ⚠ Este hash corresponde a la contraseña: admin123
-- Cámbiala desde el sistema después del primer login
-- Hash generado con bcrypt, 12 rounds
-- ─────────────────────────────────────────────────────────────

INSERT INTO users (username, password, role)
VALUES (
  'admin',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpR7jSh1G3.Ry',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
