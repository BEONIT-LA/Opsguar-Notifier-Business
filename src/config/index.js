require('dotenv').config();
const crypto = require('crypto');

const env = process.env.NODE_ENV || 'development';

// Valores que alguna vez fueron default o ejemplo: no se aceptan nunca.
const KNOWN_WEAK_SECRETS = [
  'opsguard_dev_secret',
  'cambia_esto_por_una_clave_segura',
  'cambia_esto_por_un_secreto_largo',
];
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * JWT_SECRET obligatorio y fuerte en producción: sin él cualquiera podría
 * firmar tokens de superadmin. Fuera de producción, si falta, se genera uno
 * aleatorio por proceso (los tokens caducan al reiniciar, que es lo esperado).
 */
function resolveJwtSecret(value, nodeEnv) {
  if (value) {
    if (KNOWN_WEAK_SECRETS.includes(value)) {
      throw new Error('JWT_SECRET usa un valor de ejemplo público. Genera uno: openssl rand -hex 32');
    }
    if (nodeEnv === 'production' && value.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres en producción.`);
    }
    return value;
  }
  if (nodeEnv === 'production') {
    throw new Error('Falta JWT_SECRET. Genera uno: openssl rand -hex 32');
  }
  console.warn('[Config] JWT_SECRET no definido: se usa uno aleatorio (sólo desarrollo).');
  return crypto.randomBytes(32).toString('hex');
}

const config = {
  port:  process.env.PORT       || 3000,
  env,
  redis: {
    url: process.env.REDIS_URL  || 'redis://localhost:6379',
  },
  auth: {
    jwtSecret:  resolveJwtSecret(process.env.JWT_SECRET, env),
    jwtExpires: process.env.JWT_EXPIRES || '8h',
  },
};

module.exports = config;
module.exports.resolveJwtSecret = resolveJwtSecret;
module.exports.KNOWN_WEAK_SECRETS = KNOWN_WEAK_SECRETS;
