const express = require('express');
const { getStatus, qr, logout, groups, groupById, sendMessageToGroupAd } = require('../controllers/whatsappController');



const router = express.Router();

router.get('/status', getStatus);
router.get('/qr', qr);
router.post('/logout', logout);
router.get('/groups', groups);
router.get('/group/:groupId', groupById);
router.post('/send-messages-group', sendMessageToGroupAd);


module.exports = router;
