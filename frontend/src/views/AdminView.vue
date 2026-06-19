<template>
  <div class="admin">
    <!-- ── Header ── -->
    <header class="ad-header">
      <div class="logo">
        <div class="logo-icon">🛡️</div>
        <div>
          <div class="logo-text">OPSGUARD · SaaS</div>
          <div class="logo-sub">Consola de plataforma</div>
        </div>
      </div>
      <div class="ad-header-right">
        <span class="who">{{ auth.fullName || auth.user }} · <b>superadmin</b></span>
        <button class="btn btn-ghost" @click="auth.logout()">Cerrar sesión</button>
      </div>
    </header>

    <main class="ad-main">
      <div class="ad-bar">
        <div>
          <div class="page-title">Empresas (tenants)</div>
          <div class="page-desc">{{ tenants.length }} empresa(s) · crea y administra cuotas, vigencia y responsables</div>
        </div>
        <button class="btn btn-accent" @click="openCreate">+ Nueva empresa</button>
      </div>

      <div v-if="error" class="alert error">⚠ {{ error }}</div>
      <div v-if="loading" class="muted">Cargando…</div>

      <!-- ── Tabla de tenants ── -->
      <div v-else class="cards">
        <div v-for="t in tenants" :key="t.id" class="tcard" :class="{ suspended: t.status === 'suspended' }">
          <div class="tcard-head">
            <div>
              <div class="tname">{{ t.name }}</div>
              <div class="tslug">/{{ t.slug }}</div>
            </div>
            <span class="badge" :class="t.status">{{ t.status === 'active' ? 'Activa' : 'Suspendida' }}</span>
          </div>

          <div class="tgrid">
            <div><span class="k">Responsable</span><span class="v">{{ t.manager_username || '—' }}</span></div>
            <div><span class="k">Mensajes</span>
              <span class="v">{{ t.usage.used }} / {{ t.usage.unlimited ? '∞' : t.usage.quota }}
                <small>({{ t.usage.quotaPeriod === 'monthly' ? 'mensual' : 'total' }})</small></span>
            </div>
            <div><span class="k">Sesiones</span><span class="v">{{ t.session_count }} / {{ t.max_sessions }}</span></div>
            <div><span class="k">Vigencia</span><span class="v">{{ fmtDate(t.valid_until) }}</span></div>
          </div>

          <!-- barra de consumo -->
          <div v-if="!t.usage.unlimited" class="bar">
            <div class="bar-fill" :style="{ width: pct(t.usage) + '%' }" :class="{ full: pct(t.usage) >= 100 }"></div>
          </div>

          <div class="tactions">
            <button class="btn btn-sm" @click="openEdit(t)">Editar</button>
            <button v-if="t.status === 'active'" class="btn btn-sm btn-warn" @click="setStatus(t, 'suspend')">Suspender</button>
            <button v-else class="btn btn-sm btn-ok" @click="setStatus(t, 'activate')">Reactivar</button>
            <button class="btn btn-sm" @click="resetUsage(t)">Reiniciar consumo</button>
            <button class="btn btn-sm" @click="openPassword(t)">Cambiar clave</button>
          </div>
        </div>

        <div v-if="!tenants.length" class="muted empty">Sin empresas todavía. Crea la primera con “+ Nueva empresa”.</div>
      </div>
    </main>

    <!-- ── Modal crear / editar ── -->
    <div v-if="modal" class="overlay" @click.self="modal = null">
      <div class="card-modal">
        <div class="modal-title">{{ modal === 'create' ? 'Nueva empresa' : `Editar: ${form.name}` }}</div>

        <div class="fields">
          <label>Nombre de la empresa
            <input v-model="form.name" placeholder="Acme S.A." />
          </label>

          <template v-if="modal === 'create'">
            <label>Slug (opcional)
              <input v-model="form.slug" placeholder="acme (se deriva del nombre si lo dejas vacío)" />
            </label>
          </template>

          <div class="row">
            <label>Cuota de mensajes
              <input v-model.number="form.messageQuota" type="number" min="0" placeholder="0 = ilimitado" />
            </label>
            <label>Periodo
              <select v-model="form.quotaPeriod">
                <option value="total">Bolsa total</option>
                <option value="monthly">Mensual</option>
              </select>
            </label>
          </div>

          <div class="row">
            <label>Tope de sesiones
              <input v-model.number="form.maxSessions" type="number" min="1" />
            </label>
            <label>Vigencia hasta
              <input v-model="form.validUntil" type="date" />
            </label>
          </div>

          <template v-if="modal === 'create'">
            <div class="sep">Responsable (usuario que administra la empresa)</div>
            <div class="row">
              <label>Usuario
                <input v-model="form.managerUsername" placeholder="acme.admin" autocomplete="off" />
              </label>
              <label>Email
                <input v-model="form.managerEmail" type="email" placeholder="admin@acme.com" autocomplete="off" />
              </label>
            </div>
            <label>Contraseña
              <input v-model="form.managerPassword" type="password" placeholder="••••••••" autocomplete="new-password" />
            </label>
          </template>

          <div v-if="modalError" class="alert error">⚠ {{ modalError }}</div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="modal = null">Cancelar</button>
          <button class="btn btn-accent" :disabled="saving" @click="save">
            {{ saving ? 'Guardando…' : (modal === 'create' ? 'Crear' : 'Guardar') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modal cambio de clave del responsable ── -->
    <div v-if="pwModal" class="overlay" @click.self="pwModal = null">
      <div class="card-modal sm">
        <div class="modal-title">Nueva clave de {{ pwModal.manager_username || pwModal.name }}</div>
        <div class="fields">
          <label>Nueva contraseña
            <input v-model="pwValue" type="password" placeholder="mínimo 6 caracteres" autocomplete="new-password" />
          </label>
          <div v-if="pwError" class="alert error">⚠ {{ pwError }}</div>
          <div v-if="pwOk" class="alert ok">✓ {{ pwOk }}</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="pwModal = null">Cerrar</button>
          <button class="btn btn-accent" :disabled="saving" @click="savePassword">Cambiar</button>
        </div>
      </div>
    </div>

    <!-- ── Toast del token/credenciales recién creadas ── -->
    <div v-if="createdInfo" class="overlay" @click.self="createdInfo = null">
      <div class="card-modal sm">
        <div class="modal-title">✓ Empresa creada</div>
        <p class="muted">Comparte estas credenciales con el responsable:</p>
        <div class="cred"><b>Empresa:</b> {{ createdInfo.tenant.name }} (/{{ createdInfo.tenant.slug }})</div>
        <div class="cred"><b>Usuario:</b> {{ createdInfo.manager.username }}</div>
        <div class="modal-actions">
          <button class="btn btn-accent" @click="createdInfo = null">Entendido</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api/axios'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const tenants = ref([])
const loading = ref(true)
const error   = ref('')

const modal      = ref(null)   // 'create' | 'edit' | null
const editingId  = ref(null)
const saving     = ref(false)
const modalError = ref('')
const createdInfo = ref(null)

const pwModal = ref(null)
const pwValue = ref('')
const pwError = ref('')
const pwOk    = ref('')

const form = reactive({
  name: '', slug: '', messageQuota: 0, quotaPeriod: 'total',
  maxSessions: 1, validUntil: '',
  managerUsername: '', managerEmail: '', managerPassword: '',
})

function fmtDate(d) {
  if (!d) return 'Sin caducidad'
  return new Date(d).toLocaleDateString()
}
function pct(u) {
  if (u.unlimited || !u.quota) return 0
  return Math.min(100, Math.round((u.used / u.quota) * 100))
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get('/admin/tenants')
    tenants.value = data.data
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudieron cargar las empresas'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    name: '', slug: '', messageQuota: 0, quotaPeriod: 'total',
    maxSessions: 1, validUntil: '',
    managerUsername: '', managerEmail: '', managerPassword: '',
  })
  modalError.value = ''
}

function openCreate() { resetForm(); editingId.value = null; modal.value = 'create' }

function openEdit(t) {
  resetForm()
  editingId.value = t.id
  form.name         = t.name
  form.messageQuota = t.message_quota
  form.quotaPeriod  = t.quota_period
  form.maxSessions  = t.max_sessions
  form.validUntil   = t.valid_until ? new Date(t.valid_until).toISOString().slice(0, 10) : ''
  modal.value = 'edit'
}

async function save() {
  saving.value = true; modalError.value = ''
  try {
    if (modal.value === 'create') {
      const { data } = await api.post('/admin/tenants', { ...form })
      createdInfo.value = data.data
    } else {
      await api.patch(`/admin/tenants/${editingId.value}`, {
        name: form.name,
        messageQuota: form.messageQuota,
        quotaPeriod: form.quotaPeriod,
        maxSessions: form.maxSessions,
        validUntil: form.validUntil || null,
      })
    }
    modal.value = null
    await load()
  } catch (e) {
    modalError.value = e.response?.data?.message || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function setStatus(t, action) {
  try { await api.post(`/admin/tenants/${t.id}/${action}`); await load() }
  catch (e) { error.value = e.response?.data?.message || 'Error' }
}

async function resetUsage(t) {
  if (!confirm(`¿Reiniciar el consumo de mensajes de ${t.name}?`)) return
  try { await api.post(`/admin/tenants/${t.id}/reset-usage`); await load() }
  catch (e) { error.value = e.response?.data?.message || 'Error' }
}

function openPassword(t) { pwModal.value = t; pwValue.value = ''; pwError.value = ''; pwOk.value = '' }

async function savePassword() {
  pwError.value = ''; pwOk.value = ''
  if (!pwValue.value || pwValue.value.length < 6) { pwError.value = 'Mínimo 6 caracteres'; return }
  saving.value = true
  try {
    await api.post(`/admin/tenants/${pwModal.value.id}/reset-password`, { newPassword: pwValue.value })
    pwOk.value = 'Contraseña actualizada'
    setTimeout(() => { pwModal.value = null }, 1200)
  } catch (e) {
    pwError.value = e.response?.data?.message || 'Error'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.admin { min-height: 100vh; position: relative; z-index: 1; }

.ad-header {
  position: sticky; top: 0; z-index: 10;
  height: var(--header-h); display: flex; align-items: center; justify-content: space-between;
  padding: 0 1.5rem; background: rgba(10,13,18,0.8); backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--border);
}
.logo { display: flex; align-items: center; gap: 0.6rem; }
.logo-icon { width: 32px; height: 32px; background: var(--accent-muted); border: 1px solid var(--border-hi); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.logo-text { font-size: 0.88rem; font-weight: 700; letter-spacing: 0.08em; }
.logo-sub  { font-size: 0.63rem; color: var(--text-dim); font-family: var(--font-mono); }
.ad-header-right { display: flex; align-items: center; gap: 1rem; }
.who { font-size: 0.78rem; color: var(--text-dim); }

.ad-main { max-width: 1080px; margin: 0 auto; padding: 1.5rem; }
.ad-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.page-title { font-size: 1.15rem; font-weight: 600; }
.page-desc  { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
.tcard { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; }
.tcard.suspended { opacity: 0.7; border-color: var(--red-muted); }
.tcard-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
.tname { font-weight: 600; font-size: 0.95rem; }
.tslug { font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono); }
.badge { font-size: 0.62rem; font-weight: 600; padding: 0.15rem 0.55rem; border-radius: 20px; text-transform: uppercase; }
.badge.active    { background: var(--green-muted); color: var(--green); }
.badge.suspended { background: var(--red-muted);   color: var(--red); }

.tgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1rem; margin-bottom: 0.65rem; }
.tgrid .k { display: block; font-size: 0.64rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.tgrid .v { font-size: 0.85rem; color: var(--text); }
.tgrid .v small { color: var(--text-dim); }

.bar { height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; margin-bottom: 0.75rem; }
.bar-fill { height: 100%; background: var(--accent); transition: width 0.3s; }
.bar-fill.full { background: var(--red); }

.tactions { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.btn { border: none; border-radius: var(--radius-sm); padding: 0.5rem 0.9rem; font-size: 0.8rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-sm { padding: 0.32rem 0.6rem; font-size: 0.72rem; background: var(--bg3); color: var(--text-dim); }
.btn-sm:hover { color: var(--text); }
.btn-ghost { background: var(--bg3); color: var(--text-dim); }
.btn-accent { background: var(--accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: var(--accent-hover); }
.btn-accent:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-warn { color: var(--yellow); background: var(--yellow-muted); }
.btn-ok   { color: var(--green);  background: var(--green-muted); }

.muted { color: var(--text-dim); font-size: 0.85rem; }
.empty { grid-column: 1/-1; text-align: center; padding: 2rem; }

.alert { font-size: 0.8rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); margin: 0.5rem 0; }
.alert.error { color: var(--red);   background: var(--red-muted); }
.alert.ok    { color: var(--green); background: var(--green-muted); }

.overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.card-modal { background: var(--bg2); border: 1px solid var(--border-hi); border-radius: 16px; padding: 1.75rem; width: 100%; max-width: 520px; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }
.card-modal.sm { max-width: 380px; }
.modal-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem; }
.fields { display: flex; flex-direction: column; gap: 0.75rem; }
.fields label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.75rem; color: var(--text-dim); }
.fields input, .fields select { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.55rem 0.75rem; color: var(--text); font-size: 0.88rem; font-family: inherit; outline: none; }
.fields input:focus, .fields select:focus { border-color: var(--accent); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.sep { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.75rem; }
.cred { font-size: 0.85rem; margin: 0.3rem 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 1.25rem; }
</style>
