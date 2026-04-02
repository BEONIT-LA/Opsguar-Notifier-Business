const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsappController');

// ─── Sesiones ─────────────────────────────────────────────────
router.get('/sessions', ctrl.listSessions);
router.post('/sessions', ctrl.createSession);
router.delete('/sessions/:id', ctrl.deleteSession);
router.get('/sessions/:id/qr', ctrl.getSessionQR);

// ─── Envío vía cola Redis (round-robin automático) ────────────
router.post('/send', ctrl.sendMessage);
router.get('/queue/stats', ctrl.queueStats);

// ─── Health check ─────────────────────────────────────────────
router.get('/health', ctrl.health);

// ─── Auditoría ────────────────────────────────────────────────
router.get('/audit', ctrl.auditLogs); // ?date=YYYY-MM-DD &session=xxx &status=completed|failed

// ─── Compatibilidad con endpoints anteriores ──────────────────
router.get('/status', ctrl.getStatus);
router.get('/groups', ctrl.groups);            // ?sessionId=xxx (opcional)
router.get('/group/:groupId', ctrl.groupById); // ?sessionId=xxx (opcional)

module.exports = router;
