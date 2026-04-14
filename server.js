const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

// libsignal imprime "Session error: Bad MAC" via console.error hardcodeado.
// Es ruido inofensivo que ocurre al arrancar cuando WhatsApp tiene mensajes
// pendientes cifrados con claves de sesión previas. Lo filtramos aquí.
const _origConsoleError = console.error.bind(console);
console.error = (...args) => {
  if (typeof args[0] === 'string' && (
    args[0].startsWith('Session error:') ||
    args[0].startsWith('Failed to decrypt message with any known session')
  )) return;
  _origConsoleError(...args);
};
const { port, env } = require('./src/config/index');
const sessionManager = require('./src/services/sessionManager');
const { initSocketHandler } = require('./src/socket/socketHandler');

// Inicia el worker de BullMQ (escucha la cola Redis)
require('./src/workers/messageWorker');

// Errores de descifrado de Baileys (AES-GCM / noise layer) que no están capturados
// internamente y sin este handler matan el proceso completo.
// La sesión afectada detecta la desconexión y reconecta sola vía _scheduleRetry.
const BAILEYS_CRYPTO_ERRORS = [
  'Unsupported state or unable to authenticate data',
  'Bad MAC',
  'Failed to decrypt',
];
process.on('uncaughtException', (err) => {
  const msg = err?.message || '';
  if (BAILEYS_CRYPTO_ERRORS.some(e => msg.includes(e))) {
    // Error conocido de Baileys — la sesión reconecta sola, no hay que cerrar
    return;
  }
  // Error desconocido — log y cierre limpio
  console.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = (reason?.message || String(reason));
  if (BAILEYS_CRYPTO_ERRORS.some(e => msg.includes(e))) return;
  console.error('[unhandledRejection]', reason);
});

async function startServer() {
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  initSocketHandler(io);

  // Restaura sesiones guardadas en auth_sessions/
  await sessionManager.initializeSessions();

  httpServer.listen(port, () => {
    console.log(`🚀 Server running on port ${port} in ${env} mode`);
    console.log(`🔌 WebSocket disponible en ws://localhost:${port}`);
  });
}

startServer();
