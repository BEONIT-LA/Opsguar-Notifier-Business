-- ─────────────────────────────────────────────────────────────
-- 003: Datos iniciales
-- ⚠ Este hash corresponde a la contraseña: admin123
-- Cámbiala desde el sistema después del primer login
-- Hash generado con bcrypt, 12 rounds
-- ─────────────────────────────────────────────────────────────

INSERT INTO users (username, password, role)
VALUES (
  'admin',
  '$2b$12$yj9qxFid2GZjgAI1FDSr0.Ji6SqsbK4qrmiGlSVJkU1wBdS54BqAO',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
