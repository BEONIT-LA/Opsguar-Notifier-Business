<template>
  <div class="tab-page">

    <!-- Encabezado -->
    <div class="page-header">
      <div>
        <div class="page-title">Pools de Envío</div>
        <div class="page-desc">Asigna números específicos a cada grupo · sin pool = round-robin global</div>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        + Nuevo Pool
      </button>
    </div>

    <!-- Banner informativo -->
    <div class="info-banner">
      <div class="ib-row">
        <span class="ib-icon">💡</span>
        <div class="ib-body">
          <div class="ib-title">¿Cómo funcionan los Pools?</div>
          <div class="ib-items">
            <div class="ib-item">
              <span class="ib-dot green"></span>
              <span><b>Con pool:</b> solo los números asignados notifican ese grupo · round-robin entre ellos</span>
            </div>
            <div class="ib-item">
              <span class="ib-dot yellow"></span>
              <span><b>Sin pool:</b> se usan todos los números disponibles · si alguno no está en el grupo generará errores y el envío se volverá lento</span>
            </div>
            <div class="ib-item">
              <span class="ib-dot accent"></span>
              <span><b>Recomendado:</b> configura siempre un pool · agrega primero los números al grupo de WhatsApp · luego asígnalos aquí</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="pools.loading" class="empty-state">
      <div class="spinner-lg"></div>
      <div>Cargando pools...</div>
    </div>

    <!-- Lista de pools -->
    <div v-else-if="pools.pools.length" class="pools-grid">
      <div
        v-for="pool in pools.pools"
        :key="pool.id"
        class="pool-card"
      >
        <!-- Header de la card -->
        <div class="pool-card-header">
          <div class="pool-icon">🎯</div>
          <div class="pool-info">
            <div class="pool-name">{{ pool.name }}</div>
            <div class="pool-group-id">{{ pool.group_id }}</div>
          </div>
          <div class="pool-actions">
            <button class="icon-btn" title="Editar" @click="openEdit(pool)">✏️</button>
            <button class="icon-btn danger" title="Eliminar" @click="confirmDelete(pool)">🗑</button>
          </div>
        </div>

        <!-- Sesiones asignadas -->
        <div class="pool-sessions">
          <div class="sessions-label">Sesiones asignadas</div>
          <div v-if="pool.session_ids.length" class="sessions-tags">
            <span
              v-for="sid in pool.session_ids"
              :key="sid"
              class="session-tag"
              :class="getSessionStatus(sid)"
            >
              <span class="tag-dot"></span>
              {{ sid }}
            </span>
          </div>
          <div v-else class="sessions-empty">
            Sin sesiones — el pool usará round-robin global
          </div>
        </div>

        <!-- Footer: contador -->
        <div class="pool-footer">
          <span class="pool-stat">
            {{ pool.session_ids.length }} sesión{{ pool.session_ids.length !== 1 ? 'es' : '' }} asignada{{ pool.session_ids.length !== 1 ? 's' : '' }}
          </span>
          <span class="pool-stat ready">
            {{ countReady(pool.session_ids) }} lista{{ countReady(pool.session_ids) !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="empty-state">
      <div class="empty-icon">🎯</div>
      <div class="empty-title">Sin pools configurados</div>
      <div class="empty-desc">
        Crea un pool para asignar qué números envían a cada grupo.<br>
        Sin pool, el sistema usa round-robin entre todos los números.
      </div>
      <button class="btn btn-primary" style="margin-top:1.25rem" @click="openCreate">
        + Crear primer pool
      </button>
    </div>

    <!-- ── Modal crear/editar ── -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
          <div class="modal-card">
            <div class="modal-header">
              <div class="modal-title">{{ editing ? 'Editar Pool' : 'Nuevo Pool' }}</div>
              <button class="icon-btn" @click.stop="closeModal">✕</button>
            </div>

            <form @submit.prevent="savePool" class="modal-form">

              <!-- Nombre del pool -->
              <div class="field-group">
                <label class="field-label">Nombre del Pool <span class="req">*</span></label>
                <input
                  v-model="form.name"
                  class="field-input"
                  placeholder="Ej: Grupo Ventas, Canal Marketing..."
                  required
                />
              </div>

              <!-- Group ID -->
              <div class="field-group">
                <label class="field-label">Group ID de WhatsApp <span class="req">*</span></label>
                <input
                  v-model="form.groupId"
                  class="field-input field-mono"
                  placeholder="120363xxxxxxxx@g.us"
                  required
                />
                <div class="field-hint">Encuéntralo en la pestaña Grupos</div>
              </div>

              <!-- Sesiones: checkboxes -->
              <div class="field-group">
                <label class="field-label">Sesiones asignadas</label>

                <div v-if="Object.keys(allSessions).length === 0" class="no-sessions">
                  No hay sesiones disponibles. Crea una sesión primero.
                </div>

                <div v-else class="sessions-checklist">
                  <label
                    v-for="(info, sid) in allSessions"
                    :key="sid"
                    class="session-check"
                    :class="{ checked: form.sessionIds.includes(sid) }"
                  >
                    <input
                      type="checkbox"
                      :value="sid"
                      v-model="form.sessionIds"
                      class="sr-only"
                    />
                    <div class="check-box">
                      <span v-if="form.sessionIds.includes(sid)" class="check-mark">✓</span>
                    </div>
                    <div class="check-info">
                      <span class="check-name">{{ sid }}</span>
                      <span class="check-phone">{{ info.phone || 'sin número' }}</span>
                    </div>
                    <span class="check-status" :class="info.status">{{ info.status }}</span>
                  </label>
                </div>

                <div v-if="form.sessionIds.length === 0" class="field-hint warning">
                  ⚠ Sin sesiones seleccionadas → usará round-robin global al enviar
                </div>
              </div>

              <!-- Error del form -->
              <div v-if="formError" class="form-error">{{ formError }}</div>

              <div class="modal-actions">
                <button type="button" class="btn btn-ghost" @click.stop="closeModal">Cancelar</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
                  <span v-if="saving" class="spinner"></span>
                  <span v-else>{{ editing ? 'Guardar cambios' : 'Crear Pool' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ── Modal confirmación eliminar ── -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
          <div class="modal-card modal-sm">
            <div class="confirm-icon">🗑</div>
            <div class="confirm-title">¿Eliminar pool?</div>
            <div class="confirm-desc">
              Se eliminará el pool <b>{{ deletingPool?.name }}</b>.<br>
              Los mensajes siguientes usarán round-robin global.
            </div>
            <div class="modal-actions" style="margin-top:1.25rem">
              <button class="btn btn-ghost" @click.stop="showDeleteConfirm = false">Cancelar</button>
              <button class="btn btn-danger" @click.stop="doDelete" :disabled="deleting">
                {{ deleting ? 'Eliminando...' : 'Sí, eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { usePoolsStore }    from '@/stores/pools'
import { useSessionsStore } from '@/stores/sessions'

const pools    = usePoolsStore()
const sessions = useSessionsStore()

// Todas las sesiones como objeto { id: info }
const allSessions = computed(() => sessions.sessions || {})

onMounted(() => {
  pools.fetchPools()
  sessions.fetchSessions()
})

// ── Modal crear/editar ─────────────────────────────────────────
const showModal = ref(false)
const editing   = ref(null)   // null = crear, número = id del pool
const saving    = ref(false)
const formError = ref('')

const form = reactive({
  name:       '',
  groupId:    '',
  sessionIds: [],
})

function resetForm() {
  form.name       = ''
  form.groupId    = ''
  form.sessionIds = []
  formError.value = ''
  editing.value   = null
}

function openCreate() {
  resetForm()
  showModal.value = true
}

function openEdit(pool) {
  resetForm()
  editing.value   = pool.id
  form.name       = pool.name
  form.groupId    = pool.group_id
  form.sessionIds = [...pool.session_ids]
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  resetForm()
}

async function savePool() {
  if (!form.name.trim() || !form.groupId.trim()) return
  saving.value    = true
  formError.value = ''
  try {
    const payload = {
      name:       form.name.trim(),
      groupId:    form.groupId.trim(),
      sessionIds: form.sessionIds,
    }
    if (editing.value) {
      await pools.updatePool(editing.value, payload)
    } else {
      await pools.createPool(payload)
    }
    closeModal()
  } catch (e) {
    formError.value = e.response?.data?.message || e.message
  } finally {
    saving.value = false
  }
}

// ── Eliminar ───────────────────────────────────────────────────
const showDeleteConfirm = ref(false)
const deletingPool      = ref(null)
const deleting          = ref(false)

function confirmDelete(pool) {
  deletingPool.value  = pool
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!deletingPool.value) return
  deleting.value = true
  try {
    await pools.deletePool(deletingPool.value.id)
    showDeleteConfirm.value = false
    deletingPool.value = null
  } finally {
    deleting.value = false
  }
}

// ── Helpers de estado ──────────────────────────────────────────
function getSessionStatus(sid) {
  const s = allSessions.value[sid]
  if (!s) return 'unknown'
  return s.status === 'ready' ? 'ready' : 'offline'
}

function countReady(sessionIds) {
  return sessionIds.filter(sid => {
    const s = allSessions.value[sid]
    return s && s.status === 'ready'
  }).length
}
</script>

<style scoped>
.tab-page   { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap;
}
.page-title { font-size: 1.15rem; font-weight: 600; }
.page-desc  { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }

/* ── Banner info ── */
.info-banner {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1rem 1.1rem;
  margin-bottom: 1.25rem;
}
.ib-row  { display: flex; gap: 0.75rem; align-items: flex-start; }
.ib-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 0.1rem; }
.ib-body { flex: 1; }
.ib-title { font-size: 0.8rem; font-weight: 600; color: var(--text); margin-bottom: 0.55rem; }
.ib-items { display: flex; flex-direction: column; gap: 0.35rem; }
.ib-item  { display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.77rem; color: var(--text-dim); line-height: 1.5; }
.ib-item b { color: var(--text); font-weight: 600; }
.ib-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 0.38rem;
}
.ib-dot.green  { background: var(--green); box-shadow: 0 0 5px var(--green); }
.ib-dot.yellow { background: var(--yellow); }
.ib-dot.accent { background: var(--accent); }

/* ── Grid de pools ── */
.pools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.pool-card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
  display: flex; flex-direction: column;
  transition: border-color 0.15s;
}
.pool-card:hover { border-color: var(--border-hi); }

.pool-card-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--border);
}
.pool-icon { font-size: 1.3rem; flex-shrink: 0; }
.pool-info { flex: 1; min-width: 0; }
.pool-name { font-size: 0.92rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pool-group-id { font-size: 0.68rem; color: var(--cyan); font-family: var(--font-mono); margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pool-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.icon-btn {
  width: 28px; height: 28px; border-radius: 6px;
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; color: var(--text-dim);
  transition: all 0.15s;
}
.icon-btn:hover { background: var(--bg3); color: var(--text); }
.icon-btn.danger:hover { background: var(--red-muted); color: var(--red); }

.pool-sessions { padding: 0.85rem 1rem; flex: 1; }
.sessions-label { font-size: 0.68rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.6rem; }

.sessions-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.session-tag {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.72rem; font-family: var(--font-mono);
  padding: 0.2rem 0.55rem; border-radius: 20px;
  background: var(--bg3); border: 1px solid var(--border);
  color: var(--text-dim);
}
.tag-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-muted);
}
.session-tag.ready .tag-dot { background: var(--green); box-shadow: 0 0 5px var(--green); }
.session-tag.ready { border-color: rgba(52,211,153,0.3); color: var(--green); background: var(--green-muted); }
.session-tag.offline .tag-dot { background: var(--red); }
.session-tag.unknown .tag-dot { background: var(--text-muted); }
.sessions-empty { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }

.pool-footer {
  display: flex; justify-content: space-between;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg3);
}
.pool-stat { font-size: 0.72rem; color: var(--text-dim); }
.pool-stat.ready { color: var(--green); }

/* ── Empty ── */
.empty-state { text-align: center; color: var(--text-dim); padding: 4rem 2rem; }
.empty-icon  { font-size: 3rem; margin-bottom: 0.75rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 0.4rem; }
.empty-desc  { font-size: 0.83rem; line-height: 1.7; }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px); padding: 1rem;
}
.modal-card {
  background: var(--bg2); border: 1px solid var(--border-hi);
  border-radius: 16px; padding: 1.75rem;
  width: 100%; max-width: 480px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  max-height: 90vh; overflow-y: auto;
}
.modal-sm { max-width: 360px; text-align: center; }

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.5rem;
}
.modal-title { font-size: 1rem; font-weight: 700; color: var(--text); }

.modal-form { display: flex; flex-direction: column; gap: 1.1rem; }

.field-group { display: flex; flex-direction: column; gap: 0.35rem; }
.field-label { font-size: 0.78rem; font-weight: 500; color: var(--text-dim); }
.req { color: var(--red); }

.field-input {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.55rem 0.85rem;
  color: var(--text); font-size: 0.85rem; font-family: inherit;
  outline: none; width: 100%;
}
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
.field-mono { font-family: var(--font-mono); font-size: 0.8rem; }
.field-hint { font-size: 0.72rem; color: var(--text-dim); }
.field-hint.warning { color: var(--yellow); }

/* Checkboxes de sesiones */
.no-sessions { font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0; }

.sessions-checklist { display: flex; flex-direction: column; gap: 0.4rem; }
.session-check {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0.85rem; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg3);
  cursor: pointer; transition: all 0.15s;
}
.session-check:hover { border-color: var(--border-hi); }
.session-check.checked { border-color: var(--accent); background: var(--accent-muted); }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

.check-box {
  width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid var(--border); background: var(--bg2);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.session-check.checked .check-box { background: var(--accent); border-color: var(--accent); }
.check-mark { font-size: 0.7rem; color: #fff; font-weight: 700; }

.check-info { flex: 1; min-width: 0; }
.check-name { display: block; font-size: 0.83rem; font-weight: 600; color: var(--text); font-family: var(--font-mono); }
.check-phone { display: block; font-size: 0.7rem; color: var(--text-dim); font-family: var(--font-mono); }
.check-status {
  font-size: 0.65rem; font-weight: 600; padding: 0.15rem 0.5rem;
  border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em;
  flex-shrink: 0;
}
.check-status.ready        { background: var(--green-muted); color: var(--green); }
.check-status.qr_needed    { background: var(--yellow-muted); color: var(--yellow); }
.check-status.connecting,
.check-status.reconnecting { background: var(--accent-muted); color: var(--accent); }
.check-status.failed,
.check-status.logged_out   { background: var(--red-muted); color: var(--red); }

.form-error { font-size: 0.8rem; color: var(--red); background: var(--red-muted); border-radius: var(--radius-sm); padding: 0.55rem 0.85rem; }

.modal-actions { display: flex; gap: 0.65rem; justify-content: flex-end; }

/* Confirmar eliminar */
.confirm-icon  { font-size: 2rem; margin-bottom: 0.75rem; }
.confirm-title { font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; }
.confirm-desc  { font-size: 0.83rem; color: var(--text-dim); line-height: 1.6; }
.confirm-desc b { color: var(--text); }

/* Spinner loading de página */
.spinner-lg {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

/* Botones */
.btn { border: none; border-radius: var(--radius-sm); padding: 0.55rem 1.1rem; font-size: 0.83rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 0.4rem; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost  { background: var(--bg3); color: var(--text-dim); }
.btn-ghost:hover { color: var(--text); }
.btn-danger { background: var(--red-muted); color: var(--red); border: 1px solid rgba(248,113,113,0.25); }
.btn-danger:hover:not(:disabled) { background: rgba(248,113,113,0.2); }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Animación modal */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
