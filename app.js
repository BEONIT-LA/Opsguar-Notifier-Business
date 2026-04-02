const express    = require('express');
const path       = require('path');
const authRoutes = require('./src/routes/authRoutes');
const apiRoutes  = require('./src/routes/whatsappRoutes');
const authMiddleware = require('./src/middleware/authMiddleware');

const app = express();

app.use(express.json());

// ── Archivos estáticos del frontend Vue (compilado con Vite) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth: login público, sin JWT ──────────────────────────────
app.use('/api/auth', authRoutes);

// ── API protegida: requiere JWT válido ────────────────────────
app.use('/api', authMiddleware, apiRoutes);

// ── SPA Fallback: cualquier ruta desconocida → index.html ─────
// Express 5 ya no acepta '*' — se usa '/*splat' en su lugar.
// Necesario para que Vue Router maneje las rutas del frontend.
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
