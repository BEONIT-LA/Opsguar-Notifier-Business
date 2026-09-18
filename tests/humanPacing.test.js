/**
 * Modo humano: los tiempos deben variar, respetar los límites y la sesión
 * debe quedar fuera del round-robin durante su enfriamiento.
 */

jest.mock('@whiskeysockets/baileys', () => ({
  delay: jest.fn(() => Promise.resolve()),
}));

const humanPacing = require('../src/services/humanPacing');

describe('humanPacing', () => {
  const cfg = { ...humanPacing.config, enabled: true, longPauseProb: 0 };

  test('humanRandom respeta [min, max] y no es constante', () => {
    const values = Array.from({ length: 500 }, () => humanPacing.humanRandom(1000, 5000));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...values)).toBeLessThanOrEqual(5000);
    expect(new Set(values).size).toBeGreaterThan(50);
  });

  test('typingMs crece con el largo del texto y está acotado', () => {
    const mid = () => 0.5;
    const corto = humanPacing.typingMs('ok', cfg, mid);
    const largo = humanPacing.typingMs('x'.repeat(40), cfg, mid);
    const enorme = humanPacing.typingMs('x'.repeat(5000), cfg, mid);
    expect(corto).toBe(cfg.typingMinMs);
    expect(largo).toBeGreaterThan(corto);
    expect(enorme).toBe(cfg.typingMaxMs);
  });

  test('cooldownMs dentro del rango configurado', () => {
    for (let i = 0; i < 200; i++) {
      const ms = humanPacing.cooldownMs(cfg);
      expect(ms).toBeGreaterThanOrEqual(cfg.cooldownMinMs);
      expect(ms).toBeLessThanOrEqual(cfg.cooldownMaxMs);
    }
  });

  test('pausa larga ocasional supera el máximo normal', () => {
    const conPausa = { ...cfg, longPauseProb: 1 };
    expect(humanPacing.cooldownMs(conPausa, () => 0.99)).toBeGreaterThan(cfg.cooldownMaxMs);
  });

  test('beforeSend marca "escribiendo" y luego "pausa" antes de enviar', async () => {
    const sock = {
      presenceSubscribe: jest.fn().mockResolvedValue(),
      sendPresenceUpdate: jest.fn().mockResolvedValue(),
    };
    await humanPacing.beforeSend(sock, '123@g.us', 'Alerta: disco lleno');
    const tipos = sock.sendPresenceUpdate.mock.calls.map(c => c[0]);
    expect(tipos).toEqual(['available', 'composing', 'paused']);
  });

  test('un fallo de presencia no impide el envío', async () => {
    const sock = {
      presenceSubscribe: jest.fn().mockRejectedValue(new Error('x')),
      sendPresenceUpdate: jest.fn().mockRejectedValue(new Error('x')),
    };
    await expect(humanPacing.beforeSend(sock, '123@g.us', 'hola')).resolves.toBeUndefined();
  });
});

describe('SessionManager — enfriamiento', () => {
  const sessionManager = require('../src/services/sessionManager');

  beforeEach(() => {
    sessionManager.sessions.clear();
    for (const id of ['a', 'b']) {
      sessionManager.sessions.set(`t1::${id}`, {
        tenantId: 't1', sessionId: id, sock: {}, isReady: true,
        status: 'ready', isBusy: false, availableAt: 0,
      });
    }
  });

  test('una sesión enfriando no se elige hasta que pasa su pausa', () => {
    sessionManager.acquireSession('t1', 'a');
    sessionManager.releaseSession('t1', 'a', 60_000);
    for (let i = 0; i < 5; i++) {
      expect(sessionManager.getNextAvailableSession('t1').sessionId).toBe('b');
    }
    sessionManager.getSession('t1', 'a').availableAt = Date.now() - 1;
    const elegidas = new Set(
      Array.from({ length: 4 }, () => sessionManager.getNextAvailableSession('t1').sessionId));
    expect(elegidas).toEqual(new Set(['a', 'b']));
  });

  test('sin sesiones libres devuelve null', () => {
    sessionManager.releaseSession('t1', 'a', 60_000);
    sessionManager.releaseSession('t1', 'b', 60_000);
    expect(sessionManager.getNextAvailableSession('t1')).toBeNull();
  });
});
