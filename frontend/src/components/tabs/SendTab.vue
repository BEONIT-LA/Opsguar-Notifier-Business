<template>
  <div class="tab-page">
    <div class="page-header">
      <div>
        <div class="page-title">Enviar Mensaje</div>
        <div class="page-desc">La sesión se asigna automáticamente · round-robin entre sesiones listas</div>
      </div>
    </div>

    <div class="send-layout">
      <!-- Formulario -->
      <div class="send-card">
        <div class="ci" style="background:var(--accent-muted);color:var(--accent)">📨</div>
        <div class="card-title" style="margin-bottom:1.25rem">Nuevo mensaje</div>

        <form @submit.prevent="sendMessage" class="send-form">

          <div class="field-group">
            <label class="field-label">ID del Grupo <span class="req">*</span></label>
            <input v-model="form.groupId" class="field-input" placeholder="120363xxxxxxxx@g.us" required />
            <div class="field-hint">Obtén el ID en la pestaña Grupos</div>

            <!-- Indicador de pool dinámico -->
            <transition name="slide">
              <div v-if="form.groupId.length > 10" class="pool-status" :class="activePool ? 'has-pool' : 'no-pool'">
                <div v-if="activePool" class="ps-content">
                  <span class="ps-icon">🎯</span>
                  <div class="ps-info">
                    <span class="ps-label">Pool activo: <b>{{ activePool.name }}</b></span>
                    <span class="ps-sessions">{{ activePool.session_ids.join(', ') }}</span>
                  </div>
                </div>
                <div v-else class="ps-content">
                  <span class="ps-icon">⚠</span>
                  <div class="ps-info">
                    <span class="ps-label"><b>Sin pool configurado</b> — se usarán todos los números</span>
                    <span class="ps-warn">Si algún número no está en el grupo, el envío se volverá lento por reintentos. Se recomienda crear un pool en la pestaña 🎯 Pools.</span>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <div class="field-group">
            <label class="field-label">Texto</label>
            <textarea v-model="form.text" class="field-input field-textarea" rows="4" placeholder="Escribe el mensaje..."></textarea>
          </div>

          <div class="field-group">
            <label class="field-label">Imagen <span class="opt">(opcional · JPG, PNG, WEBP, GIF · máx 16 MB)</span></label>
            <label class="file-drop" :class="{ 'has-file': imageFile }">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="onImageChange" class="file-input" />
              <span v-if="!imageFile" class="file-placeholder">🖼 Haz clic o arrastra una imagen aquí</span>
              <span v-else class="file-name">🖼 {{ imageFile.name }} <button type="button" class="file-clear" @click.prevent="clearImage">✕</button></span>
            </label>
          </div>

          <div class="field-group">
            <label class="field-label">Documento <span class="opt">(opcional · PDF, DOC, DOCX · máx 16 MB)</span></label>
            <label class="file-drop" :class="{ 'has-file': documentFile }">
              <input type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" @change="onDocumentChange" class="file-input" />
              <span v-if="!documentFile" class="file-placeholder">📄 Haz clic o arrastra un documento aquí</span>
              <span v-else class="file-name">📄 {{ documentFile.name }} <button type="button" class="file-clear" @click.prevent="clearDocument">✕</button></span>
            </label>
          </div>

          <div class="field-hint warning">⚡ Al menos uno de los tres campos de contenido es obligatorio</div>

          <!-- Nota informativa sobre combinaciones recomendadas -->
          <div class="combo-info">
            <div class="combo-title">💡 Combinaciones recomendadas</div>
            <div class="combo-row best">
              <span class="combo-badge">✅ Ideal</span>
              <span>Texto + Imagen — llegan como <b>1 solo mensaje</b></span>
            </div>
            <div class="combo-row best">
              <span class="combo-badge">✅ Ideal</span>
              <span>Texto + Documento — llegan como <b>1 solo mensaje</b></span>
            </div>
            <div class="combo-row warn">
              <span class="combo-badge">⚠ Cuidado</span>
              <span>Texto + Imagen + Documento — llegan como <b>2 mensajes</b>. Con alto volumen pueden llegar desordenados entre sí.</span>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" :disabled="sending">
            <span v-if="sending" class="spinner"></span>
            <span v-else>✉ Encolar mensaje</span>
          </button>
        </form>
      </div>

      <!-- Panel de resultado -->
      <div class="result-panel">
        <!-- Stats de cola en tiempo real -->
        <div class="queue-card">
          <div class="queue-title">📊 Estado de la cola</div>
          <div class="queue-stats">
            <div class="q-stat">
              <div class="q-val yellow">{{ queue.stats.waiting }}</div>
              <div class="q-lbl">En espera</div>
            </div>
            <div class="q-stat">
              <div class="q-val accent">{{ queue.stats.ready }}</div>
              <div class="q-lbl">Sesiones listas</div>
            </div>
            <div class="q-stat">
              <div class="q-val green">{{ queue.stats.totalCompleted }}</div>
              <div class="q-lbl">Completados</div>
            </div>
            <div class="q-stat">
              <div class="q-val red">{{ queue.stats.totalFailed }}</div>
              <div class="q-lbl">Fallidos</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="queue.fetchStats()" style="margin-top:0.75rem">↺ Actualizar</button>
        </div>

        <!-- Resultado del último envío -->
        <div v-if="result" class="result-card" :class="result.success ? 'success' : 'error'">
          <div class="result-title">{{ result.success ? '✅ Mensaje encolado' : '❌ Error' }}</div>
          <div v-if="result.jobId" class="result-detail">Job ID: <code>{{ result.jobId }}</code></div>
          <div v-if="result.error" class="result-detail">{{ result.error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api/axios'
import { useQueueStore } from '@/stores/queue'
import { usePoolsStore } from '@/stores/pools'

const queue   = useQueueStore()
const pools   = usePoolsStore()
const sending = ref(false)
const result  = ref(null)

const form         = reactive({ groupId: '', text: '' })
const imageFile    = ref(null)
const documentFile = ref(null)

onMounted(() => {
  queue.fetchStats()
  pools.fetchPools()
})

// Busca en tiempo real si el groupId actual tiene un pool configurado
const activePool = computed(() =>
  pools.pools.find(p => p.group_id === form.groupId.trim()) || null
)

function onImageChange(e)    { imageFile.value    = e.target.files[0] || null }
function onDocumentChange(e) { documentFile.value = e.target.files[0] || null }
function clearImage()        { imageFile.value    = null }
function clearDocument()     { documentFile.value = null }

async function sendMessage() {
  if (!form.groupId) return
  if (!form.text && !imageFile.value && !documentFile.value) {
    result.value = { success: false, error: 'Debes completar al menos: texto, imagen o documento' }
    return
  }

  sending.value = true
  result.value  = null

  try {
    const fd = new FormData()
    fd.append('groupId', form.groupId)
    if (form.text)           fd.append('text',     form.text)
    if (imageFile.value)     fd.append('image',    imageFile.value)
    if (documentFile.value)  fd.append('document', documentFile.value)

    const { data } = await api.post('/send', fd)
    result.value = { success: true, jobId: data.data.jobId }
    await queue.fetchStats()
  } catch (e) {
    result.value = { success: false, error: e.response?.data?.message || e.message }
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.tab-page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
.page-header { margin-bottom: 1.5rem; }
.page-title  { font-size: 1.15rem; font-weight: 600; }
.page-desc   { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }

.send-layout { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; }
@media (max-width: 720px) { .send-layout { grid-template-columns: 1fr; } }

.send-card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.5rem;
}
.ci { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin-bottom: 0.75rem; }
.card-title { font-size: 0.92rem; font-weight: 600; }

.send-form { display: flex; flex-direction: column; gap: 1rem; }
.field-group { display: flex; flex-direction: column; gap: 0.35rem; }
.field-label { font-size: 0.78rem; font-weight: 500; color: var(--text-dim); }
.req { color: var(--red); }
.opt { font-weight: 400; color: var(--text-muted); font-size: 0.72rem; }
.field-input { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.55rem 0.85rem; color: var(--text); font-size: 0.85rem; font-family: inherit; outline: none; width: 100%; }
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
.field-textarea { resize: vertical; min-height: 90px; }
.field-hint { font-size: 0.72rem; color: var(--text-dim); }
.field-hint.warning { color: var(--yellow); }

/* Indicador de pool */
.pool-status {
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
  border: 1px solid;
  margin-top: 0.1rem;
}
.pool-status.has-pool {
  background: var(--green-muted);
  border-color: rgba(52,211,153,0.25);
}
.pool-status.no-pool {
  background: rgba(234,179,8,0.08);
  border-color: rgba(234,179,8,0.25);
}
.ps-content { display: flex; gap: 0.6rem; align-items: flex-start; }
.ps-icon    { font-size: 0.9rem; flex-shrink: 0; margin-top: 0.05rem; }
.ps-info    { display: flex; flex-direction: column; gap: 0.15rem; }
.ps-label   { font-size: 0.75rem; color: var(--text); }
.ps-label b { font-weight: 600; }
.ps-sessions { font-size: 0.7rem; color: var(--green); font-family: var(--font-mono); }
.ps-warn    { font-size: 0.7rem; color: var(--yellow); line-height: 1.5; }

.slide-enter-active, .slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-4px); }

.btn { border: none; border-radius: var(--radius-sm); padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 0.4rem; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost  { background: var(--bg3); color: var(--text-dim); }
.btn-full   { width: 100%; justify-content: center; padding: 0.7rem; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.76rem; }

/* Panel derecho */
.result-panel { display: flex; flex-direction: column; gap: 1rem; }

.queue-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.queue-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; }
.queue-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.q-stat { text-align: center; }
.q-val  { font-size: 1.4rem; font-weight: 600; font-family: var(--font-mono); letter-spacing: -0.02em; }
.q-val.yellow { color: var(--yellow); }
.q-val.accent { color: var(--accent); }
.q-val.green  { color: var(--green); }
.q-val.red    { color: var(--red); }
.q-lbl  { font-size: 0.72rem; color: var(--text-dim); }

.result-card { border-radius: var(--radius); padding: 1rem 1.25rem; }
.result-card.success { background: var(--green-muted); border: 1px solid rgba(52,211,153,0.2); }
.result-card.error   { background: var(--red-muted);   border: 1px solid rgba(248,113,113,0.2); }
.result-title  { font-size: 0.88rem; font-weight: 600; margin-bottom: 0.4rem; }
.result-detail { font-size: 0.8rem; color: var(--text-dim); }
.result-detail code { color: var(--cyan); }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Nota combinaciones */
.combo-info {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.combo-title { font-size: 0.75rem; font-weight: 600; color: var(--text-dim); margin-bottom: 0.15rem; }
.combo-row   { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.76rem; color: var(--text-dim); line-height: 1.5; }
.combo-row b { color: var(--text); font-weight: 600; }
.combo-badge {
  font-size: 0.68rem; font-weight: 600; white-space: nowrap;
  padding: 0.1rem 0.45rem; border-radius: 4px; flex-shrink: 0; margin-top: 0.1rem;
}
.combo-row.best .combo-badge { background: var(--green-muted); color: var(--green); }
.combo-row.warn .combo-badge { background: rgba(234,179,8,0.1); color: var(--yellow); }

/* File upload drop zone */
.file-drop {
  display: flex;
  align-items: center;
  min-height: 42px;
  background: var(--bg3);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  overflow: hidden;
}
.file-drop:hover { border-color: var(--accent); background: var(--accent-muted); }
.file-drop.has-file { border-style: solid; border-color: var(--accent); background: var(--accent-muted); }
.file-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.file-placeholder { font-size: 0.82rem; color: var(--text-dim); pointer-events: none; }
.file-name { font-size: 0.82rem; color: var(--text); pointer-events: none; display: flex; align-items: center; gap: 0.5rem; }
.file-clear {
  pointer-events: all;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 0.15rem;
  line-height: 1;
  z-index: 1;
}
.file-clear:hover { color: var(--red); }
</style>
