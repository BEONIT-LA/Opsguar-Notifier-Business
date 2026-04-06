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
            <label class="field-label">Ruta de Imagen <span class="opt">(opcional)</span></label>
            <input v-model="form.imagePath" class="field-input" placeholder="/ruta/al/archivo.jpg" />
          </div>

          <div class="field-group">
            <label class="field-label">Ruta de Documento PDF <span class="opt">(opcional)</span></label>
            <input v-model="form.documentPath" class="field-input" placeholder="/ruta/al/archivo.pdf" />
          </div>

          <div class="field-hint warning">⚡ Al menos uno de los tres campos de contenido es obligatorio</div>

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

const form = reactive({ groupId: '', text: '', imagePath: '', documentPath: '' })

onMounted(() => {
  queue.fetchStats()
  pools.fetchPools()
})

// Busca en tiempo real si el groupId actual tiene un pool configurado
const activePool = computed(() =>
  pools.pools.find(p => p.group_id === form.groupId.trim()) || null
)

async function sendMessage() {
  if (!form.groupId) return
  if (!form.text && !form.imagePath && !form.documentPath) {
    result.value = { success: false, error: 'Debes completar al menos: texto, imagen o documento' }
    return
  }

  sending.value = true
  result.value  = null

  try {
    const payload = { groupId: form.groupId }
    if (form.text)         payload.text         = form.text
    if (form.imagePath)    payload.imagePath    = form.imagePath
    if (form.documentPath) payload.documentPath = form.documentPath

    const { data } = await api.post('/send', payload)
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
</style>
