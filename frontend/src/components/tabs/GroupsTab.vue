<template>
  <div class="tab-page">
    <div class="page-header">
      <div>
        <div class="page-title">Grupos WhatsApp</div>
        <div class="page-desc">Selecciona una sesión para ver sus grupos</div>
      </div>
    </div>

    <!-- ── PASO 1: Seleccionar sesión ── -->
    <div class="step-label">① Elige la sesión</div>
    <div class="session-selector">
      <button
        v-for="[id, s] in Object.entries(sessions.sessions)"
        :key="id"
        class="sess-btn"
        :class="{ active: selectedSession === id, disabled: !s.isReady }"
        :disabled="!s.isReady"
        @click="selectSession(id)"
      >
        <span class="sess-dot" :class="s.isReady ? 'green' : 'grey'"></span>
        <span class="sess-name">{{ id }}</span>
        <span v-if="s.phone" class="sess-phone">{{ s.phone }}</span>
        <span v-if="!s.isReady" class="sess-na">no disponible</span>
      </button>

      <div v-if="Object.keys(sessions.sessions).length === 0" class="no-sessions">
        No hay sesiones listas. Crea una en la pestaña Sesiones.
      </div>
    </div>

    <!-- ── PASO 2: Grupos de la sesión seleccionada ── -->
    <template v-if="selectedSession">
      <div class="step-label" style="margin-top:1.5rem">
        ② Grupos de <b>{{ selectedSession }}</b>
        <button class="btn btn-ghost btn-sm" @click="fetchGroups" :disabled="loading" style="margin-left:0.75rem">
          {{ loading ? 'Cargando...' : '↺ Actualizar' }}
        </button>
      </div>

      <!-- Buscador -->
      <div class="search-bar">
        <input v-model="searchText" class="field-input" placeholder="🔍 Buscar grupo por nombre o ID..." />
      </div>

      <div v-if="error" class="alert-error">⚠ {{ error }}</div>

      <!-- Tabla de grupos -->
      <div v-if="filteredGroups.length" class="groups-table-wrap">
        <table class="groups-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>ID del Grupo</th>
              <th>Participantes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in filteredGroups" :key="g.id">
              <td class="g-name">{{ g.name }}</td>
              <td><code class="g-id">{{ g.id }}</code></td>
              <td class="g-count">{{ g.participantsCount }}</td>
              <td>
                <div style="display:flex;gap:0.4rem">
                  <button
                    class="btn btn-sm btn-ghost"
                    :class="{ copied: copiedId === g.id }"
                    @click="copyId(g.id)"
                  >
                    {{ copiedId === g.id ? '✓ Copiado' : '📋 Copiar ID' }}
                  </button>
                  <button class="btn btn-sm btn-ghost" @click="viewDetail(g.id)">🔍 Detalle</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer">{{ filteredGroups.length }} grupos encontrados · sesión: {{ selectedSession }}</div>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="empty-state">
        <div class="empty-icon">⏳</div>
        <div>Cargando grupos...</div>
      </div>

      <!-- Empty -->
      <div v-else-if="!loading && groups.length === 0" class="empty-state">
        <div class="empty-icon">👥</div>
        <div>No se encontraron grupos para esta sesión.</div>
      </div>

      <!-- Sin resultados en búsqueda -->
      <div v-else-if="filteredGroups.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <div>No hay grupos que coincidan con "<b>{{ searchText }}</b>"</div>
      </div>
    </template>

    <!-- Modal detalle grupo -->
    <div v-if="detail.show" class="modal-overlay" @click.self="detail.show = false">
      <div class="modal-card">
        <div class="modal-title">{{ detail.data?.name }}</div>
        <div class="detail-grid">
          <div class="d-row"><span class="d-key">ID</span><code class="d-val mono">{{ detail.data?.id }}</code></div>
          <div class="d-row"><span class="d-key">Participantes</span><span class="d-val">{{ detail.data?.participants }}</span></div>
          <div class="d-row"><span class="d-key">Owner</span><code class="d-val mono">{{ detail.data?.owner }}</code></div>
          <div class="d-row"><span class="d-key">Solo admins</span><span class="d-val">{{ detail.data?.restrict ? 'Sí' : 'No' }}</span></div>
          <div class="d-row"><span class="d-key">Solo anuncios</span><span class="d-val">{{ detail.data?.announce ? 'Sí' : 'No' }}</span></div>
          <div class="d-row"><span class="d-key">Descripción</span><span class="d-val">{{ detail.data?.desc || '–' }}</span></div>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
          <button class="btn btn-primary btn-sm" @click="copyId(detail.data?.id)">📋 Copiar ID</button>
          <button class="btn btn-ghost" @click="detail.show = false">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from '@/api/axios'
import { useSessionsStore } from '@/stores/sessions'

const sessions        = useSessionsStore()
const selectedSession = ref('')
const groups          = ref([])
const searchText      = ref('')
const loading         = ref(false)
const error           = ref('')
const copiedId        = ref('')
const detail          = ref({ show: false, data: null })

// Cuando cambia la sesión seleccionada → carga los grupos automáticamente
watch(selectedSession, (val) => {
  if (val) fetchGroups()
})

function selectSession(id) {
  // Si clickea la misma → deselecciona
  if (selectedSession.value === id) {
    selectedSession.value = ''
    groups.value = []
  } else {
    selectedSession.value = id
    searchText.value = ''
  }
}

// Filtra en tiempo real mientras el usuario escribe
const filteredGroups = computed(() =>
  groups.value.filter(g =>
    g.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
    g.id.includes(searchText.value)
  )
)

async function fetchGroups() {
  if (!selectedSession.value) return
  loading.value = true
  error.value   = ''
  groups.value  = []
  try {
    const { data } = await api.get(`/groups?sessionId=${selectedSession.value}`)
    groups.value = data.data
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

function copyId(id) {
  if (!id) return
  navigator.clipboard.writeText(id)
  copiedId.value = id
  setTimeout(() => { copiedId.value = '' }, 2000)
}

async function viewDetail(groupId) {
  try {
    const { data } = await api.get(`/group/${groupId}?sessionId=${selectedSession.value}`)
    detail.value = { show: true, data: data.data }
  } catch (e) {
    error.value = e.message
  }
}
</script>

<style scoped>
.tab-page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
.page-header  { margin-bottom: 1.5rem; }
.page-title   { font-size: 1.15rem; font-weight: 600; }
.page-desc    { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }

.step-label {
  font-size: 0.78rem; font-weight: 600;
  color: var(--text-dim); margin-bottom: 0.75rem;
  display: flex; align-items: center; gap: 0.5rem;
}
.step-label b { color: var(--accent); }

/* ── Selector de sesiones ── */
.session-selector {
  display: flex; flex-wrap: wrap; gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.sess-btn {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer;
  font-family: inherit; font-size: 0.83rem; color: var(--text);
  transition: all 0.15s;
}
.sess-btn:hover:not(:disabled)  { border-color: var(--border-hi); }
.sess-btn.active { border-color: var(--accent); background: var(--accent-muted); color: var(--accent); }
.sess-btn.disabled { opacity: 0.45; cursor: not-allowed; }

.sess-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.sess-dot.green { background: var(--green); box-shadow: 0 0 5px var(--green); }
.sess-dot.grey  { background: var(--text-muted); }

.sess-name  { font-weight: 600; }
.sess-phone { font-size: 0.72rem; color: var(--text-dim); }
.sess-na    { font-size: 0.7rem; color: var(--red); }

.no-sessions { color: var(--text-dim); font-size: 0.82rem; padding: 0.5rem; }

/* ── Búsqueda ── */
.search-bar { margin-bottom: 1rem; }

/* ── Tabla ── */
.alert-error { background: var(--red-muted); border: 1px solid rgba(248,113,113,0.2); border-radius: var(--radius-sm); color: var(--red); font-size: 0.82rem; padding: 0.6rem 0.9rem; margin-bottom: 1rem; }

.groups-table-wrap { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; }
.groups-table { width: 100%; border-collapse: collapse; }
.groups-table th { padding: 0.65rem 1rem; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; text-align: left; border-bottom: 1px solid var(--border); }
.groups-table td { padding: 0.65rem 1rem; font-size: 0.83rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.groups-table tr:last-child td { border-bottom: none; }
.groups-table tr:hover td { background: rgba(47,111,208,0.05); }

.g-name  { font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-id    { font-size: 0.75rem; color: var(--cyan); font-family: monospace; }
.g-count { color: var(--text-dim); text-align: center; }
.table-footer { padding: 0.6rem 1rem; font-size: 0.72rem; color: var(--text-muted); border-top: 1px solid var(--border); }

.empty-state { text-align: center; color: var(--text-dim); padding: 3rem; }
.empty-icon  { font-size: 2.5rem; margin-bottom: 0.75rem; }

/* ── Botones ── */
.btn { border: none; border-radius: var(--radius-sm); padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-ghost  { background: var(--bg3); color: var(--text-dim); }
.btn-ghost:hover:not(:disabled) { color: var(--text); }
.btn-ghost.copied { color: var(--green); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 0.3rem 0.65rem; font-size: 0.75rem; }

.field-input { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.85rem; color: var(--text); font-size: 0.85rem; font-family: inherit; outline: none; width: 100%; }
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }

/* ── Modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal-card { background: var(--bg2); border: 1px solid var(--border-hi); border-radius: var(--radius); padding: 1.75rem 2rem; min-width: 340px; max-width: 460px; display: flex; flex-direction: column; gap: 0.9rem; }
.modal-title { font-weight: 700; font-size: 1rem; }
.detail-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.d-row { display: flex; gap: 0.75rem; align-items: flex-start; }
.d-key { font-size: 0.75rem; color: var(--text-dim); min-width: 110px; padding-top: 0.1rem; flex-shrink: 0; }
.d-val { font-size: 0.82rem; color: var(--text); word-break: break-all; }
.d-val.mono { font-family: monospace; font-size: 0.75rem; color: var(--cyan); }
</style>
