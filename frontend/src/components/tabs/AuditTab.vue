<template>
  <div class="tab-page">
    <div class="page-header">
      <div>
        <div class="page-title">Auditoría</div>
        <div class="page-desc">Historial de mensajes procesados · un archivo por día</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filters-bar">
      <select v-model="filters.date" class="field-input" style="width:160px">
        <option v-for="d in dates" :key="d" :value="d">{{ d }}</option>
      </select>
      <input v-model="filters.session" class="field-input" placeholder="Sesión (opt)" style="width:160px" />
      <select v-model="filters.status" class="field-input" style="width:140px">
        <option value="">Todos los estados</option>
        <option value="completed">Completados</option>
        <option value="failed">Fallidos</option>
      </select>
      <button class="btn btn-primary" @click="fetchAudit" :disabled="loading">
        {{ loading ? 'Cargando...' : '🔍 Filtrar' }}
      </button>
    </div>

    <!-- Contadores -->
    <div v-if="entries.length" class="audit-stats">
      <span class="a-stat green">✓ {{ completedCount }} completados</span>
      <span class="a-stat red">✗ {{ failedCount }} fallidos</span>
      <span class="a-stat dim">{{ entries.length }} total</span>
    </div>

    <!-- Tabla -->
    <div v-if="entries.length" class="table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Estado</th>
            <th>Job ID</th>
            <th>Sesión</th>
            <th>Grupo</th>
            <th>Tipo</th>
            <th>Texto</th>
            <th>IP</th>
            <th>Duración</th>
            <th>Intento</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in pagedEntries" :key="i" :class="e.status">
            <td class="td-time">{{ formatTime(e.created_at) }}</td>
            <td>
              <span class="badge" :class="e.status">{{ e.status }}</span>
            </td>
            <td class="td-mono small">{{ e.job_id || '–' }}</td>
            <td class="td-mono">{{ e.session_id || '–' }}</td>
            <td class="td-mono small">{{ e.group_id || '–' }}</td>
            <td>
              <span class="type-badge" :class="e.type">{{ e.type }}</span>
            </td>
            <td class="td-text" :title="e.text || ''">{{ truncate(e.text, 35) }}</td>
            <td class="td-dim">{{ e.ip || '–' }}</td>
            <td class="td-dim">{{ e.duration ? e.duration + 'ms' : '–' }}</td>
            <td class="td-dim">{{ e.attempt || '–' }}</td>
            <td class="td-error" :title="e.error || ''">{{ truncate(e.error, 30) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Paginación -->
      <div class="pagination">
        <button class="btn btn-ghost btn-sm" :disabled="page === 1 || loading" @click="loadPage(page - 1)">‹ Anterior</button>
        <span class="page-info">Página {{ page }} / {{ totalPages }} · <b>{{ totalRecords }}</b> registros total</span>
        <button class="btn btn-ghost btn-sm" :disabled="page >= totalPages || loading" @click="loadPage(page + 1)">Siguiente ›</button>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!loading && searched" class="empty-state">
      <div class="empty-icon">📋</div>
      <div>No hay registros para los filtros seleccionados.</div>
    </div>

    <div v-if="!searched && !loading" class="empty-state">
      <div class="empty-icon">📋</div>
      <div>Selecciona filtros y presiona Filtrar para ver los logs.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'

const PAGE_SIZE = 100

const dates        = ref([])
const entries      = ref([])
const totalRecords = ref(0)
const loading      = ref(false)
const searched     = ref(false)
const page         = ref(1)

const filters = ref({ date: '', session: '', status: '' })

onMounted(async () => {
  try {
    const { data } = await api.get('/audit')
    dates.value = data.data.dates
    if (dates.value.length) {
      filters.value.date = dates.value[0]
      entries.value  = data.data.entries
      totalRecords.value = data.data.total
      searched.value = true
    }
  } catch {}
})

async function fetchAudit() {
  loading.value  = true
  searched.value = false
  page.value     = 1
  await loadPage(1)
  searched.value = true
  loading.value  = false
}

async function loadPage(p) {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.date)    params.append('date',    filters.value.date)
    if (filters.value.session) params.append('session', filters.value.session)
    if (filters.value.status)  params.append('status',  filters.value.status)
    params.append('limit',  PAGE_SIZE)
    params.append('offset', (p - 1) * PAGE_SIZE)

    const { data } = await api.get(`/audit?${params}`)
    dates.value        = data.data.dates
    entries.value      = data.data.entries   // ya viene ordenado DESC del backend
    totalRecords.value = data.data.total
    page.value         = p
  } finally {
    loading.value = false
  }
}

// Paginación server-side
const totalPages     = computed(() => Math.max(1, Math.ceil(totalRecords.value / PAGE_SIZE)))
const pagedEntries   = computed(() => entries.value)   // el backend ya pagina

// Contadores basados en los registros de la página actual
const completedCount = computed(() => entries.value.filter(e => e.status === 'completed').length)
const failedCount    = computed(() => entries.value.filter(e => e.status === 'failed').length)

function formatTime(ts) {
  if (!ts) return '–'
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function truncate(str, len) {
  if (!str) return '–'
  return str.length > len ? str.slice(0, len) + '…' : str
}
</script>

<style scoped>
.tab-page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
.page-header { margin-bottom: 1.5rem; }
.page-title  { font-size: 1.15rem; font-weight: 600; }
.page-desc   { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }

.filters-bar { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }

.audit-stats { display: flex; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
.a-stat { font-size: 0.8rem; font-weight: 500; }
.a-stat.green { color: var(--green); }
.a-stat.red   { color: var(--red); }
.a-stat.dim   { color: var(--text-dim); }

.table-wrap { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; }

.audit-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.audit-table th { padding: 0.6rem 0.85rem; font-size: 0.68rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.audit-table td { padding: 0.55rem 0.85rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.audit-table tr:last-child td { border-bottom: none; }
.audit-table tr.completed:hover td { background: rgba(52,211,153,0.03); }
.audit-table tr.failed:hover   td { background: rgba(248,113,113,0.03); }

.td-mono  { font-family: var(--font-mono); font-size: 0.74rem; color: var(--cyan); }
.td-time  { white-space: nowrap; color: var(--text-dim); font-size: 0.74rem; font-family: var(--font-mono); }
.td-dim   { color: var(--text-dim); font-size: 0.76rem; }
.td-text  { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; }
.td-error { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--red); font-size: 0.74rem; cursor: default; }
.small    { font-size: 0.72rem; }

.badge { font-size: 0.65rem; font-weight: 600; padding: 0.18rem 0.55rem; border-radius: 20px; text-transform: uppercase; white-space: nowrap; }
.badge.completed { background: var(--green-muted); color: var(--green); }
.badge.failed    { background: var(--red-muted);   color: var(--red);   }

.type-badge { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; }
.type-badge.text     { background: var(--accent-muted); color: var(--accent); }
.type-badge.image    { background: var(--cyan-muted);   color: var(--cyan);   }
.type-badge.document { background: var(--yellow-muted); color: var(--yellow); }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 0.75rem; border-top: 1px solid var(--border); }
.page-info  { font-size: 0.78rem; color: var(--text-dim); }

.empty-state { text-align: center; color: var(--text-dim); padding: 3rem; }
.empty-icon  { font-size: 2.5rem; margin-bottom: 0.75rem; }

.btn { border: none; border-radius: var(--radius-sm); padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: var(--bg3); color: var(--text-dim); }
.btn-ghost:hover:not(:disabled) { color: var(--text); }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.76rem; }

.field-input { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.85rem; color: var(--text); font-size: 0.82rem; font-family: inherit; outline: none; }
.field-input:focus { border-color: var(--accent); }
</style>
