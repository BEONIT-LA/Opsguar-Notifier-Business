/**
 * Tests: Validación de inputs en POST /api/send
 * - Sin groupId → 400
 * - Sin contenido → 400
 * - JSON con solo texto → 202
 * - multipart con solo texto → 202
 * - multipart con imagen → 202
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

// ── Mocks ────────────────────────────────────────────────────────
jest.mock('../src/config/database');
jest.mock('../src/workers/messageWorker', () => {});
jest.mock('../src/services/sessionManager', () => ({
  initializeSessions: jest.fn().mockResolvedValue(undefined),
  sessions: new Map([
    ['test_session', { isReady: true, status: 'ready', isBusy: false, sock: {} }]
  ]),
  on: jest.fn(),
  getNextAvailableSession: jest.fn().mockReturnValue({ sessionId: 'test_session', sock: {} }),
}));
jest.mock('../src/services/queueService', () => ({
  messageQueue: { on: jest.fn() },
  enqueueMessage: jest.fn().mockResolvedValue('job_123'),
  getQueueStats: jest.fn().mockResolvedValue({
    waiting: 1, active: 0, ready: 1,
    completed: 0, failed: 0, delayed: 0,
    totalCompleted: 0, totalFailed: 0,
  }),
}));
jest.mock('../src/services/poolService', () => ({
  getPoolByGroupId: jest.fn().mockResolvedValue(null),
}));

const app      = require('../app');
const token    = jwt.sign({ userId: 1, user: 'admin', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const GROUP_ID = '120363000000000001@g.us';

// Imagen PNG mínima válida de 1x1 px
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080000000' +
  '03a7e9b550000000a49444154789c6260000000020001e221bc33000000' +
  '0049454e44ae426082', 'hex'
);

describe('POST /api/send — Validación de inputs', () => {

  test('❌ Sin groupId devuelve 400', async () => {
    const res = await request(app)
      .post('/api/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Hola' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('❌ Sin contenido (sin texto, imagen ni documento) devuelve 400', async () => {
    const res = await request(app)
      .post('/api/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: GROUP_ID });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('✅ JSON con solo texto devuelve 202 y jobId', async () => {
    const res = await request(app)
      .post('/api/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ groupId: GROUP_ID, text: 'Hola mundo' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBe('job_123');
  });

  test('✅ multipart/form-data con solo texto devuelve 202', async () => {
    const res = await request(app)
      .post('/api/send')
      .set('Authorization', `Bearer ${token}`)
      .field('groupId', GROUP_ID)
      .field('text', 'Hola mundo multipart');

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBe('job_123');
  });

  test('✅ multipart con imagen PNG devuelve 202', async () => {
    const tmpFile = path.join(os.tmpdir(), `test_${Date.now()}.png`);
    fs.writeFileSync(tmpFile, TINY_PNG);

    try {
      const res = await request(app)
        .post('/api/send')
        .set('Authorization', `Bearer ${token}`)
        .field('groupId', GROUP_ID)
        .attach('image', tmpFile);

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  test('✅ multipart con texto + imagen devuelve 202', async () => {
    const tmpFile = path.join(os.tmpdir(), `test_${Date.now()}.png`);
    fs.writeFileSync(tmpFile, TINY_PNG);

    try {
      const res = await request(app)
        .post('/api/send')
        .set('Authorization', `Bearer ${token}`)
        .field('groupId', GROUP_ID)
        .field('text', 'Con imagen adjunta')
        .attach('image', tmpFile);

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  test('❌ Sin token devuelve 401', async () => {
    const res = await request(app)
      .post('/api/send')
      .send({ groupId: GROUP_ID, text: 'Hola' });

    expect(res.status).toBe(401);
  });

});
