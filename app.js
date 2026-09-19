const express     = require('express');
const path        = require('path');
const authRoutes  = require('./src/routes/authRoutes');
const apiRoutes   = require('./src/routes/whatsappRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const authMiddleware = require('./src/middleware/authMiddleware');
const { requireSuperadmin, requireActiveTenant } = require('./src/middleware/tenantContext');

const app = express();

app.use(express.json());
// Formularios (x-www-form-urlencoded): p. ej. el MCP de OpsGuard o `curl -d`.
// Sin esto Express 5 deja req.body undefined y /api/send responde 500.
app.use(express.urlencoded({ extended: false }));

// ── Archivos estáticos del frontend Vue (compilado con Vite) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth: login público, sin JWT ──────────────────────────────
app.use('/api/auth', authRoutes);

// ── Admin de plataforma: requiere JWT + rol superadmin ─────────
// (se monta ANTES de /api para que matchee primero)
app.use('/api/admin', authMiddleware, requireSuperadmin, adminRoutes);

// ── Workspace del tenant: requiere JWT/token de API + tenant activo ──
app.use('/api', authMiddleware, requireActiveTenant, apiRoutes);

// ── SPA Fallback: cualquier ruta desconocida → index.html ─────
// Express 5 ya no acepta '*' — se usa '/*splat' en su lugar.
// Necesario para que Vue Router maneje las rutas del frontend.
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
