const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const db      = require('../config/database');
const { auth } = require('../config');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', async (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  try {
    const result = await db.query(
      `SELECT id, username, password, role,
              first_name, last_name, email
       FROM users
       WHERE username = $1 AND is_active = true`,
      [user]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const dbUser = result.rows[0];

    const valid = await bcrypt.compare(password, dbUser.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [dbUser.id]);

    // Nombre completo: combina first_name + last_name si existen
    const fullName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(' ') || null;

    const token = jwt.sign(
      { userId: dbUser.id, user: dbUser.username, role: dbUser.role },
      auth.jwtSecret,
      { expiresIn: auth.jwtExpires }
    );

    return res.json({
      success:   true,
      token,
      user:      dbUser.username,
      fullName,
      email:     dbUser.email || null,
      role:      dbUser.role,
      expiresIn: auth.jwtExpires,
    });

  } catch (err) {
    console.error('[Auth] Error en login:', err.message);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// ── Cambiar contraseña (requiere JWT válido) ───────────────────
router.put('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Contraseña actual y nueva requeridas' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const result = await db.query(
      'SELECT id, password FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.userId]);

    return res.json({ success: true, message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    console.error('[Auth] Error cambiando contraseña:', err.message);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
