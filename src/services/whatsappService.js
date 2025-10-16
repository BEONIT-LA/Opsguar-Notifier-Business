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
const path = require("path");


// ===============================================================
//  VARIABLES GLOBALES
// ===============================================================
let sock;           // Conexión activa a WhatsApp
let qrCode = null;  // Último QR generado
let isReady = false; // Estado del socket (conectado o no)
let isConnecting = false;

// ===============================================================
//  FUNCIÓN PRINCIPAL: CONECTAR A WHATSAPP
// ===============================================================
async function connectToWhatsApp() {
  try {
    // Cargar autenticación existente o crear una nueva
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

    // Obtener la versión más reciente de Baileys compatible
    const { version } = await fetchLatestBaileysVersion();

    // Crear el socket de conexión
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Microservicio', 'Chrome', '1.0.0'],
      getMessage: async () => undefined
    });

    //  Manejar eventos del socket
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        console.log('\n Escanea el siguiente QR para vincular WhatsApp:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        console.log(` Conexión cerrada (${reason}). Reconectar: ${shouldReconnect}`);
        isReady = false;

        if (shouldReconnect) setTimeout(connectToWhatsApp, 2000);
      } else if (connection === 'open') {
        console.log('Conectado a WhatsApp correctamente');
        isReady = true;
        qrCode = null;
      }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      console.log('Nuevo evento de mensaje:', type);
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
    message: isReady ? " WhatsApp conectado" : "Esperando autenticación..."
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

function verifyWhatsAppReady(isReady, sock) {
  if (!isReady || !sock) {
    throw new Error('WhatsApp no está listo');
  }
}


async function sendWhatsAppGroupMessage({ groupId, text, imagePath, documentPath }) {
  try {
    // 1. Verificar conexión activa
    verifyWhatsAppReady(isReady, sock);

    // 2. Validar groupId
    if (!groupId || typeof groupId !== 'string' || groupId.trim() === '') {
      throw new Error("El campo 'groupId' es obligatorio y debe ser válido");
    }

    // 3. Normalizar y validar campos
    const cleanText = text && typeof text === 'string' ? text.trim() : '';
    const cleanImagePath = imagePath && typeof imagePath === 'string' ? imagePath.trim() : '';
    const cleanDocPath = documentPath && typeof documentPath === 'string' ? documentPath.trim() : '';

    const hasText = cleanText !== '';
    const hasImage = cleanImagePath !== '';
    const hasDocument = cleanDocPath !== '';

    // 4. Validar que al menos haya un contenido
    if (!hasText && !hasImage && !hasDocument) {
      throw new Error("Debes proporcionar al menos un contenido: texto, imagen o documento");
    }

    const results = [];

    // 5. Enviar texto primero (si hay)
    if (hasText) {
      await sock.sendMessage(groupId, { text: cleanText });
      results.push({ type: "text", status: "ok", message: "Texto enviado correctamente" });
      await delay(1200);
    }

    // 6. Enviar imagen (SIN texto, ya se envió antes)
    if (hasImage) {
      if (!fs.existsSync(cleanImagePath)) {
        throw new Error(`Imagen no encontrada: ${cleanImagePath}`);
      }

      const imageBuffer = fs.readFileSync(cleanImagePath);
      
      if (imageBuffer.length === 0) {
        throw new Error(`La imagen está vacía: ${cleanImagePath}`);
      }

      await sock.sendMessage(groupId, {
        image: imageBuffer,
        fileName: path.basename(cleanImagePath),
      });

      results.push({ type: "image", status: "ok", message: "Imagen enviada correctamente" });
      await delay(1200);
    }

    // 7. Enviar documento (si hay)
    if (hasDocument) {
      if (!fs.existsSync(cleanDocPath)) {
        throw new Error(`Documento no encontrado: ${cleanDocPath}`);
      }

      const docBuffer = fs.readFileSync(cleanDocPath);
      
      if (docBuffer.length === 0) {
        throw new Error(`El documento está vacío: ${cleanDocPath}`);
      }

      await sock.sendMessage(groupId, {
        document: docBuffer,
        fileName: path.basename(cleanDocPath),
        mimetype: "application/pdf",
      });

      results.push({ type: "document", status: "ok", message: "Documento enviado correctamente" });
    }

    // 8. Retornar resultado general
    return {
      success: true,
      message: "Mensajes enviados correctamente",
      groupId,
      details: results,
    };
  } catch (error) {
    throw new Error(`Error al enviar mensaje(s): ${error.message}`);
  }
}


module.exports = {
  connectToWhatsApp,
  getConnectionStatus,
  getQRCode,
  logoutWhatsApp,
  getAllGroups,
  getGroupById,
  sendWhatsAppGroupMessage
};
