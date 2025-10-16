const { getConnectionStatus, getQRCode, getAllGroups, getGroupById, sendWhatsAppGroupMessage } = require('../services/whatsappService');

function getStatus(req, res) {
  const status = getConnectionStatus();
  res.json(status);
}

function qr(req, res) {
  const data = getQRCode();
  res.json(data);
}

async function logout(req, res) {
  try {
    const result = await logoutWhatsApp();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function groups(req, res) {
  try {
    const result = await getAllGroups();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function groupById(req, res) {
  try {
    const metadata = await getGroupById(req.params.groupId);
    res.status(200).json({
      id: metadata.id,
      name: metadata.subject,
      owner: metadata.owner,
      creation: metadata.creation,
      participants: metadata.participants.length,
      participantsList: metadata.participants,
      desc: metadata.desc || '',
      restrict: metadata.restrict,
      announce: metadata.announce
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function sendMessageToGroupAd(req, res) {
  try {
    const { groupId, text = "", imagePath = "", documentPath = "" } = req.body;

    const result = await sendWhatsAppGroupMessage({ groupId, text, imagePath, documentPath });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
}


module.exports = { getStatus, qr, logout, groups, groupById, sendMessageToGroupAd };
