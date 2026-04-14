const sessionManager = require('../services/sessionManager');
const { enqueueMessage, getQueueStats, messageQueue } = require('../services/queueService');
const poolService = require('../services/poolService');

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

function listSessions(req, res) {
  const sessions = sessionManager.getAllSessions();
  const total = Object.keys(sessions).length;
  const ready = Object.values(sessions).filter(s => s.isReady).length;
  return res.json({ success: true, data: { total, ready, sessions } });
}

async function createSession(req, res) {
  try {
    const { sessionId } = req.body;
    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({ success: false, message: "'sessionId' es requerido" });
    }
    const result = await sessionManager.createSession(sessionId.trim());
    if (result?.error) {
      return res.status(409).json({ success: false, message: result.error });
    }
    return res.status(201).json({
      success: true,
      message: 'Sesión creada. Usa GET /api/sessions/:id/qr para obtener el QR.',
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function deleteSession(req, res) {
  try {
    const id = req.params.id;
    await sessionManager.removeSession(id);
    // Fix 3: limpia la sesión de todos los pools automáticamente
    await poolService.removeSessionFromAllPools(id).catch(() => {});
    return res.json({ success: true, message: `Sesión '${id}' eliminada y removida de todos los pools` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function getSessionQR(req, res) {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
  }
  if (session.isReady) {
    return res.json({ success: true, data: { message: 'Sesión ya autenticada, no se necesita QR' } });
  }
  if (session.qrBase64) {
    return res.json({
      success: true,
      data: { sessionId: req.params.id, qrBase64: session.qrBase64 },
    });
  }
  return res.json({
    success: false,
    message: 'QR aún no disponible, reintenta en unos segundos',
  });
}

// ─── ENVÍO VÍA COLA ───────────────────────────────────────────────────────────

async function sendMessage(req, res) {
  try {
    const { groupId, text } = req.body;

    // Archivos subidos via multipart/form-data
    const imageFile    = req.files?.image?.[0]    || null;
    const documentFile = req.files?.document?.[0] || null;

    if (!groupId) {
      return res.status(400).json({ success: false, message: "'groupId' es obligatorio" });
    }
    if (!text && !imageFile && !documentFile) {
      return res.status(400).json({
        success: false,
        message: "Debe enviar al menos uno: 'text', 'image' o 'document'",
      });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida';

    const jobId = await enqueueMessage({
      groupId,
      text:         text         || null,
      imagePath:    imageFile    ? imageFile.path     : null,
      documentPath: documentFile ? documentFile.path  : null,
      imageOriginalName:    imageFile    ? imageFile.originalname    : null,
      documentOriginalName: documentFile ? documentFile.originalname : null,
      _ip: ip,
    });

    return res.status(202).json({
      success: true,
      message: 'Mensaje encolado correctamente.',
      data: { jobId },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function queueStats(req, res) {
  try {
    const stats = await getQueueStats(sessionManager);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GRUPOS (compatibilidad, usa round-robin o ?sessionId=xxx) ────────────────

async function groups(req, res) {
  try {
    const { sessionId } = req.query;
    const session = sessionId
      ? sessionManager.getSession(sessionId)
      : sessionManager.getNextAvailableSession();

    if (!session || !session.isReady || !session.sock) {
      return res.status(503).json({ success: false, message: 'No hay sesiones WhatsApp listas' });
    }

    const raw = await session.sock.groupFetchAllParticipating();
    const list = Object.values(raw).map(g => ({
      id: g.id,
      name: g.subject,
      participantsCount: g.participants.length,
      owner: g.owner,
      creation: g.creation,
      desc: g.desc || '',
    }));
    return res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function groupById(req, res) {
  try {
    const { groupId } = req.params;
    const { sessionId } = req.query;
    const session = sessionId
      ? sessionManager.getSession(sessionId)
      : sessionManager.getNextAvailableSession();

    if (!session || !session.isReady || !session.sock) {
      return res.status(503).json({ success: false, message: 'No hay sesiones WhatsApp listas' });
    }

    const metadata = await session.sock.groupMetadata(groupId);
    return res.json({
      success: true,
      data: {
        id: metadata.id,
        name: metadata.subject,
        owner: metadata.owner,
        creation: metadata.creation,
        participants: metadata.participants.length,
        participantsList: metadata.participants,
        desc: metadata.desc || 'Sin descripción',
        restrict: metadata.restrict,
        announce: metadata.announce,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

async function health(req, res) {
  const sessions = sessionManager.getAllSessions();
  const total = Object.keys(sessions).length;
  const ready = Object.values(sessions).filter(s => s.isReady).length;

  let redisStatus = 'ok';
  try {
    await messageQueue.client.ping();
  } catch (_) {
    redisStatus = 'error';
  }

  const mem = process.memoryUsage();
  return res.json({
    success: true,
    data: {
      status: redisStatus === 'ok' ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      sessions: { total, ready },
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    },
  });
}

// ─── STATUS GLOBAL ────────────────────────────────────────────────────────────

function getStatus(req, res) {
  const sessions = sessionManager.getAllSessions();
  const total = Object.keys(sessions).length;
  const ready = Object.values(sessions).filter(s => s.isReady).length;
  return res.json({
    success: true,
    data: { totalSessions: total, readySessions: ready, sessions },
  });
}

const { readEntries, listDates, getStats } = require('../services/auditService');

async function auditLogs(req, res) {
  try {
    // Paginación real desde la DB
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);

    const [dates, result] = await Promise.all([
      listDates(),
      readEntries({
        date:    req.query.date    || null,
        session: req.query.session || null,
        status:  req.query.status  || null,
        limit,
        offset,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        dates,
        entries: result.rows,
        total:   result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function auditStats(req, res) {
  try {
    const stats = await getStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POOLS ────────────────────────────────────────────────────────────────────

async function listPools(req, res) {
  try {
    const pools = await poolService.listPools();
    return res.json({ success: true, data: pools });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createPool(req, res) {
  try {
    const { name, groupId, sessionIds } = req.body;
    if (!name || !groupId) {
      return res.status(400).json({ success: false, message: "'name' y 'groupId' son obligatorios" });
    }
    const pool = await poolService.createPool({ name, groupId, sessionIds: sessionIds || [] });
    return res.status(201).json({ success: true, data: pool });
  } catch (error) {
    // Duplicate group_id → clave única violada
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ya existe un pool para ese groupId' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function updatePool(req, res) {
  try {
    const { name, groupId, sessionIds } = req.body;
    if (!name || !groupId) {
      return res.status(400).json({ success: false, message: "'name' y 'groupId' son obligatorios" });
    }
    const pool = await poolService.updatePool(req.params.id, { name, groupId, sessionIds: sessionIds || [] });
    if (!pool) return res.status(404).json({ success: false, message: 'Pool no encontrado' });
    return res.json({ success: true, data: pool });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ya existe un pool para ese groupId' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function deletePool(req, res) {
  try {
    await poolService.deletePool(req.params.id);
    return res.json({ success: true, message: 'Pool eliminado' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listSessions,
  createSession,
  deleteSession,
  getSessionQR,
  sendMessage,
  queueStats,
  groups,
  groupById,
  getStatus,
  health,
  auditLogs,
  auditStats,
  listPools,
  createPool,
  updatePool,
  deletePool,
};
