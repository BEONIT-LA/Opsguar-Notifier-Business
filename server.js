// ===============================================================
// 🚀 MICRO SERVICIO WHATSAPP API (BAILEYS + EXPRESS)
// ===============================================================
// Autor: Jefferson Tambaco
// Descripción: API REST para enviar mensajes, imágenes y documentos 
//              a grupos de WhatsApp usando Baileys.
// ===============================================================

// ===============================================================
// 🔹 IMPORTACIONES Y CONFIGURACIÓN INICIAL
// ===============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { 
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys');

// ===============================================================
// 🔹 CONFIGURACIÓN DEL SERVIDOR EXPRESS
// ===============================================================
const app = express();
app.use(express.json()); // Permitir peticiones con cuerpo JSON

// ===============================================================
// 🔹 VARIABLES GLOBALES
// ===============================================================
let sock;           // Conexión activa a WhatsApp
let qrCode = null;  // Último QR generado
let isReady = false; // Estado del socket (conectado o no)

// ===============================================================
// 🔹 FUNCIÓN PRINCIPAL: CONECTAR A WHATSAPP
// ===============================================================
async function connectToWhatsApp() {
  try {
    // 1️⃣ Cargar autenticación existente o crear una nueva
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

    // 2️⃣ Obtener la versión más reciente de Baileys compatible
    const { version } = await fetchLatestBaileysVersion();

    // 3️⃣ Crear el socket de conexión
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Microservicio', 'Chrome', '1.0.0'],
      getMessage: async () => undefined
    });

    // 4️⃣ Manejar eventos del socket
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        console.log('\n📱 Escanea el siguiente QR para vincular WhatsApp:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        console.log(`❌ Conexión cerrada (${reason}). Reconectar: ${shouldReconnect}`);
        isReady = false;

        if (shouldReconnect) setTimeout(connectToWhatsApp, 2000);
      } else if (connection === 'open') {
        console.log('✅ Conectado a WhatsApp correctamente');
        isReady = true;
        qrCode = null;
      }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      console.log('📩 Nuevo evento de mensaje:', type);
    });

  } catch (error) {
    console.error('Error conectando a WhatsApp:', error);
    setTimeout(connectToWhatsApp, 5000); // Reintentar conexión
  }
}

// ===============================================================
// 🔹 INICIAR CONEXIÓN
// ===============================================================
connectToWhatsApp();

// ===============================================================
// 🔹 ENDPOINTS - ESTADO Y AUTENTICACIÓN
// ===============================================================

// GET /status - Estado actual de la conexión
app.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    needsQR: !!qrCode,
    message: isReady ? '✅ WhatsApp conectado' : '⏳ Esperando autenticación...'
  });
});

// GET /qr - Obtener código QR actual
app.get('/qr', (req, res) => {
  if (qrCode) return res.json({ qr: qrCode });
  if (isReady) return res.json({ message: 'Ya autenticado' });
  res.json({ message: 'Generando QR, intenta nuevamente' });
});

// POST /logout - Cerrar sesión actual
app.post('/logout', async (req, res) => {
  try {
    if (!sock) return res.json({ message: 'No hay sesión activa' });

    await sock.logout();
    fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
    isReady = false;
    qrCode = null;

    res.json({ message: 'Sesión cerrada correctamente' });
    setTimeout(connectToWhatsApp, 2000);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// 🔹 ENDPOINTS - GRUPOS
// ===============================================================

// GET /groups - Listar todos los grupos
app.get('/groups', async (req, res) => {
  try {
    if (!isReady || !sock) return res.status(503).json({ error: 'WhatsApp no está listo' });

    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      participantsCount: g.participants.length,
      owner: g.owner,
      creation: g.creation,
      desc: g.desc || ''
    }));

    res.json({ groups: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /group/:groupId - Detalle de un grupo específico
app.get('/group/:groupId', async (req, res) => {
  try {
    if (!isReady || !sock) return res.status(503).json({ error: 'WhatsApp no está listo' });

    const metadata = await sock.groupMetadata(req.params.groupId);
    res.json({
      id: metadata.id,
      name: metadata.subject,
      owner: metadata.owner,
      creation: metadata.creation,
      participants: metadata.participants.length,
      participantsList: metadata.participants,
      desc: metadata.desc || '',
      restrict: metadata.restrict,
      announce: metadata.announce
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// 🔹 ENDPOINTS - ENVÍO DE MENSAJES
// ===============================================================

// POST /send-to-group - Enviar mensaje a un solo grupo
app.post('/send-to-group', async (req, res) => {
  try {
    if (!isReady || !sock) return res.status(503).json({ error: 'WhatsApp no está listo' });
    const { groupId, message } = req.body;
    if (!groupId || !message) return res.status(400).json({ error: 'Faltan parámetros' });

    await sock.sendMessage(groupId, { text: message });
    res.json({ success: true, message: 'Mensaje enviado correctamente', groupId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /send-to-multiple-groups - Envío masivo a varios grupos
app.post('/send-to-multiple-groups', async (req, res) => {
  try {
    if (!isReady || !sock) return res.status(503).json({ error: 'WhatsApp no está listo' });
    const { groupIds, message, delayMs = 2000 } = req.body;
    if (!Array.isArray(groupIds) || !message) return res.status(400).json({ error: 'Parámetros inválidos' });

    const results = [];
    for (const id of groupIds) {
      try {
        await sock.sendMessage(id, { text: message });
        results.push({ id, success: true });
        await delay(delayMs);
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }

    res.json({
      total: groupIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// 🔹 ENDPOINTS - ENVÍO DE ARCHIVOS (IMÁGENES / DOCUMENTOS)
// ===============================================================

// POST /send-image - Enviar imagen a un grupo
app.post('/send-image', async (req, res) => {
  try {
    if (!isReady || !sock) return res.status(503).json({ error: 'WhatsApp no está listo' });
    const { groupId, imagePath, caption } = req.body;

    if (!groupId || !imagePath) return res.status(400).json({ error: 'Faltan parámetros' });
    if (!fs.existsSync(imagePath)) return res.status(404).json({ error: 'Archivo no encontrado' });

    const buffer = fs.readFileSync(imagePath);
    await sock.sendMessage(groupId, { image: buffer, caption: caption || '' });
    res.json({ success: true, message: 'Imagen enviada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /send-document - Enviar documento (PDF, Excel, etc.)
app.post('/send-document', async (req, res) => {
  try {
    if (!isReady || !sock) return res.status(503).json({ error: 'WhatsApp no está listo' });
    const { groupId, filePath, fileName } = req.body;

    if (!groupId || !filePath) return res.status(400).json({ error: 'Faltan parámetros' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });

    const buffer = fs.readFileSync(filePath);
    const name = fileName || path.basename(filePath);

    await sock.sendMessage(groupId, {
      document: buffer,
      fileName: name,
      mimetype: 'application/pdf'
    });

    res.json({ success: true, message: 'Documento enviado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================================================
// 🔹 MANEJO GLOBAL DE ERRORES
// ===============================================================
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ===============================================================
// 🔹 INICIAR SERVIDOR
// ===============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp corriendo en http://localhost:${PORT}`);
  console.log(`📊 Estado: http://localhost:${PORT}/status`);
  console.log(`📱 QR: http://localhost:${PORT}/qr`);
  console.log(`⏳ Esperando conexión...`);
});
