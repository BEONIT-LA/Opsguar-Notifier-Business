/**
 * Media Type de Zabbix (integrations/zabbix): el script del YAML es idéntico a
 * webhook.js, es ES5 (Duktape) y se comporta bien ante cada respuesta de la API.
 * Se ejecuta en un sandbox con HttpRequest y Zabbix simulados, como en Zabbix.
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const DIR    = path.join(__dirname, '../integrations/zabbix');
// Normaliza CRLF (checkout en Windows) para comparar con el YAML.
const SCRIPT = fs.readFileSync(path.join(DIR, 'webhook.js'), 'utf8').replace(/\r\n/g, '\n');
const YAML   = fs.readFileSync(path.join(DIR, 'mediatype-opsguar-notifier-business.yaml'), 'utf8');

/** Bloque literal `script: |` del YAML, sin la sangría de 8 espacios. */
function scriptFromYaml(yaml) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex(l => /^\s{6}script: \|$/.test(l)) + 1;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    if (lines[i] !== '' && !lines[i].startsWith('        ')) break;
    out.push(lines[i].slice(8));
  }
  return out.join('\n').trimEnd();
}

/** Ejecuta el webhook como Zabbix: `value` = JSON de parámetros. */
function run(params, { status = 202, body = '{"success":true,"data":{"jobId":"42"}}' } = {}) {
  const calls = { headers: [], url: null, payload: null, proxy: null };
  class HttpRequest {
    addHeader(h) { calls.headers.push(h); }
    setProxy(p)  { calls.proxy = p; }
    post(url, payload) { calls.url = url; calls.payload = payload; return body; }
    getStatus()  { return status; }
  }
  const logs = [];
  const sandbox = { HttpRequest, Zabbix: { log: (lvl, msg) => logs.push([lvl, msg]) }, value: JSON.stringify(params) };
  vm.createContext(sandbox);
  let result, error;
  try { result = vm.runInContext(`(function () {\n${SCRIPT}\n})()`, sandbox); }
  catch (e) { error = String(e); }
  return { result, error, calls, logs };
}

const OK_PARAMS = {
  URL: 'https://notificaciones.beonit.la/api/send',
  Token: 'ogt_abc123',
  GroupId: '120363413470755732@g.us',
  Subject: '🔴 High: CPU alta',
  Message: 'Host: srv01',
  HTTPProxy: '',
};

describe('Media Type Zabbix — archivo', () => {
  test('el script del YAML es idéntico a webhook.js', () => {
    expect(scriptFromYaml(YAML)).toBe(SCRIPT.trimEnd());
  });

  test('sólo ES5 (Duktape): sin let/const, arrow functions ni template literals', () => {
    const code = SCRIPT.replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    expect(code).not.toMatch(/\b(let|const|class)\s/);
    expect(code).not.toMatch(/=>/);
    expect(code).not.toMatch(/`/);
  });

  test('el token va en macro secreta, no pegado en el YAML', () => {
    expect(YAML).toMatch(/name: Token\n\s+value: '\{\$OPSGUARD\.TOKEN\}'/);
    expect(YAML).not.toMatch(/ogt_[A-Za-z0-9]/);
  });
});

describe('Media Type Zabbix — comportamiento', () => {
  test('202 → POST JSON con Bearer, asunto + mensaje, devuelve el jobId', () => {
    const r = run(OK_PARAMS);
    expect(r.error).toBeUndefined();
    expect(r.result).toBe('OK (job 42)');
    expect(r.calls.url).toBe(OK_PARAMS.URL);
    expect(r.calls.headers).toEqual(['Content-Type: application/json', 'Authorization: Bearer ogt_abc123']);
    expect(JSON.parse(r.calls.payload)).toEqual({
      groupId: OK_PARAMS.GroupId,
      text: '🔴 High: CPU alta\n\nHost: srv01',
    });
  });

  test('el token nunca aparece en el log', () => {
    const r = run(OK_PARAMS);
    expect(JSON.stringify(r.logs)).not.toContain('ogt_abc123');
  });

  test.each([
    [401, 'Token de API invalido'],
    [402, 'Cuota de mensajes agotada'],
    [403, 'suspendida o fuera de vigencia'],
    [500, 'HTTP 500'],
    [0,   'Sin respuesta'],
  ])('HTTP %i → error legible para el Action log', (status, texto) => {
    const r = run(OK_PARAMS, { status, body: '{"success":false,"message":"detalle API"}' });
    expect(r.error).toMatch(/^Envio fallido: HTTP/);
    expect(r.error).toContain(texto);
  });

  test('macro de token sin definir → error claro, no llama a la API', () => {
    const r = run({ ...OK_PARAMS, Token: '{$OPSGUARD.TOKEN}' });
    expect(r.error).toContain('{$OPSGUARD.TOKEN}');
    expect(r.calls.url).toBeNull();
  });

  test('Send to vacío o que no es grupo → error claro', () => {
    expect(run({ ...OK_PARAMS, GroupId: '' }).error).toContain('Send to');
    expect(run({ ...OK_PARAMS, GroupId: '50499999999@s.whatsapp.net' }).error).toContain('@g.us');
  });

  test('texto larguísimo se recorta a 8000 caracteres (tope de seguridad)', () => {
    const r = run({ ...OK_PARAMS, Subject: '', Message: 'x'.repeat(9000) });
    expect(JSON.parse(r.calls.payload).text).toHaveLength(8000);
  });

  test('proxy opcional se aplica', () => {
    expect(run({ ...OK_PARAMS, HTTPProxy: 'http://proxy:3128' }).calls.proxy).toBe('http://proxy:3128');
  });
});
