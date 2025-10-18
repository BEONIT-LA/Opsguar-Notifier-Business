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
        console.log('\nEscanea el siguiente QR para vincular WhatsApp:\n');
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
      console.log(' Nuevo evento de mensaje:', type);
    });

  } catch (error) {
    console.error(' Error conectando a WhatsApp:', error);
    setTimeout(connectToWhatsApp, 5000); // Reintentar conexión
  }
}

function getConnectionStatus() {
  return {
    connected: isReady,
    needsQR: !!qrCode && !isReady,
    message: isReady ? " WhatsApp conectado" : " Esperando autenticación..."
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

    console.log(' Sesión cerrada correctamente');
    setTimeout(connectToWhatsApp, 2000);
    
    return { message: 'Sesión cerrada correctamente' };
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
    throw new Error(`Error al obtener grupos: ${error.message}`);
  }
}

async function getGroupById(groupId) {
  try {
    verifyWhatsAppReady(isReady, sock);
    const metadata = await sock.groupMetadata(groupId);
    return metadata;
  } catch (error) {
    throw new Error(`Error al obtener el grupo por Id: ${error.message}`);
  }
}

function verifyWhatsAppReady(isReady, sock) {
  if (!isReady || !sock) {
    throw new Error('WhatsApp no está listo');
  }
}

/**
 * Envía mensaje con validación independiente de archivos
 * Si la imagen falla, envía el documento. Si el documento falla, envía la imagen.
 */
async function sendWhatsAppGroupMessage({ groupId, text, imagePath, documentPath }) {
  try {
    // 1. Verificar conexión activa
    verifyWhatsAppReady(isReady, sock);

    // 2. Validar groupId
    if (!groupId || typeof groupId !== 'string' || groupId.trim() === '') {
      throw new Error("El campo 'groupId' es obligatorio y debe ser válido");
    }

    // 3. Normalizar campos
    const cleanText = text && typeof text === 'string' ? text.trim() : '';
    const cleanImagePath = imagePath && typeof imagePath === 'string' ? imagePath.trim() : '';
    const cleanDocPath = documentPath && typeof documentPath === 'string' ? documentPath.trim() : '';

    // 4. Validaciones independientes
    const validations = {
      hasText: cleanText !== '',
      hasValidImage: false,
      hasValidDocument: false,
      imageBuffer: null,
      documentBuffer: null
    };

    // VALIDAR IMAGEN (sin enviar aún)
    if (cleanImagePath) {
      try {
        if (fs.existsSync(cleanImagePath)) {
          const buffer = fs.readFileSync(cleanImagePath);
          if (buffer.length > 0) {
            validations.imageBuffer = buffer;
            validations.hasValidImage = true;
            console.log(' Imagen validada:', cleanImagePath);
          } else {
            console.warn(' Imagen vacía:', cleanImagePath);
          }
        } else {
          console.warn(' Imagen no encontrada:', cleanImagePath);
        }
      } catch (error) {
        console.warn(' Error validando imagen:', error.message);
      }
    }

    // VALIDAR DOCUMENTO (sin enviar aún)
    if (cleanDocPath) {
      try {
        if (fs.existsSync(cleanDocPath)) {
          const buffer = fs.readFileSync(cleanDocPath);
          if (buffer.length > 0) {
            validations.documentBuffer = buffer;
            validations.hasValidDocument = true;
            console.log(' Documento validado:', cleanDocPath);
          } else {
            console.warn(' Documento vacío:', cleanDocPath);
          }
        } else {
          console.warn(' Documento no encontrado:', cleanDocPath);
        }
      } catch (error) {
        console.warn(' Error validando documento:', error.message);
      }
    }

    // 5. Verificar que haya al menos algo para enviar
    if (!validations.hasText && !validations.hasValidImage && !validations.hasValidDocument) {
      throw new Error('No hay contenido válido para enviar. Verifica el texto y las rutas de los archivos.');
    }

    // 6. ENVIAR LO QUE SEA VÁLIDO
    const results = {
      sentText: false,
      sentImage: false,
      sentDocument: false,
      details: []
    };

    // Enviar texto
    if (validations.hasText) {
      try {
        await sock.sendMessage(groupId, { text: cleanText });
        results.sentText = true;
        results.details.push({ type: "text", status: "ok" });
        console.log(' Texto enviado');
        await delay(800);
      } catch (error) {
        console.error(' Error enviando texto:', error.message);
      }
    }

    // Enviar imagen (si es válida)
    if (validations.hasValidImage) {
      try {
        await sock.sendMessage(groupId, {
          image: validations.imageBuffer,
          fileName: path.basename(cleanImagePath)
        });
        results.sentImage = true;
        results.details.push({ type: "image", status: "ok" });
        console.log(' Imagen enviada');
        await delay(800);
      } catch (error) {
        console.error(' Error enviando imagen:', error.message);
      }
    }

    // Enviar documento (si es válido)
    if (validations.hasValidDocument) {
      try {
        await sock.sendMessage(groupId, {
          document: validations.documentBuffer,
          fileName: path.basename(cleanDocPath),
          mimetype: "application/pdf"
        });
        results.sentDocument = true;
        results.details.push({ type: "document", status: "ok" });
        console.log(' Documento enviado');
      } catch (error) {
        console.error('Error enviando documento:', error.message);
      }
    }

    // 7. Verificar que se haya enviado al menos algo
    if (!results.sentText && !results.sentImage && !results.sentDocument) {
      throw new Error('No se pudo enviar ningún contenido al grupo');
    }

    // 8. Retornar resultado
    return {
      success: true,
      ...results,
      warnings: {
        imageFailed: !!cleanImagePath && !validations.hasValidImage,
        documentFailed: !!cleanDocPath && !validations.hasValidDocument
      },
      groupId,
      timestamp: Date.now()
    };

  } catch (error) {
    throw error;
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