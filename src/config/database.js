const { Pool } = require('pg');

// Forzamos dotenv por si database.js se carga antes que config/index.js
require('dotenv').config();

/**
 * Pool de conexiones a PostgreSQL.
 * Usamos parámetros individuales (no connectionString) para evitar
 * el error "client password must be a string" cuando DATABASE_URL
 * no está disponible en el momento de la carga del módulo.
 */
const pool = new Pool({
  host:     process.env.POSTGRES_HOST || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB   || 'opsguard',
  user:     process.env.POSTGRES_USER || 'opsguard',
  password: String(process.env.POSTGRES_PASS || 'opsguard2024'), // String() garantiza que nunca sea undefined
  max:                 10,
  idleTimeoutMillis:   30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool:', err.message);
});

/**
 * Prueba la conexión al arrancar.
 * Si falla → el servidor sigue corriendo pero logea el error.
 */
pool.query('SELECT NOW()')
  .then(() => console.log('[DB] PostgreSQL conectado ✓'))
  .catch(err => console.error('[DB] No se pudo conectar a PostgreSQL:', err.message));

module.exports = pool;
