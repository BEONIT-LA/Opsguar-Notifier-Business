/**
 * Script de inicialización de datos.
 * Crea el usuario admin inicial en la base de datos.
 *
 * Uso:
 *   node database/seed.js
 *   node database/seed.js --user=admin --pass=miPassword123
 */
require('dotenv').config();
const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);

const USERNAME   = args.user      || process.env.ADMIN_USER  || 'admin';
const PASSWORD   = args.pass      || process.env.ADMIN_PASS  || 'admin123';
const FIRST_NAME = args.firstname || 'Administrador';
const LAST_NAME  = args.lastname  || '';
const EMAIL      = args.email     || '';

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🌱 Conectando a PostgreSQL...');
    await pool.query('SELECT 1'); // prueba conexión
    console.log('✅ Conexión OK');

    // Genera hash bcrypt con 12 rounds (balance seguridad/velocidad)
    const hash = await bcrypt.hash(PASSWORD, 12);

    const result = await pool.query(
      `INSERT INTO users (username, password, role, first_name, last_name, email)
       VALUES ($1, $2, 'superadmin', $3, $4, $5)
       ON CONFLICT (username)
       DO UPDATE SET password = EXCLUDED.password, first_name = EXCLUDED.first_name,
                     last_name = EXCLUDED.last_name, email = EXCLUDED.email, updated_at = NOW()
       RETURNING id, username, role, first_name, last_name, email`,
      [USERNAME, hash, FIRST_NAME || null, LAST_NAME || null, EMAIL || null]
    );

    const u = result.rows[0];
    console.log(`\n✅ Usuario creado/actualizado:`);
    console.log(`   ID:         ${u.id}`);
    console.log(`   Username:   ${u.username}`);
    console.log(`   Nombre:     ${[u.first_name, u.last_name].filter(Boolean).join(' ') || '–'}`);
    console.log(`   Email:      ${u.email || '–'}`);
    console.log(`   Role:       ${u.role}`);
    console.log(`   Password:   ${PASSWORD}`);
    console.log('\n⚠️  Guarda estas credenciales en un lugar seguro.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('   Verifica que DATABASE_URL esté configurado en .env');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
