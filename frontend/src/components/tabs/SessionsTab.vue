<template>
  <div class="tab-page">
    <div class="page-header">
      <div>
        <div class="page-title">Sesiones WhatsApp</div>
        <div class="page-desc">Gestiona las conexiones activas · round-robin automático</div>
      </div>
      <button class="btn btn-primary" @click="showCreate = !showCreate">＋ Nueva sesión</button>
    </div>

    <!-- Formulario nueva sesión (v-show → oculta con CSS, no destruye el DOM) -->
    <div v-show="showCreate" class="create-card">
      <div class="ci" style="background:var(--accent-muted);color:var(--accent)">＋</div>
      <div style="flex:1">
        <div class="card-title">Crear nueva sesión</div>
        <div class="card-sub">Ingresa un nombre único · luego escanea el QR con WhatsApp</div>
      </div>
      <input
        v-model="newSessionId"
        class="field-input"
        placeholder="Ej: numero1, ventas, soporte"
        @keyup.enter="createSession"
        style="width:220px"
      />
      <button class="btn btn-primary" @click="createSession" :disabled="creating">
        {{ creating ? 'Creando...' : 'Crear' }}
      </button>
    </div>

    <!-- Mensaje de error -->
    <div v-if="error" class="alert-error">⚠ {{ error }}</div>

    <!-- Stats rápidos -->
    <div class="stats-row">
      <div class="stat-chip">
        <span class="stat-val green">{{ sessions.totalReady() }}</span>
        <span class="stat-lbl">Listas</span>
      </div>
      <div class="stat-chip">
        <span class="stat-val">{{ sessions.totalSessions() }}</span>
        <span class="stat-lbl">Total</span>
      </div>
    </div>

    <!-- ── Stats de cola en tiempo real ── -->
    <div class="queue-bar">
      <div class="q-box waiting">
        <div class="q-num">{{ queue.stats.waiting }}</div>
        <div class="q-lbl">En espera</div>
      </div>
      <div class="q-box active">
        <div class="q-num">{{ queue.stats.active }}</div>
        <div class="q-lbl">Procesando</div>
      </div>
      <div class="q-box completed">
        <div class="q-num">{{ queue.stats.totalCompleted }}</div>
        <div class="q-lbl">Completados</div>
      </div>
      <div class="q-box failed">
        <div class="q-num">{{ queue.stats.totalFailed }}</div>
        <div class="q-lbl">Fallidos</div>
      </div>
      <button class="btn btn-ghost btn-sm q-refresh" @click="queue.fetchStats()" title="Actualizar">↺</button>
    </div>

    <!-- Loading -->
    <div v-if="sessions.loading" class="loading-text">Cargando sesiones...</div>

    <!-- Lista de sesiones -->
    <div v-else class="sessions-grid">
      <!--
        v-for con Object.entries() → itera el objeto de sesiones.
        :key → identificador único para que Vue optimice el re-render.
      -->
      <div
        v-for="[id, s] in Object.entries(sessions.sessions)"
        :key="id"
        class="session-card"
        :class="{ ready: s.isReady, error: s.status === 'failed' }"
      >
        <div class="s-card-top">
          <div class="s-card-id">{{ id }}</div>
          <span class="badge" :class="badgeClass(s.status)">{{ s.status }}</span>
        </div>

        <div v-if="s.phone" class="s-phone">📞 {{ s.phone }}</div>

        <!-- QR -->
        <div v-if="s.qrBase64 && !s.isReady" class="qr-wrap">
          <img :src="s.qrBase64" alt="QR" class="qr-img" />
          <div class="qr-hint">Escanea con WhatsApp</div>
        </div>

        <div class="s-card-actions">
          <button v-if="!s.isReady" class="btn btn-sm btn-ghost" @click="showQR(id)">🔄 QR</button>
          <button class="btn btn-sm btn-danger" @click="deleteSession(id)">🗑 Eliminar</button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="Object.keys(sessions.sessions).length === 0" class="empty-state">
        <div class="empty-icon">📱</div>
        <div>No hay sesiones. Crea una para comenzar.</div>
      </div>
    </div>

    <!-- Modal QR -->
    <div v-if="qrModal.show" class="modal-overlay" @click.self="qrModal.show = false">
      <div class="modal-card">
        <div class="modal-title">QR · {{ qrModal.sessionId }}</div>
        <img v-if="qrModal.image" :src="qrModal.image" alt="QR" class="qr-big" />
        <div v-else class="qr-waiting">Esperando QR...</div>
        <button class="btn btn-ghost" @click="qrModal.show = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSessionsStore } from '@/stores/sessions'
import { useQueueStore }    from '@/stores/queue'

const sessions    = useSessionsStore()
const queue       = useQueueStore()
const showCreate  = ref(false)
const newSessionId = ref('')
const creating    = ref(false)
const error       = ref('')
const qrModal     = ref({ show: false, sessionId: '', image: '' })

onMounted(() => {
  sessions.fetchSessions()
  queue.fetchStats()
})

function badgeClass(status) {
  return {
    ready:       status === 'ready',
    connecting:  status === 'connecting',
    failed:      status === 'failed',
    'logged-out': status === 'logged_out',
  }
}

async function createSession() {
  if (!newSessionId.value.trim()) return
  creating.value = true
  error.value    = ''
  try {
    await sessions.createSession(newSessionId.value.trim())
    newSessionId.value = ''
    showCreate.value   = false
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    creating.value = false
  }
}

async function deleteSession(id) {
  if (!confirm(`¿Eliminar sesión "${id}"?`)) return
  try {
    await sessions.deleteSession(id)
  } catch (e) {
    error.value = e.message
  }
}

async function showQR(id) {
  qrModal.value = { show: true, sessionId: id, image: '' }
  try {
    const data = await sessions.getQR(id)
    qrModal.value.image = data.qrBase64 || ''
  } catch {}
}
</script>

<style scoped>
.tab-page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.page-title  { font-size: 1.15rem; font-weight: 600; color: var(--text); }
.page-desc   { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }

.create-card {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  background: var(--bg2); border: 1px solid var(--border-hi);
  border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1rem;
}
.ci { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
.card-title { font-size: 0.88rem; font-weight: 600; }
.card-sub   { font-size: 0.75rem; color: var(--text-dim); }

.stats-row { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; }
.stat-chip { display: flex; align-items: center; gap: 0.5rem; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.4rem 0.9rem; }
.stat-val  { font-size: 1.1rem; font-weight: 700; }
.stat-val.green { color: var(--green); }
.stat-lbl  { font-size: 0.75rem; color: var(--text-dim); }

/* ── Queue bar ── */
.queue-bar {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 1.25rem;
  overflow: hidden;
}
.q-box {
  flex: 1;
  text-align: center;
  padding: 0.85rem 0.5rem;
  border-right: 1px solid var(--border);
}
.q-num { font-size: 1.6rem; font-weight: 700; }
.q-lbl { font-size: 0.7rem; color: var(--text-dim); margin-top: 0.15rem; }
.q-box.waiting   .q-num { color: var(--yellow); }
.q-box.active    .q-num { color: var(--accent);  }
.q-box.completed .q-num { color: var(--green);   }
.q-box.failed    .q-num { color: var(--red);     }
.q-refresh { margin: 0 0.75rem; border-right: none; flex-shrink: 0; }

.alert-error { background: var(--red-muted); border: 1px solid rgba(248,113,113,0.2); border-radius: var(--radius-sm); color: var(--red); font-size: 0.82rem; padding: 0.6rem 0.9rem; margin-bottom: 1rem; }
.loading-text { color: var(--text-dim); text-align: center; padding: 2rem; }

.sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }

.session-card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.1rem 1.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
  transition: border-color 0.2s;
}
.session-card.ready { border-color: rgba(52,211,153,0.3); }
.session-card.error { border-color: rgba(248,113,113,0.3); }

.s-card-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.s-card-id  { font-weight: 600; font-size: 0.92rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.badge { font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 20px; text-transform: uppercase; flex-shrink: 0; white-space: nowrap; }
.badge.ready       { background: var(--green-muted);  color: var(--green);  }
.badge.connecting  { background: var(--yellow-muted); color: var(--yellow); }
.badge.failed,
.badge.logged-out  { background: var(--red-muted);    color: var(--red);    }

.s-phone { font-size: 0.78rem; color: var(--text-dim); }

.qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.qr-img  { width: 140px; height: 140px; border-radius: var(--radius-sm); background: #fff; padding: 4px; }
.qr-hint { font-size: 0.72rem; color: var(--text-dim); }

.s-card-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.empty-state { grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 3rem; }
.empty-icon  { font-size: 2.5rem; margin-bottom: 0.75rem; }

/* Botones */
.btn { border: none; border-radius: var(--radius-sm); padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost  { background: var(--bg3); color: var(--text-dim); }
.btn-ghost:hover { color: var(--text); }
.btn-danger { background: var(--red-muted); color: var(--red); }
.btn-danger:hover { background: rgba(248,113,113,0.2); }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.76rem; }

.field-input { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; color: var(--text); font-size: 0.85rem; font-family: inherit; outline: none; }
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal-card { background: var(--bg2); border: 1px solid var(--border-hi); border-radius: var(--radius); padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; min-width: 260px; }
.modal-title { font-weight: 600; font-size: 0.95rem; }
.qr-big { width: 220px; height: 220px; background: #fff; border-radius: var(--radius-sm); padding: 6px; }
.qr-waiting { color: var(--text-dim); font-size: 0.85rem; }
</style>
