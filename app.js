const express = require('express');
const statusRoutes = require('./src/routes/whatsappRoutes');

const app = express();

app.use(express.json());
app.use('/api', statusRoutes);

module.exports = app;
