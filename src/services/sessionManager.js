const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

// Logger completamente mudo para Baileys.
// pino({ level: 'silent' }) no suprime todos los niveles en todas las versiones,
// por eso usamos un objeto no-op que garantiza silencio total (incluyendo "Bad MAC").
const noopLogger = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info:  () => {},
  warn:  () => {},
  error: () => {},
  fatal: () => {},
  child: function() { return this; },
};
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const MAX_RETRIES = 3;
const AUTH_BASE_DIR = path.resolve('./auth_sessions');

/**
 * SessionManager multi-tenant.
 *
 * Las sesiones se aíslan por tenant. Internamente el Map usa una clave
 * compuesta "{tenantId}::{sessionId}", y en disco cada sesión vive en
 * auth_sessions/{tenantId}/{sessionId}/. Todos los métodos públicos reciben
 * (tenantId, sessionId) y todos los eventos emitidos incluyen `tenantId`
 * para que socketHandler pueda enrutar a la room del tenant.
 */
class SessionManager extends EventEmitter {
  constructor() {
    super();
    // Map<compositeKey, { tenantId, sessionId, sock, isReady, ... }>
    this.sessions = new Map();
    this._rrIndex = 0;
    // Map<tenantId, Map<phoneNumber, sessionId>> para detectar duplicados por tenant
    this._phoneIndex = new Map();
  }

  // ── Helpers de clave / disco ────────────────────────────────
  _key(tenantId, sessionId) { return `${tenantId}::${sessionId}`; }
  _authDir(tenantId, sessionId) {
    return path.join(AUTH_BASE_DIR, String(tenantId), sessionId);
  }
  _phoneMap(tenantId) {
    if (!this._phoneIndex.has(tenantId)) this._phoneIndex.set(tenantId, new Map());
    return this._phoneIndex.get(tenantId);
  }

  /**
   * Al arrancar: escanea auth_sessions/{tenantId}/{sessionId}/ y restaura.
   */
  async initializeSessions() {
    fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });

    const tenantDirs = fs.readdirSync(AUTH_BASE_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const toRestore = [];
    for (const tenantId of tenantDirs) {
      const tenantPath = path.join(AUTH_BASE_DIR, tenantId);
      const sessDirs = fs.readdirSync(tenantPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      for (const sessionId of sessDirs) toRestore.push({ tenantId, sessionId });
    }

    if (toRestore.length === 0) {
      console.log('[SessionManager] Sin sesiones guardadas. Cada tenant crea las suyas desde su workspace.');
      return;
    }

    console.log(`[SessionManager] Restaurando ${toRestore.length} sesión(es) de ${tenantDirs.length} tenant(s)`);
    await Promise.all(toRestore.map(({ tenantId, sessionId }) =>
      this.createSession(tenantId, sessionId)));
  }

  async createSession(tenantId, sessionId) {
    const id  = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = this._key(tenantId, id);

    if (this.sessions.has(key)) {
      const existing = this.sessions.get(key);
      const recoverable = ['failed', 'logged_out'].includes(existing.status);

      if (!recoverable) {
        return { error: 'La sesión ya existe y está activa' };
      }

      console.log(`[Session:${key}] Sesión en estado "${existing.status}", reconectando...`);
      if (existing.phone) this._phoneMap(tenantId).delete(existing.phone);
      try { if (existing.sock) await existing.sock.logout(); } catch (_) {}
      this.sessions.delete(key);
    }

    this.sessions.set(key, {
      tenantId,
      sessionId: id,
      sock: null,
      isReady: false,
      qrCode: null,
      qrBase64: null,
      status: 'connecting',
      retryCount: 0,
      phone: null,
      isBusy: false,
    });

    await this._connect(tenantId, id);
    return { sessionId: id };
  }

  async _connect(tenantId, sessionId) {
    const key = this._key(tenantId, sessionId);
    const session = this.sessions.get(key);
    if (!session) return;

    try {
      const authDir = this._authDir(tenantId, sessionId);
      fs.mkdirSync(authDir, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        logger: noopLogger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Microservicio', 'Chrome', '1.0.0'],
        getMessage: async () => undefined,
      });

      session.sock = sock;
      sock.ev.on('connection.update', (update) => this._handleUpdate(tenantId, sessionId, update));
      sock.ev.on('creds.update', saveCreds);
    } catch (error) {
      console.error(`[Session:${key}] Error al conectar:`, error.message);
      this._scheduleRetry(tenantId, sessionId);
    }
  }

  async _handleUpdate(tenantId, sessionId, update) {
    const key = this._key(tenantId, sessionId);
    const session = this.sessions.get(key);
    if (!session) return;

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qrCode = qr;
      session.status = 'qr_needed';
      try {
        session.qrBase64 = await qrcode.toDataURL(qr);
      } catch (_) {
        session.qrBase64 = null;
      }
      this.emit('session:qr', { tenantId, sessionId, qr, qrBase64: session.qrBase64 });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (session.phone) {
        this._phoneMap(tenantId).delete(session.phone);
        session.phone = null;
      }

      session.isReady = false;
      session.qrCode = null;
      session.qrBase64 = null;
      this.emit('session:disconnected', { tenantId, sessionId, statusCode });

      if (loggedOut) {
        session.status = 'logged_out';
        this.emit('session:failed', { tenantId, sessionId, reason: 'logged_out' });
      } else {
        this._scheduleRetry(tenantId, sessionId);
      }
    }

    if (connection === 'open') {
      const rawJid = session.sock?.user?.id || '';
      const phone  = rawJid.split(':')[0].split('@')[0] || null;

      // Detectar número duplicado DENTRO del mismo tenant
      const phoneMap = this._phoneMap(tenantId);
      if (phone && phoneMap.has(phone)) {
        const existing = phoneMap.get(phone);
        if (existing !== sessionId) {
          console.warn(`[Session:${key}] Número ${phone} ya en uso por "${existing}" en este tenant. Desconectando duplicado.`);
          session.status = 'failed';
          session.isReady = false;
          try { await session.sock.logout(); } catch (_) {}
          this.emit('session:failed', { tenantId, sessionId, reason: `Número duplicado — ya en uso por "${existing}"` });
          return;
        }
      }

      session.isReady = true;
      session.qrCode = null;
      session.qrBase64 = null;
      session.status = 'ready';
      session.retryCount = 0;
      session.phone = phone;

      if (phone) phoneMap.set(phone, sessionId);

      console.log(`[Session:${key}] Conectado ✓ — número: ${phone || 'desconocido'}`);
      this.emit('session:ready', { tenantId, sessionId, phone });
    }
  }

  _scheduleRetry(tenantId, sessionId) {
    const key = this._key(tenantId, sessionId);
    const session = this.sessions.get(key);
    if (!session) return;

    session.retryCount += 1;

    if (session.retryCount >= MAX_RETRIES) {
      session.status = 'failed';
      console.error(`[Session:${key}] Máximo reintentos (${MAX_RETRIES}). Sesión caída.`);
      this.emit('session:failed', { tenantId, sessionId, reason: 'max_retries' });
      return;
    }

    const delayMs = 3000 * session.retryCount;
    session.status = 'reconnecting';
    console.log(`[Session:${key}] Reintento ${session.retryCount}/${MAX_RETRIES} en ${delayMs}ms...`);
    setTimeout(() => this._connect(tenantId, sessionId), delayMs);
  }

  async removeSession(tenantId, sessionId) {
    const key = this._key(tenantId, sessionId);
    const session = this.sessions.get(key);
    if (!session) throw new Error(`Sesión '${sessionId}' no encontrada`);

    try {
      if (session.sock) await session.sock.logout();
    } catch (_) { /* ignorar errores de logout */ }

    if (session.phone) this._phoneMap(tenantId).delete(session.phone);

    // Solo borra la carpeta de ESTA sesión de ESTE tenant
    const authDir = this._authDir(tenantId, sessionId);
    fs.rmSync(authDir, { recursive: true, force: true });
    this.sessions.delete(key);
    this.emit('session:removed', { tenantId, sessionId });
  }

  getSession(tenantId, sessionId) {
    return this.sessions.get(this._key(tenantId, sessionId)) || null;
  }

  /** Estado de TODAS las sesiones de un tenant: { sessionId: {state} }. */
  getAllSessions(tenantId) {
    const result = {};
    for (const s of this.sessions.values()) {
      if (s.tenantId != tenantId) continue; // eslint-disable-line eqeqeq
      result[s.sessionId] = {
        status: s.status,
        isReady: s.isReady,
        hasQR: !!s.qrCode,
        retryCount: s.retryCount,
        phone: s.phone || null,
      };
    }
    return result;
  }

  /** Cuántas sesiones tiene registradas el tenant (para el tope max_sessions). */
  countSessions(tenantId) {
    let n = 0;
    for (const s of this.sessions.values()) if (s.tenantId == tenantId) n++; // eslint-disable-line eqeqeq
    return n;
  }

  /**
   * Round-robin entre las sesiones LISTAS y libres DEL TENANT indicado.
   * Se usa cuando el grupo no tiene pool asignado.
   */
  getNextAvailableSession(tenantId) {
    const ready = [...this.sessions.values()]
      .filter(s => s.tenantId == tenantId && s.isReady && s.status === 'ready' && !s.isBusy) // eslint-disable-line eqeqeq
      .map(s => s.sessionId);

    return this._pickRoundRobin(tenantId, ready);
  }

  /**
   * Round-robin dentro de un pool del tenant: solo sesiones del pool que
   * estén listas y libres en este momento.
   */
  getNextAvailableSessionFromPool(tenantId, sessionIds = []) {
    const ready = [...this.sessions.values()]
      .filter(s => s.tenantId == tenantId && sessionIds.includes(s.sessionId) // eslint-disable-line eqeqeq
                && s.isReady && s.status === 'ready' && !s.isBusy)
      .map(s => s.sessionId);

    return this._pickRoundRobin(tenantId, ready);
  }

  _pickRoundRobin(tenantId, readyIds) {
    if (readyIds.length === 0) return null;
    const idx = this._rrIndex % readyIds.length;
    this._rrIndex = (this._rrIndex + 1 >= Number.MAX_SAFE_INTEGER) ? 0 : this._rrIndex + 1;
    const sessionId = readyIds[idx];
    return { sessionId, ...this.sessions.get(this._key(tenantId, sessionId)) };
  }

  /** Marca una sesión como ocupada (en uso por el worker). */
  acquireSession(tenantId, sessionId) {
    const session = this.sessions.get(this._key(tenantId, sessionId));
    if (session) session.isBusy = true;
  }

  /** Libera una sesión cuando el worker termina el job. */
  releaseSession(tenantId, sessionId) {
    const session = this.sessions.get(this._key(tenantId, sessionId));
    if (session) session.isBusy = false;
  }

  /** Lista de IDs de sesión registradas de un tenant (listas o no). */
  listSessionIds(tenantId) {
    return [...this.sessions.values()]
      .filter(s => s.tenantId == tenantId) // eslint-disable-line eqeqeq
      .map(s => s.sessionId);
  }

  /** Total de sesiones listas en TODO el sistema (para concurrencia del worker). */
  countReadyGlobal() {
    let n = 0;
    for (const s of this.sessions.values()) if (s.isReady && s.status === 'ready') n++;
    return n;
  }
}

module.exports = new SessionManager();
