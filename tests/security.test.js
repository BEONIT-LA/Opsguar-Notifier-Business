/**
 * Tests: Seguridad JWT
 * - Rutas protegidas sin token → 401
 * - Token inválido → 401
 * - Token expirado → 401
 * - Token válido → pasa
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');

// ── Mocks ────────────────────────────────────────────────────────
jest.mock('../src/config/database');
jest.mock('../src/workers/messageWorker', () => {});
jest.mock('../src/services/sessionManager', () => ({
  initializeSessions: jest.fn().mockResolvedValue(undefined),
  sessions: new Map(),
  on: jest.fn(),
  getAllSessions: jest.fn().mockReturnValue({}),
}));
jest.mock('../src/services/queueService', () => ({
  messageQueue: { on: jest.fn() },
  enqueueMessage: jest.fn(),
  getQueueStats: jest.fn().mockResolvedValue({
    waiting: 0, active: 0, ready: 0,
    completed: 0, failed: 0, delayed: 0,
    totalCompleted: 0, totalFailed: 0,
  }),
}));
jest.mock('../src/services/tenantService', () => ({
  checkOperational: jest.fn().mockResolvedValue({ ok: true, tenant: { id: 1, name: 'Empresa A', max_sessions: 5, status: 'active' } }),
  checkCanSend:     jest.fn().mockResolvedValue({ ok: true, tenant: { id: 1 } }),
  incrementUsage:   jest.fn(),
}));

const app        = require('../app');
const JWT_SECRET = process.env.JWT_SECRET;

const validToken   = jwt.sign({ userId: 1, user: 'acme', role: 'manager', tenantId: 1 }, JWT_SECRET, { expiresIn: '1h' });
const expiredToken = jwt.sign({ userId: 1, user: 'acme', role: 'manager', tenantId: 1 }, JWT_SECRET, { expiresIn: '-1s' });
const wrongSecret  = jwt.sign({ userId: 1, user: 'acme', role: 'manager', tenantId: 1 }, 'secret_incorrecto', { expiresIn: '1h' });

const PROTECTED_ROUTES = [
  { method: 'get', path: '/api/sessions'    },
  { method: 'get', path: '/api/queue/stats' },
  { method: 'get', path: '/api/health'      },
  { method: 'get', path: '/api/pools'       },
];

describe('Seguridad — Rutas protegidas por JWT', () => {

  test.each(PROTECTED_ROUTES)(
    '❌ $method $path sin token → 401',
    async ({ method, path }) => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    }
  );

  test.each(PROTECTED_ROUTES)(
    '❌ $method $path con token expirado → 401',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    }
  );

  test.each(PROTECTED_ROUTES)(
    '❌ $method $path con secret incorrecto → 401',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${wrongSecret}`);
      expect(res.status).toBe(401);
    }
  );

  test('❌ Token mal formado → 401', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Authorization', 'Bearer esto.no.es.un.jwt');
    expect(res.status).toBe(401);
  });

  test('❌ Header Authorization sin "Bearer " → 401', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Authorization', validToken);
    expect(res.status).toBe(401);
  });

  test('✅ Token válido pasa la autenticación', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).not.toBe(401);
  });

});
