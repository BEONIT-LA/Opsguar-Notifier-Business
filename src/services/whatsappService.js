const qrcode = require('qrcode-terminal');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys');

// ===============================================================
// 🔹 VARIABLES GLOBALES
// ===============================================================
let sock;           // Conexión activa a WhatsApp
let qrCode = null;  // Último QR generado
let isReady = false; // Estado del socket (conectado o no)
let isConnecting = false;

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

function getConnectionStatus() {
  return {
    connected: isReady,
    needsQR: !!qrCode && !isReady,
    message: isReady ? "✅ WhatsApp conectado" : "⏳ Esperando autenticación..."
  };
}

function getQRCode() {
  if (qrCode) {
    return { qr: qrCode };
  }
  if (isReady) {
    return { message: "Ya autenticado" };
  }
  return { message: "Generando QR, intenta nuevamente" };
}


async function logoutWhatsApp() {
  try {
    if (!sock) throw new Error('No hay sesión activa');

    await sock.logout();
    fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
    isReady = false;
    qrCode = null;

    return { message: 'Sesión cerrada correctamente' };
    setTimeout(connectToWhatsApp, 2000);
  } catch (error) {
    throw new Error(`Error cerrando sesión: ${error.message}`);
  }

}

async function getAllGroups() {
  try {
   verifyWhatsAppReady(isReady, sock);

    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      participantsCount: g.participants.length,
      owner: g.owner,
      creation: g.creation,
      desc: g.desc || ''
    }));

    return list;
  } catch (error) {
    throw new Error(`Error al obtener el grupo: ${error.message}`);
  }

}

async function getGroupById(groupId) {
  try {
    verifyWhatsAppReady(isReady, sock);
    const metadata = await sock.groupMetadata(groupId);
    return metadata;
  } catch (error) {
    throw new Error(`Error al obtener el grupo por Id : ${error.message}`);
  }

}


async function sendToGroup(groupId, message) {
  try {
    verifyWhatsAppReady(isReady, sock);
    await sock.sendMessage(groupId, message);
    return { success: true, groupId, message, status: 'Mensaje enviado' };
  } catch (error) {
    throw new Error(`Error al enviar el mensaje al grupo: ${error.message}`);
  }

}

function verifyWhatsAppReady(isReady, sock) {
  if (!isReady || !sock) {
    throw new Error('WhatsApp no está listo');
  }
}


module.exports = {
  connectToWhatsApp,
  getConnectionStatus,
  getQRCode,
  logoutWhatsApp,
  getAllGroups,
  getGroupById,
  sendToGroup
};
