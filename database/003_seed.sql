-- ─────────────────────────────────────────────────────────────
-- 003: Datos iniciales
--
-- Ya NO se crea ningún usuario con contraseña fija (antes admin/admin123,
-- que la migración 007 promovía a superadmin).
-- El primer superadmin lo crea la app al arrancar (src/services/bootstrapAdmin.js)
-- con ADMIN_USER/ADMIN_PASS, o con una contraseña aleatoria mostrada en el log.
-- Se mantiene el archivo para no alterar el orden de migraciones.
-- ─────────────────────────────────────────────────────────────

SELECT 1;
