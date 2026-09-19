/**
 * Primer superadmin de plataforma, sin contraseñas fijas en el código.
 *
 * Al arrancar, si no existe ningún superadmin:
 *   - ADMIN_PASS definida → se crea ADMIN_USER (default "admin") con esa clave.
 *   - ADMIN_PASS vacía    → se genera una clave aleatoria y se muestra UNA vez
 *                           en el log; hay que cambiarla tras el primer login.
 *
 * Si ya hay superadmin no se toca nada, pero se avisa si alguno conserva la
 * antigua clave pública "admin123" (bases creadas con el seed anterior).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db     = require('../config/database');

const LEGACY_PASSWORD = 'admin123';
const MIN_ADMIN_PASS_LENGTH = 12;

function generatePassword() {
  return crypto.randomBytes(18).toString('base64url'); // 24 caracteres
}

async function ensureSuperadmin({
  username = process.env.ADMIN_USER || 'admin',
  password = process.env.ADMIN_PASS,
  log = console,
} = {}) {
  const { rows } = await db.query(
    "SELECT id, username, password FROM users WHERE role = 'superadmin'");

  if (rows.length > 0) {
    for (const u of rows) {
      if (await bcrypt.compare(LEGACY_PASSWORD, u.password)) {
        log.warn(`[Bootstrap] ⚠ El superadmin "${u.username}" usa la contraseña pública por defecto. Cámbiala YA.`);
      }
    }
    return { created: false };
  }

  if (password && password.length < MIN_ADMIN_PASS_LENGTH) {
    throw new Error(`ADMIN_PASS debe tener al menos ${MIN_ADMIN_PASS_LENGTH} caracteres.`);
  }
  if (password === LEGACY_PASSWORD) {
    throw new Error('ADMIN_PASS no puede ser la contraseña por defecto pública.');
  }

  const generated = !password;
  const plain = password || generatePassword();
  const hash  = await bcrypt.hash(plain, 12);

  const ins = await db.query(
    `INSERT INTO users (username, password, role, first_name)
     VALUES ($1, $2, 'superadmin', 'Administrador')
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, hash]);
  if (!ins.rows?.length) {
    throw new Error(`El usuario "${username}" ya existe y no es superadmin. Define otro ADMIN_USER.`);
  }

  if (generated) {
    log.warn(
      `[Bootstrap] Superadmin "${username}" creado con contraseña generada: ${plain}\n` +
      '[Bootstrap] Se muestra sólo esta vez. Guárdala en Gravity Ops y cámbiala tras el primer login.');
  } else {
    log.log(`[Bootstrap] Superadmin "${username}" creado con ADMIN_PASS.`);
  }
  return { created: true, generated, username };
}

module.exports = { ensureSuperadmin, LEGACY_PASSWORD, MIN_ADMIN_PASS_LENGTH };
