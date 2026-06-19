/**
 * Tests: Health, Status y Queue Stats
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');

// ── Mocks ────────────────────────────────────────────────────────
jest.mock('../src/config/database');
jest.mock('../src/workers/messageWorker', () => {});
jest.mock('../src/services/sessionManager', () => ({
  initializeSessions: jest.fn().mockResolvedValue(undefined),
  sessions: new Map([
    ['Anahi',        { isReady: true,  status: 'ready',     isBusy: false, phone: '593997477301' }],
    ['vero_pruebas', { isReady: false, status: 'qr_needed', isBusy: false, phone: null           }],
  ]),
  on: jest.fn(),
  getAllSessions: jest.fn().mockReturnValue({
    Anahi:        { status: 'ready',     isReady: true,  phone: '593997477301' },
    vero_pruebas: { status: 'qr_needed', isReady: false, phone: null           },
  }),
}));
jest.mock('../src/services/queueService', () => ({
  messageQueue: { on: jest.fn() },
  enqueueMessage: jest.fn(),
  getQueueStats: jest.fn().mockResolvedValue({
    waiting: 5, active: 1, ready: 1,
    completed: 100, failed: 2, delayed: 0,
    totalCompleted: 500, totalFailed: 10,
  }),
}));
jest.mock('../src/services/tenantService', () => ({
  checkOperational: jest.fn().mockResolvedValue({ ok: true, tenant: { id: 1, name: 'Empresa A', max_sessions: 5, status: 'active' } }),
  checkCanSend:     jest.fn().mockResolvedValue({ ok: true, tenant: { id: 1, name: 'Empresa A' } }),
  incrementUsage:   jest.fn(),
}));

const app   = require('../app');
// Token de un responsable (manager) ligado al tenant 1
const token = jwt.sign({ userId: 1, user: 'acme', role: 'manager', tenantId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('GET /api/health', () => {

  test('✅ Devuelve estructura correcta con status y uptime', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status:    expect.stringMatching(/ok|degraded/),
      uptime:    expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(res.body.data.uptime).toBeGreaterThan(0);
  });

});

describe('GET /api/status', () => {

  test('✅ Devuelve totalSessions y readySessions', async () => {
    const res = await request(app)
      .get('/api/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalSessions: expect.any(Number),
      readySessions: expect.any(Number),
    });
  });

  test('✅ readySessions siempre <= totalSessions', async () => {
    const res = await request(app)
      .get('/api/status')
      .set('Authorization', `Bearer ${token}`);

    const { totalSessions, readySessions } = res.body.data;
    expect(readySessions).toBeLessThanOrEqual(totalSessions);
  });

});

describe('GET /api/queue/stats', () => {

  test('✅ Devuelve todos los campos numéricos de la cola', async () => {
    const res = await request(app)
      .get('/api/queue/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      waiting:        expect.any(Number),
      active:         expect.any(Number),
      ready:          expect.any(Number),
      completed:      expect.any(Number),
      failed:         expect.any(Number),
      totalCompleted: expect.any(Number),
      totalFailed:    expect.any(Number),
    });
  });

  test('✅ Todos los valores son no negativos', async () => {
    const res = await request(app)
      .get('/api/queue/stats')
      .set('Authorization', `Bearer ${token}`);

    Object.values(res.body.data).forEach(val => {
      if (typeof val === 'number') expect(val).toBeGreaterThanOrEqual(0);
    });
  });

});
