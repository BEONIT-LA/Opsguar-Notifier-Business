/**
 * Tests: Autenticación
 * - Login correcto / incorrecto
 * - Cambio de contraseña
 */

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

// ── Mocks ────────────────────────────────────────────────────────
jest.mock('../src/config/database');
jest.mock('../src/workers/messageWorker', () => {});
jest.mock('../src/services/sessionManager', () => ({
  initializeSessions: jest.fn().mockResolvedValue(undefined),
  sessions: new Map(),
  on: jest.fn(),
}));
jest.mock('../src/services/queueService', () => ({
  messageQueue: { on: jest.fn() },
  enqueueMessage: jest.fn(),
  getQueueStats: jest.fn().mockResolvedValue({}),
}));

const db  = require('../src/config/database');
const app = require('../app');

const JWT_SECRET   = process.env.JWT_SECRET; // viene de tests/setup.js
const HASH_ADMIN   = bcrypt.hashSync('admin123', 10);
const validToken   = jwt.sign({ userId: 1, user: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

// ── Suite ─────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {

  test('✅ Login correcto devuelve token JWT', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', password: HASH_ADMIN, role: 'admin', first_name: 'Admin', last_name: null, email: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ user: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBe('admin');
  });

  test('❌ Contraseña incorrecta devuelve 401', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', password: HASH_ADMIN, role: 'admin' }] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ user: 'admin', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('❌ Usuario no existe devuelve 401', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ user: 'noexiste', password: 'cualquiera' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('❌ Faltan campos devuelve 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ user: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

});

describe('PUT /api/auth/change-password', () => {

  test('✅ Cambio de contraseña correcto', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, password: HASH_ADMIN }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ currentPassword: 'admin123', newPassword: 'nueva123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('❌ Contraseña actual incorrecta devuelve 401', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, password: HASH_ADMIN }] });

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ currentPassword: 'wrongpass', newPassword: 'nueva123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('❌ Nueva contraseña muy corta devuelve 400', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ currentPassword: 'admin123', newPassword: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('❌ Sin token devuelve 401', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'admin123', newPassword: 'nueva123' });

    expect(res.status).toBe(401);
  });

});
