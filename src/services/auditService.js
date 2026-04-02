const fs   = require('fs');
const path = require('path');

const LOGS_DIR = path.resolve('./logs');

function getLogFile(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]; // 2026-03-30
  return path.join(LOGS_DIR, `audit-${dateStr}.json`);
}

/**
 * Escribe una entrada de auditoría en el archivo del día actual.
 * Cada línea es un JSON independiente (NDJSON).
 */
function writeEntry(entry) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    fs.appendFileSync(getLogFile(), line, 'utf8');
  } catch (err) {
    console.error('[Audit] Error escribiendo log:', err.message);
  }
}

/**
 * Lee todas las entradas de un día específico.
 * @param {string} dateStr  formato YYYY-MM-DD
 */
function readEntries(dateStr) {
  const file = path.join(LOGS_DIR, `audit-${dateStr}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    return fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Lista todas las fechas disponibles en logs/, más reciente primero.
 */
function listDates() {
  if (!fs.existsSync(LOGS_DIR)) return [];
  return fs.readdirSync(LOGS_DIR)
    .filter(f => f.startsWith('audit-') && f.endsWith('.json'))
    .map(f => f.replace('audit-', '').replace('.json', ''))
    .sort()
    .reverse();
}

module.exports = { writeEntry, readEntries, listDates };
