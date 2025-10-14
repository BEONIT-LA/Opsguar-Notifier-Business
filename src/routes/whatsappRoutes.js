const express = require('express');
const { getStatus, qr, logout, groups, groupById, sendMessageToGroup } = require('../controllers/whatsappController');

const router = express.Router();

router.get('/status', getStatus);
router.get('/qr', qr);
router.post('/logout', logout);
router.get('/groups', groups);
router.get('/group/:groupId', groupById);
router.post('/send-to-group', sendMessageToGroup);

module.exports = router;
