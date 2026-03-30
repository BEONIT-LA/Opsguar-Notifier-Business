const express = require('express');
const path = require('path');
const routes = require('./src/routes/whatsappRoutes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', routes);

module.exports = app;
