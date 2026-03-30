const sessionManager = require('../services/sessionManager');

function initSocketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

    // Al conectarse, enviar el estado actual de todas las sesiones
    socket.emit('sessions:state', sessionManager.getAllSessions());

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
    });
  });

  // ── Reenviar eventos del SessionManager a todos los clientes ──────────────

  sessionManager.on('session:qr', ({ sessionId, qr, qrBase64 }) => {
    io.emit('session:qr', { sessionId, qr, qrBase64 });
  });

  sessionManager.on('session:ready', ({ sessionId }) => {
    io.emit('session:ready', { sessionId, status: 'ready' });
    io.emit('sessions:state', sessionManager.getAllSessions());
  });

  sessionManager.on('session:disconnected', ({ sessionId, statusCode }) => {
    io.emit('session:disconnected', { sessionId, statusCode });
    io.emit('sessions:state', sessionManager.getAllSessions());
  });

  sessionManager.on('session:failed', ({ sessionId, reason }) => {
    // El frontend debe pedir re-escanear el QR para esta sesión
    io.emit('session:failed', { sessionId, reason });
    io.emit('sessions:state', sessionManager.getAllSessions());
  });

  sessionManager.on('session:removed', ({ sessionId }) => {
    io.emit('session:removed', { sessionId });
    io.emit('sessions:state', sessionManager.getAllSessions());
  });

  sessionManager.on('job:warn', (payload) => {
    io.emit('job:warn', payload);
  });
}

module.exports = { initSocketHandler };
