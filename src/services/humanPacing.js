/**
 * Ritmo "modo humano" para los envíos de WhatsApp.
 *
 * Un bot envía en cuanto recibe el job y con intervalos idénticos; eso es lo
 * que WhatsApp detecta. Aquí cada envío sigue la secuencia de una persona:
 *
 *   1. Pausa de reacción   (abre el chat, lee)         HUMAN_THINK_MIN/MAX_MS
 *   2. "escribiendo..."     (presencia composing)       según largo del texto
 *   3. Envío
 *   4. Enfriamiento de la sesión antes de otro envío    HUMAN_COOLDOWN_MIN/MAX_MS
 *
 * Los tiempos no son uniformes: se usa una campana (media de 3 aleatorios) y
 * de vez en cuando una pausa larga ("se distrajo"), para que no haya un patrón.
 *
 * HUMAN_MODE=false vuelve al comportamiento anterior (sólo 3–6 s tras enviar).
 */

const { delay } = require('@whiskeysockets/baileys');

function num(name, def) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v >= 0 ? v : def;
}

function loadConfig() {
  return {
    enabled:        String(process.env.HUMAN_MODE ?? 'true').toLowerCase() !== 'false',
    thinkMinMs:     num('HUMAN_THINK_MIN_MS', 1500),
    thinkMaxMs:     num('HUMAN_THINK_MAX_MS', 5000),
    typingCpsMin:   num('HUMAN_TYPING_CPS_MIN', 5),   // caracteres por segundo
    typingCpsMax:   num('HUMAN_TYPING_CPS_MAX', 9),
    typingMinMs:    num('HUMAN_TYPING_MIN_MS', 1200),
    typingMaxMs:    num('HUMAN_TYPING_MAX_MS', 9000),
    cooldownMinMs:  num('HUMAN_COOLDOWN_MIN_MS', 4000),
    cooldownMaxMs:  num('HUMAN_COOLDOWN_MAX_MS', 12000),
    longPauseProb:  num('HUMAN_LONG_PAUSE_PCT', 10) / 100,
  };
}

const config = loadConfig();

/** Aleatorio en campana entre min y max (media de 3 uniformes). */
function humanRandom(min, max, rand = Math.random) {
  if (max <= min) return min;
  const r = (rand() + rand() + rand()) / 3;
  return Math.round(min + r * (max - min));
}

/** A veces la persona tarda bastante más: multiplica x1.5–x2.5. */
function maybeLongPause(ms, cfg = config, rand = Math.random) {
  return rand() < cfg.longPauseProb ? Math.round(ms * (1.5 + rand())) : ms;
}

function thinkMs(cfg = config, rand = Math.random) {
  return maybeLongPause(humanRandom(cfg.thinkMinMs, cfg.thinkMaxMs, rand), cfg, rand);
}

/** Tiempo "escribiendo" proporcional al largo del texto, acotado. */
function typingMs(text, cfg = config, rand = Math.random) {
  const len = (text || '').trim().length;
  const cps = humanRandom(cfg.typingCpsMin, cfg.typingCpsMax, rand) || 1;
  const ms  = Math.round((len / cps) * 1000);
  const jitter = humanRandom(0, 800, rand);
  return Math.min(cfg.typingMaxMs, Math.max(cfg.typingMinMs, ms + jitter));
}

function cooldownMs(cfg = config, rand = Math.random) {
  if (!cfg.enabled) return humanRandom(3000, 6000, rand); // comportamiento previo
  return maybeLongPause(humanRandom(cfg.cooldownMinMs, cfg.cooldownMaxMs, rand), cfg, rand);
}

async function safePresence(sock, type, jid) {
  try { await sock.sendPresenceUpdate(type, jid); } catch (_) { /* la presencia es cosmética */ }
}

/**
 * Antes de cada mensaje: pausa de reacción + "escribiendo...".
 * `text` es lo que se tipearía (texto o caption); vacío → adjunto sin texto,
 * con un "escribiendo" corto.
 */
async function beforeSend(sock, jid, text) {
  if (!config.enabled) return;

  await delay(thinkMs());

  try { await sock.presenceSubscribe(jid); } catch (_) {}
  await safePresence(sock, 'available', jid);
  await safePresence(sock, 'composing', jid);
  await delay(text && text.trim() ? typingMs(text) : humanRandom(800, 2500));
  await safePresence(sock, 'paused', jid);
  await delay(humanRandom(200, 700));
}

/** Pausa entre dos mensajes del mismo job (p. ej. imagen y luego documento). */
async function betweenMessages() {
  await delay(config.enabled ? humanRandom(2000, 6000) : humanRandom(3000, 6000));
}

module.exports = {
  config,
  loadConfig,
  humanRandom,
  thinkMs,
  typingMs,
  cooldownMs,
  beforeSend,
  betweenMessages,
};
