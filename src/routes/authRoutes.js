const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { auth } = require('../config');

/**
 * POST /api/auth/login
 * Body: { user: string, password: string }
 * Respuesta: { success: true, token: string, user: string }
 */
router.post('/login', (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  // Verificar credenciales contra .env
  // (en la siguiente fase esto vendrá de la base de datos)
  if (user !== auth.adminUser || password !== auth.adminPass) {
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }

  // Generar token JWT con expiración configurada en .env
  const token = jwt.sign(
    { user, role: 'admin' },
    auth.jwtSecret,
    { expiresIn: auth.jwtExpires }
  );

  return res.json({
    success: true,
    token,
    user,
    expiresIn: auth.jwtExpires,
  });
});

module.exports = router;
