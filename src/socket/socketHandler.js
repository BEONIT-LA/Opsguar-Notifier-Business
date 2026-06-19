const jwt = require('jsonwebtoken');
const sessionManager = require('../services/sessionManager');
const waSessionService = require('../services/waSessionService');
const { auth } = require('../config');

/**
 * Socket.io multi-tenant.
 *
 * El cliente se autentica en el handshake con su JWT (auth.token o
 * ?token=). Cada socket se une a la room "tenant:{id}" de su empresa, y
 * los eventos del SessionManager (que ahora incluyen tenantId) se emiten
 * SOLO a la room de ese tenant. Así una empresa nunca ve los QR/estados
 * de otra.
 */
function initSocketHandler(io) {
  // ── Autenticación del handshake ───────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      const payload = jwt.verify(token, auth.jwtSecret);
      socket.data.role     = payload.role;
      socket.data.tenantId = payload.tenantId ?? null;
      next();
    } catch (_) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const { role, tenantId } = socket.data;
    console.log(`[Socket.io] Cliente conectado: ${socket.id} (role=${role}, tenant=${tenantId ?? '-'})`);

    if (tenantId != null) {
      const room = `tenant:${tenantId}`;
      socket.join(room);
      // Estado inicial SOLO de las sesiones de su tenant
      socket.emit('sessions:state', sessionManager.getAllSessions(tenantId));
    } else if (role === 'superadmin') {
      socket.join('admins'); // reservado para futuras vistas de plataforma
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
    });
  });

  // ── Reenviar eventos del SessionManager a la room del tenant ──────────────

  const toTenant = (tenantId) => io.to(`tenant:${tenantId}`);
  const pushState = (tenantId) =>
    toTenant(tenantId).emit('sessions:state', sessionManager.getAllSessions(tenantId));

  sessionManager.on('session:qr', ({ tenantId, sessionId, qr, qrBase64 }) => {
    toTenant(tenantId).emit('session:qr', { sessionId, qr, qrBase64 });
  });

  sessionManager.on('session:ready', ({ tenantId, sessionId, phone }) => {
    toTenant(tenantId).emit('session:ready', { sessionId, status: 'ready' });
    pushState(tenantId);
    waSessionService.markStatus(tenantId, sessionId, 'ready', phone || null).catch(() => {});
  });

  sessionManager.on('session:disconnected', ({ tenantId, sessionId, statusCode }) => {
    toTenant(tenantId).emit('session:disconnected', { sessionId, statusCode });
    pushState(tenantId);
    waSessionService.markStatus(tenantId, sessionId, 'disconnected').catch(() => {});
  });

  sessionManager.on('session:failed', ({ tenantId, sessionId, reason }) => {
    toTenant(tenantId).emit('session:failed', { sessionId, reason });
    pushState(tenantId);
    waSessionService.markStatus(tenantId, sessionId, 'failed').catch(() => {});
  });

  sessionManager.on('session:removed', ({ tenantId, sessionId }) => {
    toTenant(tenantId).emit('session:removed', { sessionId });
    pushState(tenantId);
  });

  sessionManager.on('job:warn', ({ tenantId, ...payload }) => {
    if (tenantId != null) toTenant(tenantId).emit('job:warn', payload);
  });

  // Notifica al tenant que actualice las estadísticas de la cola
  sessionManager.on('queue:update', ({ tenantId } = {}) => {
    if (tenantId != null) toTenant(tenantId).emit('queue:update', {});
  });
}

module.exports = { initSocketHandler };
