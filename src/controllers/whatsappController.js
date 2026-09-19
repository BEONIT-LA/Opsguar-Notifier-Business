const sessionManager = require('../services/sessionManager');
const { enqueueMessage, getQueueStats, messageQueue } = require('../services/queueService');
const poolService = require('../services/poolService');
const tenantService = require('../services/tenantService');
const waSessionService = require('../services/waSessionService');

// Todas las operaciones de este controller están scopeadas al tenant del
// request (req.tenantId), que deja authMiddleware (JWT o token de API) y
// valida tenantContext.requireActiveTenant antes de llegar aquí.

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

function listSessions(req, res) {
  const sessions = sessionManager.getAllSessions(req.tenantId);
  const total = Object.keys(sessions).length;
  const ready = Object.values(sessions).filter(s => s.isReady).length;
  return res.json({ success: true, data: { total, ready, sessions } });
}

async function createSession(req, res) {
  try {
    const { sessionId, label } = req.body;
    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({ success: false, message: "'sessionId' es requerido" });
    }

    // Tope de sesiones del tenant (max_sessions). Solo cuenta sesiones nuevas.
    const tenant = req.tenant;
    const id = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const yaExiste = !!sessionManager.getSession(req.tenantId, id);
    if (!yaExiste && tenant && sessionManager.countSessions(req.tenantId) >= tenant.max_sessions) {
      return res.status(403).json({
        success: false,
        message: `Límite de sesiones alcanzado (${tenant.max_sessions}). Elimina una sesión o pide al administrador ampliar el cupo.`,
      });
    }

    const result = await sessionManager.createSession(req.tenantId, id);
    if (result?.error) {
      return res.status(409).json({ success: false, message: result.error });
    }

    await waSessionService.register(req.tenantId, result.sessionId, label || null).catch(() => {});

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
    await sessionManager.removeSession(req.tenantId, id);
    // Limpia la sesión de todos los pools del tenant y de la tabla
    await poolService.removeSessionFromAllPools(req.tenantId, id).catch(() => {});
    await waSessionService.remove(req.tenantId, id).catch(() => {});
    return res.json({ success: true, message: `Sesión '${id}' eliminada y removida de todos los pools` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

function getSessionQR(req, res) {
  const session = sessionManager.getSession(req.tenantId, req.params.id);
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
    const { groupId, text } = req.body || {};

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

    // ── Validar cuota / vigencia del tenant ANTES de encolar ──
    const check = await tenantService.checkCanSend(req.tenantId);
    if (!check.ok) {
      const map = {
        suspended:      [403, 'La empresa está suspendida'],
        not_started:    [403, 'La vigencia de la empresa aún no comienza'],
        expired:        [403, 'La vigencia de la empresa ha expirado'],
        quota_exceeded: [402, 'Cuota de mensajes agotada'],
        tenant_not_found: [404, 'Tenant no encontrado'],
      };
      const [code, message] = map[check.reason] || [403, 'No autorizado para enviar'];
      return res.status(code).json({ success: false, message, reason: check.reason });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida';

    const jobId = await enqueueMessage({
      tenantId:     req.tenantId,
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
    const stats = await getQueueStats(req.tenantId, sessionManager);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── GRUPOS (usa round-robin del tenant o ?sessionId=xxx) ─────────────────────

async function groups(req, res) {
  try {
    const { sessionId } = req.query;
    const session = sessionId
      ? sessionManager.getSession(req.tenantId, sessionId)
      : sessionManager.getNextAvailableSession(req.tenantId);

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
      ? sessionManager.getSession(req.tenantId, sessionId)
      : sessionManager.getNextAvailableSession(req.tenantId);

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
  const sessions = sessionManager.getAllSessions(req.tenantId);
  const total = Object.keys(sessions).length;
  const ready = Object.values(sessions).filter(s => s.isReady).length;

  let redisStatus = 'ok';
  try {
    await (await messageQueue.client).ping();
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

// ─── STATUS GLOBAL (del tenant) ───────────────────────────────────────────────

function getStatus(req, res) {
  const sessions = sessionManager.getAllSessions(req.tenantId);
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
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);

    const [dates, result] = await Promise.all([
      listDates(req.tenantId),
      readEntries({
        tenantId: req.tenantId,
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
    const stats = await getStats(req.tenantId);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── POOLS ────────────────────────────────────────────────────────────────────

async function listPools(req, res) {
  try {
    const pools = await poolService.listPools(req.tenantId);
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
    const pool = await poolService.createPool(req.tenantId, { name, groupId, sessionIds: sessionIds || [] });
    return res.status(201).json({ success: true, data: pool });
  } catch (error) {
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
    const pool = await poolService.updatePool(req.tenantId, req.params.id, { name, groupId, sessionIds: sessionIds || [] });
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
    await poolService.deletePool(req.tenantId, req.params.id);
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
