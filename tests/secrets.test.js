/**
 * Sin contraseñas por defecto: JWT_SECRET validado y primer superadmin
 * creado sin claves fijas.
 */

jest.mock('../src/config/database');

const bcrypt = require('bcryptjs');
const db     = require('../src/config/database');
const { resolveJwtSecret } = require('../src/config');
const { ensureSuperadmin } = require('../src/services/bootstrapAdmin');

const silentLog = () => ({ warn: jest.fn(), log: jest.fn() });

describe('resolveJwtSecret', () => {
  test('producción sin JWT_SECRET → error', () => {
    expect(() => resolveJwtSecret(undefined, 'production')).toThrow(/Falta JWT_SECRET/);
  });

  test('producción con secreto corto → error', () => {
    expect(() => resolveJwtSecret('corto', 'production')).toThrow(/32/);
  });

  test('valores de ejemplo públicos se rechazan en cualquier entorno', () => {
    for (const env of ['production', 'development']) {
      expect(() => resolveJwtSecret('opsguard_dev_secret', env)).toThrow(/ejemplo/);
      expect(() => resolveJwtSecret('cambia_esto_por_una_clave_segura', env)).toThrow(/ejemplo/);
    }
  });

  test('producción con secreto fuerte → se usa tal cual', () => {
    const s = 'a'.repeat(64);
    expect(resolveJwtSecret(s, 'production')).toBe(s);
  });

  test('desarrollo sin JWT_SECRET → aleatorio distinto cada vez', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const a = resolveJwtSecret(undefined, 'development');
    const b = resolveJwtSecret(undefined, 'development');
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
    warn.mockRestore();
  });
});

describe('ensureSuperadmin', () => {
  beforeEach(() => db.query.mockReset());

  test('sin superadmin y sin ADMIN_PASS → crea uno con clave generada y la muestra', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })            // SELECT superadmin
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });  // INSERT
    const log = silentLog();

    const r = await ensureSuperadmin({ username: 'admin', password: undefined, log });

    expect(r).toMatchObject({ created: true, generated: true });
    const [, params] = db.query.mock.calls[1];
    const shown = log.warn.mock.calls[0][0].match(/generada: (\S+)/)[1];
    expect(shown.length).toBeGreaterThanOrEqual(20);
    expect(await bcrypt.compare(shown, params[1])).toBe(true);
    expect(await bcrypt.compare('admin123', params[1])).toBe(false);
  });

  test('con ADMIN_PASS válida → la usa y no la imprime', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const log = silentLog();

    await ensureSuperadmin({ username: 'root', password: 'una-clave-larga-123', log });

    const [, params] = db.query.mock.calls[1];
    expect(params[0]).toBe('root');
    expect(await bcrypt.compare('una-clave-larga-123', params[1])).toBe(true);
    expect(JSON.stringify(log.log.mock.calls)).not.toContain('una-clave-larga-123');
  });

  test('ADMIN_PASS corta o la pública → error, no se crea nada', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await expect(ensureSuperadmin({ password: 'corta', log: silentLog() })).rejects.toThrow(/12/);
    await expect(ensureSuperadmin({ password: 'admin123', log: silentLog() })).rejects.toThrow();
    expect(db.query.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
  });

  test('ADMIN_USER ya existe como otro rol → error', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING
    await expect(ensureSuperadmin({ username: 'acme', password: 'una-clave-larga-123', log: silentLog() }))
      .rejects.toThrow(/ya existe/);
  });

  test('superadmin existente con admin123 → avisa y no crea otro', async () => {
    const legacyHash = bcrypt.hashSync('admin123', 4);
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin', password: legacyHash }] });
    const log = silentLog();

    const r = await ensureSuperadmin({ log });

    expect(r.created).toBe(false);
    expect(log.warn.mock.calls[0][0]).toMatch(/contraseña pública/);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
