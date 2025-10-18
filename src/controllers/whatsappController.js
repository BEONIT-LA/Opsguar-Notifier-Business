const { getConnectionStatus, getQRCode, getAllGroups, getGroupById, sendWhatsAppGroupMessage, logoutWhatsApp } = require('../services/whatsappService');

/**
 * Obtiene el estado de conexión de WhatsApp
 * @route GET /api/whatsapp/status
 */
function getStatus(req, res) {
  try {
    const status = getConnectionStatus();
    
    if (status.connected) {
      return res.status(200).json({
        success: true,
        message: "WhatsApp conectado exitosamente",
        statusCode: 200,
        data: status
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "WhatsApp desconectado - Por favor escanea el código QR",
        statusCode: 200,
        data: status
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtener el estado de conexión",
      statusCode: 500,
      error: error.message
    });
  }
}

/**
 * Obtiene el código QR para autenticación
 * @route GET /api/whatsapp/qr
 */
function qr(req, res) {
  try {
    const data = getQRCode();
    
    if (data.qr) {
      return res.status(200).json({
        success: true,
        message: "Código QR generado - Escanea con WhatsApp",
        statusCode: 200,
        data: data
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "Código QR no disponible - Posible sesión activa",
        statusCode: 200,
        data: data
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al generar el código QR",
      statusCode: 500,
      error: error.message
    });
  }
}

/**
 * Cierra la sesión de WhatsApp
 * @route POST /api/whatsapp/logout
 */
async function logout(req, res) {
  try {
    const result = await logoutWhatsApp();
    
    return res.status(200).json({
      success: true,
      message: "Sesión de WhatsApp cerrada correctamente",
      statusCode: 200,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al cerrar sesión de WhatsApp",
      statusCode: 500,
      error: error.message
    });
  }
}

/**
 * Obtiene todos los grupos de WhatsApp
 * @route GET /api/whatsapp/groups
 */
async function groups(req, res) {
  try {
    const result = await getAllGroups();
    const groupCount = Array.isArray(result) ? result.length : 0;
    
    return res.status(200).json({
      success: true,
      message: `${groupCount} grupo(s) encontrado(s) exitosamente`,
      statusCode: 200,
      count: groupCount,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtener los grupos de WhatsApp",
      statusCode: 500,
      error: error.message
    });
  }
}

/**
 * Obtiene información detallada de un grupo específico
 * @route GET /api/whatsapp/group/:groupId
 */
async function groupById(req, res) {
  try {
    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "El parámetro 'groupId' es requerido",
        statusCode: 400
      });
    }

    const metadata = await getGroupById(groupId);
    
    return res.status(200).json({
      success: true,
      message: `Información del grupo "${metadata.subject}" obtenida correctamente`,
      statusCode: 200,
      data: {
        id: metadata.id,
        name: metadata.subject,
        owner: metadata.owner,
        creation: metadata.creation,
        participants: metadata.participants.length,
        participantsList: metadata.participants,
        desc: metadata.desc || 'Sin descripción',
        restrict: metadata.restrict,
        announce: metadata.announce
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error al obtener información del grupo",
      statusCode: 500,
      error: error.message
    });
  }
}

/**
 * Envía un mensaje a un grupo de WhatsApp
 * @route POST /api/whatsapp/send-messages-group
 */
async function sendMessageToGroupAd(req, res) {
  try {
    const { groupId, text = "", imagePath = "", documentPath = "" } = req.body;

    // Validación de parámetros requeridos
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "El parámetro 'groupId' es obligatorio",
        statusCode: 400
      });
    }

    // Validación de contenido
    if (!text && !imagePath && !documentPath) {
      return res.status(400).json({
        success: false,
        message: "Debe proporcionar al menos un contenido: text, imagePath o documentPath",
        statusCode: 400
      });
    }

    const result = await sendWhatsAppGroupMessage({ groupId, text, imagePath, documentPath });
    
    // Construir mensaje detallado según lo que se envió
    const sentItems = [];
    if (result.sentText) sentItems.push("texto");
    if (result.sentImage) sentItems.push("imagen");
    if (result.sentDocument) sentItems.push("documento");
    
    let detailMessage = sentItems.length > 0 
      ? `Mensaje enviado exitosamente: ${sentItems.join(", ")}` 
      : "Mensaje enviado al grupo";

    // Agregar advertencias si hubo fallos
    const warnings = [];
    if (result.warnings?.imageFailed) warnings.push("imagen no encontrada");
    if (result.warnings?.documentFailed) warnings.push("documento no encontrado");
    
    if (warnings.length > 0) {
      detailMessage += ` (Advertencia: ${warnings.join(", ")})`;
    }
    
    return res.status(200).json({
      success: true,
      message: detailMessage,
      statusCode: 200,
      data: result
    });
  } catch (error) {
    console.error('❌ Error al enviar mensaje al grupo:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Identificar tipos de errores comunes
    let customMessage = "Error al enviar el mensaje al grupo";
    
    if (error.message.includes('WhatsApp no está listo')) {
      customMessage = "WhatsApp no está conectado. Por favor escanea el QR primero";
    } else if (error.message.includes('No hay contenido válido')) {
      customMessage = "No hay contenido válido para enviar. Verifica el texto y las rutas de los archivos";
    } else if (error.message.includes('No se pudo enviar ningún contenido')) {
      customMessage = "No se pudo enviar ningún contenido al grupo. Verifica la conexión";
    } else if (error.message.includes('not found') || error.message.includes('Chat not found')) {
      customMessage = "El grupo no existe o no tienes acceso";
    } else if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
      customMessage = "El archivo (imagen/documento) no se encontró en la ruta especificada";
    } else if (error.message.includes('Permission denied')) {
      customMessage = "No tienes permisos para enviar mensajes en este grupo";
    }
    
    return res.status(500).json({
      success: false,
      message: customMessage,
      statusCode: 500,
      error: error.message,
      errorType: error.name,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

module.exports = { 
  getStatus, 
  qr, 
  logout, 
  groups, 
  groupById, 
  sendMessageToGroupAd 
};