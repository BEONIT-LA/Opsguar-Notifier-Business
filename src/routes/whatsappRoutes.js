const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/whatsappController');
const meCtrl  = require('../controllers/meController');
const { requireJwt } = require('../middleware/tenantContext');
const { uploadSend } = require('../middleware/uploadMiddleware');

// ─── Workspace del responsable ────────────────────────────────
router.get('/me', meCtrl.me);

// Gestión de tokens de API (solo desde el panel, no con token de API)
router.get('/tokens',        requireJwt, meCtrl.listTokens);
router.post('/tokens',       requireJwt, meCtrl.createToken);
router.delete('/tokens/:id', requireJwt, meCtrl.revokeToken);

// ─── Sesiones ─────────────────────────────────────────────────
router.get('/sessions', ctrl.listSessions);
router.post('/sessions', ctrl.createSession);
router.delete('/sessions/:id', ctrl.deleteSession);
router.get('/sessions/:id/qr', ctrl.getSessionQR);

// ─── Envío vía cola Redis (round-robin automático) ────────────
router.post('/send', uploadSend, ctrl.sendMessage);
router.get('/queue/stats', ctrl.queueStats);

// ─── Health check ─────────────────────────────────────────────
router.get('/health', ctrl.health);

// ─── Auditoría ────────────────────────────────────────────────
router.get('/audit', ctrl.auditLogs); // ?date=YYYY-MM-DD &session=xxx &status=completed|failed

// ─── Compatibilidad con endpoints anteriores ──────────────────
router.get('/status', ctrl.getStatus);
router.get('/groups', ctrl.groups);            // ?sessionId=xxx (opcional)
router.get('/group/:groupId', ctrl.groupById); // ?sessionId=xxx (opcional)

// ─── Pools (asignación de sesiones a grupos) ──────────────────
router.get('/pools',        ctrl.listPools);
router.post('/pools',       ctrl.createPool);
router.put('/pools/:id',    ctrl.updatePool);
router.delete('/pools/:id', ctrl.deletePool);

module.exports = router;
