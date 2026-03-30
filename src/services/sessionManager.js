const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const MAX_RETRIES = 3;
const AUTH_BASE_DIR = path.resolve('./auth_sessions');

class SessionManager extends EventEmitter {
  constructor() {
    super();
    // Map<sessionId, { sock, isReady, qrCode, qrBase64, status, retryCount }>
    this.sessions = new Map();
    this._rrIndex = 0;
  }

  /**
   * Al arrancar: escanea auth_sessions/ y restaura sesiones existentes.
   */
  async initializeSessions() {
    fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });

    const dirs = fs.readdirSync(AUTH_BASE_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    if (dirs.length === 0) {
      console.log('[SessionManager] Sin sesiones guardadas. Crea una desde POST /api/sessions');
      return;
    }

    console.log(`[SessionManager] Restaurando ${dirs.length} sesión(es): ${dirs.join(', ')}`);
    await Promise.all(dirs.map(id => this.createSession(id)));
  }

  async createSession(sessionId) {
    const id = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (this.sessions.has(id)) {
      return { error: 'La sesión ya existe' };
    }

    this.sessions.set(id, {
      sock: null,
      isReady: false,
      qrCode: null,
      qrBase64: null,
      status: 'connecting',
      retryCount: 0,
    });

    await this._connect(id);
    return { sessionId: id };
  }

  async _connect(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const authDir = path.join(AUTH_BASE_DIR, sessionId);
      fs.mkdirSync(authDir, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Microservicio', 'Chrome', '1.0.0'],
        getMessage: async () => undefined,
      });

      session.sock = sock;
      sock.ev.on('connection.update', (update) => this._handleUpdate(sessionId, update));
      sock.ev.on('creds.update', saveCreds);
    } catch (error) {
      console.error(`[Session:${sessionId}] Error al conectar:`, error.message);
      this._scheduleRetry(sessionId);
    }
  }

  async _handleUpdate(sessionId, update) {
    const session = this.sessions.get(sessionId);
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
      this.emit('session:qr', { sessionId, qr, qrBase64: session.qrBase64 });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      session.isReady = false;
      session.qrCode = null;
      session.qrBase64 = null;
      this.emit('session:disconnected', { sessionId, statusCode });

      if (loggedOut) {
        session.status = 'logged_out';
        this.emit('session:failed', { sessionId, reason: 'logged_out' });
      } else {
        this._scheduleRetry(sessionId);
      }
    }

    if (connection === 'open') {
      session.isReady = true;
      session.qrCode = null;
      session.qrBase64 = null;
      session.status = 'ready';
      session.retryCount = 0;
      console.log(`[Session:${sessionId}] Conectado ✓`);
      this.emit('session:ready', { sessionId });
    }
  }

  /**
   * Reintenta la conexión con backoff. Tras MAX_RETRIES marca la sesión como caída
   * y emite session:failed SIN tocar carpetas de otras sesiones.
   */
  _scheduleRetry(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.retryCount += 1;

    if (session.retryCount >= MAX_RETRIES) {
      session.status = 'failed';
      console.error(`[Session:${sessionId}] Máximo reintentos (${MAX_RETRIES}). Sesión caída.`);
      this.emit('session:failed', { sessionId, reason: 'max_retries' });
      return;
    }

    const delayMs = 3000 * session.retryCount;
    session.status = 'reconnecting';
    console.log(`[Session:${sessionId}] Reintento ${session.retryCount}/${MAX_RETRIES} en ${delayMs}ms...`);
    setTimeout(() => this._connect(sessionId), delayMs);
  }

  async removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sesión '${sessionId}' no encontrada`);

    try {
      if (session.sock) await session.sock.logout();
    } catch (_) { /* ignorar errores de logout */ }

    // Solo borra la carpeta de ESTA sesión, nunca las demás
    const authDir = path.join(AUTH_BASE_DIR, sessionId);
    fs.rmSync(authDir, { recursive: true, force: true });
    this.sessions.delete(sessionId);
    this.emit('session:removed', { sessionId });
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions() {
    const result = {};
    for (const [id, s] of this.sessions) {
      result[id] = {
        status: s.status,
        isReady: s.isReady,
        hasQR: !!s.qrCode,
        retryCount: s.retryCount,
      };
    }
    return result;
  }

  /**
   * Round-robin: solo elige entre sesiones con status === 'ready'.
   * Si todas están caídas devuelve null.
   */
  getNextAvailableSession() {
    const ready = [...this.sessions.entries()]
      .filter(([, s]) => s.isReady && s.status === 'ready')
      .map(([id]) => id);

    if (ready.length === 0) return null;

    const idx = this._rrIndex % ready.length;
    this._rrIndex = (this._rrIndex + 1 >= Number.MAX_SAFE_INTEGER) ? 0 : this._rrIndex + 1;

    const sessionId = ready[idx];
    return { sessionId, ...this.sessions.get(sessionId) };
  }
}

module.exports = new SessionManager();
