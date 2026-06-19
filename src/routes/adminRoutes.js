const express = require('express');
const router  = express.Router();
const admin   = require('../controllers/adminController');

// Montado en /api/admin con authMiddleware + requireSuperadmin (ver app.js)

router.get('/tenants',        admin.listTenants);
router.post('/tenants',       admin.createTenant);
router.get('/tenants/:id',    admin.getTenant);
router.patch('/tenants/:id',  admin.updateTenant);

router.post('/tenants/:id/suspend',        admin.suspendTenant);
router.post('/tenants/:id/activate',       admin.activateTenant);
router.post('/tenants/:id/reset-usage',    admin.resetUsage);
router.post('/tenants/:id/reset-password', admin.resetManagerPassword);

module.exports = router;
