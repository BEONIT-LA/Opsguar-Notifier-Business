const jwt = require('jsonwebtoken');
const { auth } = require('../config');

/**
 * Middleware que verifica el JWT en cada petición a /api/*
 * Si el token es válido → continúa (next())
 * Si no → responde 401 Unauthorized
 */
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, auth.jwtSecret);
    req.user = payload; // disponible en los controllers si se necesita
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;
