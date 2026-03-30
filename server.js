const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { port, env } = require('./src/config/index');
const sessionManager = require('./src/services/sessionManager');
const { initSocketHandler } = require('./src/socket/socketHandler');

// Inicia el worker de BullMQ (escucha la cola Redis)
require('./src/workers/messageWorker');

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
