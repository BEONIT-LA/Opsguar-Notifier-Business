<template>
  <div class="tab-page">
    <div class="page-header">
      <div>
        <div class="page-title">Referencia de API</div>
        <div class="page-desc">Todos los endpoints REST disponibles · Base URL: <code class="inline-code">http://localhost:3000/api</code></div>
      </div>
    </div>

    <!-- ── Tokens de API del tenant ── -->
    <div class="tokens-panel">
      <div class="tp-head">
        <div>
          <div class="tp-title">🔑 Tokens de API</div>
          <div class="tp-desc">Autentica tus integraciones con <code class="inline-code">Authorization: Bearer ogt_…</code>. Cada token es de tu empresa y cuenta contra tu cuota.</div>
        </div>
      </div>

      <div class="tp-create">
        <input v-model="newTokenName" placeholder="Nombre del token (ej: integración-CRM)" @keyup.enter="createToken" />
        <button class="btn btn-accent" :disabled="creating" @click="createToken">
          {{ creating ? 'Creando…' : 'Generar token' }}
        </button>
      </div>

      <!-- Token recién creado (se muestra una sola vez) -->
      <div v-if="createdToken" class="tp-new">
        <div class="tp-new-label">⚠ Copia este token ahora — no se volverá a mostrar:</div>
        <div class="tp-new-row">
          <code class="tp-token">{{ createdToken.token }}</code>
          <button class="copy-btn static" @click="copyToken(createdToken.token)">
            {{ tokenCopied ? '✓ Copiado' : 'Copiar' }}
          </button>
        </div>
      </div>

      <div v-if="tokenError" class="tp-error">⚠ {{ tokenError }}</div>

      <!-- Lista de tokens -->
      <div class="tp-list">
        <div v-for="t in tokens" :key="t.id" class="tp-item" :class="{ revoked: t.revoked_at }">
          <div class="tp-item-main">
            <span class="tp-item-name">{{ t.name }}</span>
            <code class="tp-item-prefix">{{ t.prefix }}…</code>
          </div>
          <div class="tp-item-meta">
            <span v-if="t.revoked_at" class="tp-tag revoked">revocado</span>
            <span v-else class="tp-tag active">activo</span>
            <span class="tp-last">{{ t.last_used_at ? 'usado ' + fmt(t.last_used_at) : 'sin uso' }}</span>
            <button v-if="!t.revoked_at" class="tp-revoke" @click="revokeToken(t.id)">Revocar</button>
          </div>
        </div>
        <div v-if="!tokens.length" class="tp-empty">Aún no hay tokens. Genera el primero arriba.</div>
      </div>
    </div>

    <!-- Filtro de sección -->
    <div class="section-tabs">
      <button
        v-for="s in sections"
        :key="s.id"
        class="sec-btn"
        :class="{ active: activeSection === s.id || activeSection === 'all' }"
        @click="activeSection = activeSection === s.id ? 'all' : s.id"
      >
        {{ s.icon }} {{ s.label }}
      </button>
    </div>

    <div class="ep-list">
      <template v-for="section in visibleSections" :key="section.id">
        <div class="ep-section">{{ section.label }}</div>

        <template v-for="ep in section.endpoints" :key="ep.path">
          <!-- Fila del endpoint -->
          <div class="ep" @click="toggle(ep.path)">
            <span class="ep-method" :class="ep.method">{{ ep.method }}</span>
            <span class="ep-path">{{ ep.path }}</span>
            <span class="ep-desc">{{ ep.desc }}</span>
            <span class="ep-chevron">{{ openEps.includes(ep.path) ? '▾' : '▸' }}</span>
          </div>

          <!-- Detalle expandible -->
          <div v-if="openEps.includes(ep.path)" class="ep-body">

            <!-- Campos / parámetros -->
            <template v-for="group in ep.params" :key="group.title">
              <div class="ep-body-title">{{ group.title }}</div>
              <div v-for="f in group.fields" :key="f.name" class="ep-field">
                <span class="ep-fn">{{ f.name }}</span>
                <span class="ep-ft">
                  {{ f.type }}
                  <span v-if="f.required" class="ep-fr">*req</span>
                  <span v-else-if="f.optional" class="ep-fo">opt</span>
                </span>
                <span class="ep-fd" v-html="f.desc"></span>
              </div>
            </template>

            <!-- Ejemplos de código -->
            <template v-if="ep.examples?.length">
              <div class="ep-body-title" style="margin-top:0.75rem">Ejemplos de integración</div>
              <div class="code-tabs">
                <button
                  v-for="ex in ep.examples"
                  :key="ex.lang"
                  class="code-tab-btn"
                  :class="{ active: (activeLang[ep.path] || ep.examples[0].lang) === ex.lang }"
                  @click.stop="activeLang[ep.path] = ex.lang"
                >{{ ex.lang }}</button>
              </div>
              <template v-for="ex in ep.examples" :key="ex.lang">
                <div
                  v-if="(activeLang[ep.path] || ep.examples[0].lang) === ex.lang"
                  class="code-block"
                >
                  <button class="copy-btn" @click.stop="copy(ex.code, ep.path + ex.lang)">
                    {{ copied === ep.path + ex.lang ? '✓ Copiado' : 'Copiar' }}
                  </button>
                  <pre><code>{{ ex.code }}</code></pre>
                </div>
              </template>
            </template>

          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api/axios'

const activeSection = ref('all')
const openEps  = ref([])
const activeLang = reactive({})
const copied   = ref(null)

// ── Tokens de API ───────────────────────────────────────────────
const tokens       = ref([])
const newTokenName = ref('')
const createdToken = ref(null)
const tokenCopied  = ref(false)
const creating     = ref(false)
const tokenError   = ref('')

function fmt(d) { return new Date(d).toLocaleString() }

async function loadTokens() {
  try {
    const { data } = await api.get('/tokens')
    tokens.value = data.data
  } catch (e) {
    tokenError.value = e.response?.data?.message || 'No se pudieron cargar los tokens'
  }
}

async function createToken() {
  if (!newTokenName.value.trim()) { tokenError.value = 'Ponle un nombre al token'; return }
  creating.value = true; tokenError.value = ''
  try {
    const { data } = await api.post('/tokens', { name: newTokenName.value.trim() })
    createdToken.value = data.data
    newTokenName.value = ''
    await loadTokens()
  } catch (e) {
    tokenError.value = e.response?.data?.message || 'Error al crear el token'
  } finally {
    creating.value = false
  }
}

async function revokeToken(id) {
  if (!confirm('¿Revocar este token? Las integraciones que lo usen dejarán de funcionar.')) return
  try { await api.delete(`/tokens/${id}`); await loadTokens() }
  catch (e) { tokenError.value = e.response?.data?.message || 'Error al revocar' }
}

function copyToken(text) {
  navigator.clipboard.writeText(text).then(() => {
    tokenCopied.value = true
    setTimeout(() => { tokenCopied.value = false }, 2000)
  })
}

onMounted(loadTokens)

function toggle(path) {
  const idx = openEps.value.indexOf(path)
  if (idx >= 0) openEps.value.splice(idx, 1)
  else openEps.value.push(path)
}

function copy(text, key) {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = key
    setTimeout(() => { copied.value = null }, 2000)
  })
}

const sections = [
  { id: 'sessions', icon: '📱', label: 'Sesiones' },
  { id: 'messages', icon: '✉️',  label: 'Mensajes' },
  { id: 'groups',   icon: '👥', label: 'Grupos'   },
  { id: 'system',   icon: '⚙️',  label: 'Sistema'  },
  { id: 'audit',    icon: '📋', label: 'Auditoría'},
]

const allSections = [
  {
    id: 'sessions', label: 'Sesiones',
    endpoints: [
      {
        method: 'POST', path: '/sessions', desc: 'Crear nueva sesión WhatsApp',
        params: [
          { title: 'Body · application/json', fields: [
            { name: 'sessionId', type: 'string', required: true, desc: 'Nombre único · ej: <code>numero1</code>' },
          ]},
          { title: 'Respuesta · 201', fields: [
            { name: 'success',        type: 'boolean', desc: '<code>true</code>' },
            { name: 'data.sessionId', type: 'string',  desc: 'ID de la sesión creada' },
          ]},
        ],
      },
      {
        method: 'GET', path: '/sessions', desc: 'Listar todas las sesiones',
        params: [
          { title: 'Respuesta · 200', fields: [
            { name: 'data.total',    type: 'number', desc: 'Total registradas' },
            { name: 'data.ready',    type: 'number', desc: 'Sesiones autenticadas' },
            { name: 'data.sessions', type: 'object', desc: 'Map <code>{ [id]: { status, isReady, phone } }</code>' },
          ]},
        ],
      },
      {
        method: 'DELETE', path: '/sessions/:id', desc: 'Eliminar y desconectar sesión',
        params: [
          { title: 'Path Params', fields: [
            { name: ':id', type: 'string', required: true, desc: 'ID de la sesión · ej: <code>numero1</code>' },
          ]},
          { title: 'Respuesta · 200', fields: [
            { name: 'success', type: 'boolean', desc: '<code>true</code>' },
            { name: 'message', type: 'string',  desc: 'Confirmación' },
          ]},
        ],
      },
      {
        method: 'GET', path: '/sessions/:id/qr', desc: 'Obtener QR como base64',
        params: [
          { title: 'Path Params', fields: [
            { name: ':id', type: 'string', required: true, desc: 'ID de la sesión' },
          ]},
          { title: 'Respuesta · 200', fields: [
            { name: 'data.sessionId', type: 'string', desc: 'ID de la sesión' },
            { name: 'data.qrBase64',  type: 'string', desc: '<code>data:image/png;base64,...</code>' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'messages', label: 'Mensajes',
    endpoints: [
      {
        method: 'POST', path: '/send', desc: 'Encolar mensaje · round-robin automático',
        params: [
          { title: 'Content-Type: multipart/form-data', fields: [
            { name: 'groupId',  type: 'string', required: true, desc: 'ID del grupo · ej: <code>120363xxx@g.us</code>' },
            { name: 'text',     type: 'string', optional: true, desc: 'Texto del mensaje' },
            { name: 'image',    type: 'File',   optional: true, desc: 'Imagen adjunta · JPG, PNG, WEBP, GIF · máx 16 MB' },
            { name: 'document', type: 'File',   optional: true, desc: 'Documento adjunto · PDF, DOC, DOCX · máx 16 MB' },
          ]},
          { title: 'Nota', fields: [
            { name: '—', type: '', desc: 'Al menos uno de <code>text</code>, <code>image</code> o <code>document</code> es obligatorio' },
          ]},
          { title: 'Combinaciones recomendadas', fields: [
            { name: '✅ Ideal',    type: '', desc: '<b>Texto + Imagen</b> — WhatsApp los une en 1 solo mensaje (imagen con caption)' },
            { name: '✅ Ideal',    type: '', desc: '<b>Texto + Documento</b> — WhatsApp los une en 1 solo mensaje (documento con caption)' },
            { name: '⚠ Cuidado', type: '', desc: '<b>Texto + Imagen + Documento</b> — se envían como 2 mensajes separados. Con alto volumen de peticiones pueden llegar desordenados entre sí en el grupo destino.' },
          ]},
          { title: 'Respuesta · 202 Accepted', fields: [
            { name: 'data.jobId', type: 'string', desc: 'ID del job en BullMQ' },
          ]},
        ],
        examples: [
          {
            lang: 'JavaScript',
            code: `// HTML: <input type="file" id="imgInput" />
const file = document.getElementById('imgInput').files[0]

const fd = new FormData()
fd.append('groupId', '120363xxx@g.us')
fd.append('text', 'Hola grupo!')
fd.append('image', file) // el archivo tal cual, sin base64

const res = await fetch('/api/send', { method: 'POST', body: fd })
const { data } = await res.json()
console.log('Job ID:', data.jobId)`,
          },
          {
            lang: 'Axios',
            code: `import axios from 'axios'

const fd = new FormData()
fd.append('groupId', '120363xxx@g.us')
fd.append('text', 'Hola grupo!')
fd.append('image', archivoDelInput)   // File del <input type="file">
fd.append('document', otroArchivo)    // opcional

// axios detecta el FormData y pone multipart automáticamente
const { data } = await axios.post('/api/send', fd)
console.log('Job ID:', data.data.jobId)`,
          },
          {
            lang: 'Node.js',
            code: `const FormData = require('form-data')
const fs = require('fs')
const axios = require('axios')

const fd = new FormData()
fd.append('groupId', '120363xxx@g.us')
fd.append('text', 'Reporte adjunto')
fd.append('document', fs.createReadStream('/ruta/local/reporte.pdf'))

await axios.post('http://tu-servidor/api/send', fd, {
  headers: fd.getHeaders(), // incluye el boundary de multipart
})`,
          },
          {
            lang: 'Python',
            code: `import requests

with open('imagen.jpg', 'rb') as img:
    response = requests.post(
        'http://tu-servidor/api/send',
        data={
            'groupId': '120363xxx@g.us',
            'text': 'Hola grupo!',
        },
        files={
            'image': ('imagen.jpg', img, 'image/jpeg'),
            # 'document': ('reporte.pdf', open('reporte.pdf','rb'), 'application/pdf'),
        }
    )

print(response.json())`,
          },
          {
            lang: 'Python (URL)',
            code: `import requests, io

# Si el archivo está en una URL (S3, CDN, etc.)
archivo = requests.get('https://ejemplo.com/reporte.pdf')

response = requests.post(
    'http://tu-servidor/api/send',
    data={'groupId': '120363xxx@g.us'},
    files={
        'document': ('reporte.pdf', io.BytesIO(archivo.content), 'application/pdf')
    }
)
# No se guarda nada en disco — se pasa directo desde memoria`,
          },
          {
            lang: 'PHP',
            code: `<?php
$curl = curl_init('http://tu-servidor/api/send');

$data = [
    'groupId' => '120363xxx@g.us',
    'text'    => 'Hola grupo!',
    'image'   => new CURLFile('/ruta/local/imagen.jpg', 'image/jpeg', 'imagen.jpg'),
];

curl_setopt($curl, CURLOPT_POST, true);
curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($curl);
curl_close($curl);
echo $response;`,
          },
          {
            lang: 'Postman',
            code: `Método: POST
URL:    http://tu-servidor/api/send

Body → form-data:
  groupId   [Text] → 120363xxx@g.us
  text      [Text] → Hola grupo!       (opcional)
  image     [File] → selecciona imagen  (opcional)
  document  [File] → selecciona PDF     (opcional)

NO uses "raw JSON" — debe ser "form-data"
y el tipo del campo image/document debe ser "File".`,
          },
        ],
      },
      {
        method: 'GET', path: '/queue/stats', desc: 'Estadísticas de la cola BullMQ',
        params: [
          { title: 'Sin parámetros', fields: [] },
          { title: 'Respuesta · 200', fields: [
            { name: 'data.waiting',        type: 'number', desc: 'Jobs esperando' },
            { name: 'data.active',         type: 'number', desc: 'Jobs procesándose' },
            { name: 'data.completed',      type: 'number', desc: 'Completados en cola (últimos 1000)' },
            { name: 'data.totalCompleted', type: 'number', desc: 'Total histórico (Redis persistente)' },
            { name: 'data.totalFailed',    type: 'number', desc: 'Fallidos histórico (Redis persistente)' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'groups', label: 'Grupos',
    endpoints: [
      {
        method: 'GET', path: '/groups', desc: 'Listar grupos de la sesión',
        params: [
          { title: 'Query Params', fields: [
            { name: 'sessionId', type: 'string', optional: true, desc: 'Si se omite → round-robin automático' },
          ]},
          { title: 'Respuesta · 200', fields: [
            { name: 'count',                    type: 'number', desc: 'Total de grupos' },
            { name: 'data[].id',                type: 'string', desc: 'ID · ej: <code>120363xxx@g.us</code>' },
            { name: 'data[].name',              type: 'string', desc: 'Nombre del grupo' },
            { name: 'data[].participantsCount', type: 'number', desc: 'Total de participantes' },
            { name: 'data[].owner',             type: 'string', desc: 'JID del creador' },
          ]},
        ],
      },
      {
        method: 'GET', path: '/group/:groupId', desc: 'Metadata completa de un grupo',
        params: [
          { title: 'Path Params', fields: [
            { name: ':groupId', type: 'string', required: true, desc: 'ID del grupo' },
          ]},
          { title: 'Query Params', fields: [
            { name: 'sessionId', type: 'string', optional: true, desc: 'Sesión específica o round-robin' },
          ]},
          { title: 'Respuesta · 200', fields: [
            { name: 'data.participantsList', type: 'array',   desc: 'Lista completa con JID y rol' },
            { name: 'data.restrict',         type: 'boolean', desc: 'Solo admins pueden enviar' },
            { name: 'data.announce',         type: 'boolean', desc: 'Grupo de solo anuncios' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'system', label: 'Sistema',
    endpoints: [
      {
        method: 'GET', path: '/health', desc: 'Health check completo',
        params: [
          { title: 'Sin parámetros', fields: [] },
          { title: 'Respuesta · 200', fields: [
            { name: 'data.status',            type: 'string', desc: '<code>"ok"</code> | <code>"degraded"</code>' },
            { name: 'data.uptime',            type: 'number', desc: 'Segundos corriendo' },
            { name: 'data.memory.heapUsedMB', type: 'number', desc: 'Heap usado en MB' },
            { name: 'data.redis',             type: 'string', desc: '<code>"ok"</code> | <code>"error"</code>' },
            { name: 'data.timestamp',         type: 'string', desc: 'ISO 8601' },
          ]},
        ],
      },
      {
        method: 'GET', path: '/status', desc: 'Estado global (legacy)',
        params: [
          { title: 'Sin parámetros', fields: [] },
          { title: 'Respuesta · 200', fields: [
            { name: 'data.totalSessions', type: 'number', desc: 'Total de sesiones' },
            { name: 'data.readySessions', type: 'number', desc: 'Sesiones listas' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'audit', label: 'Auditoría',
    endpoints: [
      {
        method: 'GET', path: '/audit', desc: 'Logs de auditoría por día',
        params: [
          { title: 'Query Params', fields: [
            { name: 'date',    type: 'string', optional: true, desc: 'Fecha <code>YYYY-MM-DD</code> · default: hoy' },
            { name: 'session', type: 'string', optional: true, desc: 'Filtrar por sesión' },
            { name: 'status',  type: 'string', optional: true, desc: '<code>completed</code> | <code>failed</code>' },
            { name: 'limit',   type: 'number', optional: true, desc: 'Máx registros por página · default 100, max 500' },
            { name: 'offset',  type: 'number', optional: true, desc: 'Paginación · default 0' },
          ]},
          { title: 'Respuesta · 200', fields: [
            { name: 'data.dates',             type: 'string[]', desc: 'Fechas disponibles (más reciente primero)' },
            { name: 'data.entries[].jobId',   type: 'string',   desc: 'ID del job' },
            { name: 'data.entries[].status',  type: 'string',   desc: '<code>completed</code> | <code>failed</code>' },
            { name: 'data.entries[].ip',      type: 'string',   desc: 'IP de origen de la petición' },
            { name: 'data.entries[].duration',type: 'number',   desc: 'Duración en ms' },
            { name: 'data.total',             type: 'number',   desc: 'Total de registros (para paginación)' },
          ]},
        ],
      },
    ],
  },
]

const visibleSections = computed(() =>
  activeSection.value === 'all'
    ? allSections
    : allSections.filter(s => s.id === activeSection.value)
)
</script>

<style scoped>
.tab-page { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
.page-header { margin-bottom: 1.5rem; }
.page-title  { font-size: 1.15rem; font-weight: 600; }
.page-desc   { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }
.inline-code { font-family: monospace; font-size: 0.78rem; color: var(--cyan); }

/* ── Panel de tokens ── */
.tokens-panel { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.1rem 1.25rem; margin-bottom: 1.5rem; }
.tp-head { margin-bottom: 0.85rem; }
.tp-title { font-size: 0.95rem; font-weight: 600; }
.tp-desc  { font-size: 0.76rem; color: var(--text-dim); margin-top: 0.2rem; }
.tp-create { display: flex; gap: 0.5rem; margin-bottom: 0.85rem; }
.tp-create input { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.55rem 0.8rem; color: var(--text); font-size: 0.85rem; font-family: inherit; outline: none; }
.tp-create input:focus { border-color: var(--accent); }
.btn { border: none; border-radius: var(--radius-sm); padding: 0.55rem 1.1rem; font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-accent { background: var(--accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: var(--accent-hover); }
.btn-accent:disabled { opacity: 0.6; cursor: not-allowed; }

.tp-new { background: var(--green-muted); border: 1px solid rgba(52,211,153,0.3); border-radius: var(--radius-sm); padding: 0.7rem 0.85rem; margin-bottom: 0.85rem; }
.tp-new-label { font-size: 0.74rem; color: var(--green); margin-bottom: 0.45rem; }
.tp-new-row { display: flex; align-items: center; gap: 0.5rem; }
.tp-token { flex: 1; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text); background: var(--bg); padding: 0.45rem 0.65rem; border-radius: 5px; word-break: break-all; }
.copy-btn.static { position: static; }

.tp-error { font-size: 0.78rem; color: var(--red); background: var(--red-muted); padding: 0.45rem 0.7rem; border-radius: var(--radius-sm); margin-bottom: 0.6rem; }

.tp-list { display: flex; flex-direction: column; gap: 0.45rem; }
.tp-item { display: flex; align-items: center; justify-content: space-between; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.55rem 0.8rem; }
.tp-item.revoked { opacity: 0.55; }
.tp-item-main { display: flex; align-items: baseline; gap: 0.6rem; }
.tp-item-name { font-size: 0.85rem; font-weight: 500; }
.tp-item-prefix { font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-dim); }
.tp-item-meta { display: flex; align-items: center; gap: 0.7rem; }
.tp-tag { font-size: 0.62rem; font-weight: 600; padding: 0.1rem 0.5rem; border-radius: 20px; text-transform: uppercase; }
.tp-tag.active  { background: var(--green-muted); color: var(--green); }
.tp-tag.revoked { background: var(--red-muted);   color: var(--red); }
.tp-last { font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono); }
.tp-revoke { background: none; border: 1px solid var(--border); border-radius: 5px; color: var(--text-dim); font-size: 0.72rem; padding: 0.2rem 0.55rem; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.tp-revoke:hover { color: var(--red); border-color: var(--red); }
.tp-empty { font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 0.75rem; }

.section-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.sec-btn {
  padding: 0.3rem 0.75rem; border: 1px solid var(--border); border-radius: 20px;
  background: none; color: var(--text-dim); font-size: 0.78rem; font-family: inherit;
  cursor: pointer; transition: all 0.15s;
}
.sec-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }

.ep-list { display: flex; flex-direction: column; gap: 0.3rem; }
.ep-section { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.07em; padding: 0.75rem 0.2rem 0.3rem; font-weight: 600; }

.ep {
  display: flex; align-items: center; gap: 0.75rem;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.6rem 1rem;
  cursor: pointer; transition: border-color 0.15s;
}
.ep:hover { border-color: var(--border-hi); }

.ep-method { font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 4px; min-width: 52px; text-align: center; }
.ep-method.GET    { color: var(--green);  background: var(--green-muted);  }
.ep-method.POST   { color: var(--accent); background: var(--accent-muted); }
.ep-method.DELETE { color: var(--red);    background: var(--red-muted);    }
.ep-method.PUT    { color: var(--yellow); background: rgba(234,179,8,0.1); }

.ep-path    { font-family: monospace; font-size: 0.82rem; color: var(--text); flex: 1; }
.ep-desc    { font-size: 0.75rem; color: var(--text-dim); }
.ep-chevron { font-size: 0.75rem; color: var(--text-muted); flex-shrink: 0; }

.ep-body {
  background: var(--bg2); border: 1px solid var(--border); border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  padding: 0.85rem 1rem; margin-top: -0.3rem;
  display: flex; flex-direction: column; gap: 0.3rem;
}
.ep-body-title { font-size: 0.67rem; color: var(--text-muted); letter-spacing: 0.08em; margin: 0.4rem 0 0.25rem; text-transform: uppercase; font-weight: 600; }
.ep-body-title:first-child { margin-top: 0; }

.ep-field { display: grid; grid-template-columns: 180px 100px 1fr; gap: 0.75rem; align-items: baseline; padding: 0.15rem 0; }
.ep-fn { font-family: monospace; font-size: 0.8rem; color: var(--text); }
.ep-ft { font-size: 0.72rem; color: var(--cyan); }
.ep-fr { color: var(--red);        font-size: 0.65rem; margin-left: 0.25rem; }
.ep-fo { color: var(--text-muted); font-size: 0.65rem; margin-left: 0.25rem; }
.ep-fd { font-size: 0.75rem; color: var(--text-dim); }

/* Pestañas de código */
.code-tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0; }
.code-tab-btn {
  padding: 0.22rem 0.65rem; border: 1px solid var(--border); border-bottom: none;
  border-radius: 6px 6px 0 0; background: var(--bg3);
  color: var(--text-dim); font-size: 0.72rem; font-family: var(--font-mono, monospace);
  cursor: pointer; transition: all 0.15s;
}
.code-tab-btn.active { background: var(--bg3); color: var(--accent); border-color: var(--accent); }

/* Bloque de código */
.code-block {
  position: relative;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 0 6px 6px 6px;
  overflow: auto;
}
.code-block pre {
  margin: 0;
  padding: 1rem 1.1rem;
  font-size: 0.78rem;
  line-height: 1.65;
  color: var(--text);
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  white-space: pre;
  tab-size: 2;
}
.code-block code { font-family: inherit; }

.copy-btn {
  position: absolute; top: 0.5rem; right: 0.6rem;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text-dim);
  font-size: 0.68rem; padding: 0.18rem 0.5rem;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.copy-btn:hover { color: var(--accent); border-color: var(--accent); }

@media (max-width: 600px) {
  .ep-field { grid-template-columns: 1fr 1fr; }
  .ep-fd    { grid-column: 1/-1; }
  .ep-desc  { display: none; }
}
</style>
