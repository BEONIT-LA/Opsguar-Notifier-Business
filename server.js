const app = require('./app');
const { port, env } = require('./src/config/index');
const { connectToWhatsApp } = require('./src/services/whatsappService');

async function startServer() {
  await connectToWhatsApp();

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port} in ${env} mode`);
  });
}

startServer();