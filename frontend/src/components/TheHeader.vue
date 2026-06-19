<template>
  <header class="header">
    <!-- Logo oficial Be On It (horizontal) -->
    <div class="logo">
      <img src="/brand/beonit-horizontal.png" alt="Be On It" class="logo-img" />
      <div class="logo-tenant">
        <div class="logo-tenant-label">Workspace</div>
        <div class="logo-sub">{{ auth.tenant?.name || 'OpsGuard SaaS' }}</div>
      </div>
    </div>

    <div class="header-sep"></div>

    <!-- Tabs de navegación -->
    <nav class="header-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="nav-btn"
        :class="{ active: activeTab === tab.id }"
        @click="$emit('tab-change', tab.id)"
      >
        {{ tab.icon }} <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- Lado derecho -->
    <div class="header-right">
      <!-- Cuota / consumo del tenant -->
      <div v-if="auth.usage" class="quota-pill" :class="{ danger: quotaDanger }" :title="quotaTitle">
        <span class="quota-ico">📨</span>
        <span class="quota-text">
          {{ auth.usage.used }}<span class="quota-sep">/</span>{{ auth.usage.unlimited ? '∞' : auth.usage.quota }}
        </span>
      </div>

      <div class="header-sep"></div>

      <!-- Indicador Socket.io -->
      <div class="ws-pill">
        <span class="ws-dot" :class="wsConnected ? 'green' : 'red'"></span>
        <span class="ws-text">{{ wsConnected ? 'Live' : 'Offline' }}</span>
      </div>

      <div class="header-sep"></div>

      <!-- ── Botón de usuario con dropdown ── -->
      <div class="user-wrap" ref="userWrapRef">
        <button class="user-btn" @click="menuOpen = !menuOpen">
          <div class="user-avatar">{{ avatarInitials }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.fullName || auth.user }}</span>
            <span class="user-role">{{ auth.role }}</span>
          </div>
          <span class="user-chevron" :class="{ open: menuOpen }">▾</span>
        </button>

        <!-- Dropdown -->
        <transition name="dropdown">
          <div v-if="menuOpen" class="user-dropdown">

            <!-- Info del usuario -->
            <div class="dropdown-header">
              <div class="dh-avatar">{{ avatarInitials }}</div>
              <div class="dh-info">
                <div class="dh-name">{{ auth.fullName || auth.user }}</div>
                <div class="dh-email">{{ auth.email || '–' }}</div>
                <span class="dh-role-badge">{{ auth.role }}</span>
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <!-- Acciones -->
            <button class="dropdown-item" @click.stop="openChangePassword">
              <span class="di-icon">🔑</span>
              Cambiar contraseña
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" @click.stop="confirmLogout">
              <span class="di-icon">⏏</span>
              Cerrar sesión
            </button>
          </div>
        </transition>
      </div>
    </div>
  </header>

  <!-- ── Modal cambiar contraseña ── -->
  <teleport to="body">
    <transition name="fade">
      <div v-if="showChangePassword" class="confirm-overlay" @click.self="closeChangePassword">
        <div class="confirm-card">
          <div class="confirm-icon">🔑</div>
          <div class="confirm-title">Cambiar contraseña</div>

          <div class="cp-fields">
            <div class="cp-field">
              <label>Contraseña actual</label>
              <input v-model="cpForm.current" type="password" placeholder="••••••••" autocomplete="current-password" />
            </div>
            <div class="cp-field">
              <label>Nueva contraseña</label>
              <input v-model="cpForm.newPass" type="password" placeholder="••••••••" autocomplete="new-password" />
            </div>
            <div class="cp-field">
              <label>Confirmar nueva contraseña</label>
              <input v-model="cpForm.confirm" type="password" placeholder="••••••••" autocomplete="new-password" />
            </div>
            <div v-if="cpError" class="cp-error">⚠ {{ cpError }}</div>
            <div v-if="cpSuccess" class="cp-success">✓ {{ cpSuccess }}</div>
          </div>

          <div class="confirm-actions">
            <button class="btn btn-ghost" @click.stop="closeChangePassword">Cancelar</button>
            <button class="btn btn-accent" @click.stop="doChangePassword" :disabled="cpLoading">
              <span v-if="cpLoading">Guardando...</span>
              <span v-else>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- ── Modal de confirmación de logout ── -->
  <teleport to="body">
    <transition name="fade">
      <div v-if="showConfirm" class="confirm-overlay" @click.self="showConfirm = false">
        <div class="confirm-card">
          <div class="confirm-icon">⏏</div>
          <div class="confirm-title">¿Cerrar sesión?</div>
          <div class="confirm-desc">
            Saldrás como <b>{{ auth.fullName || auth.user }}</b>.<br>
            Tendrás que volver a iniciar sesión para acceder.
          </div>
          <div class="confirm-actions">
            <button class="btn btn-ghost" @click.stop="showConfirm = false">Cancelar</button>
            <button class="btn btn-danger" @click.stop="doLogout">Sí, cerrar sesión</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSocket }    from '@/composables/useSocket'
import axios            from 'axios'

const props = defineProps({
  activeTab: { type: String, required: true },
})
defineEmits(['tab-change'])

const auth        = useAuthStore()
const menuOpen    = ref(false)
const showConfirm = ref(false)
const userWrapRef = ref(null)
const wsConnected = ref(false)
const { socket }  = useSocket()

// ── Cuota / consumo del tenant ──────────────────────────────────
const quotaDanger = computed(() => {
  const u = auth.usage
  if (!u || u.unlimited || !u.quota) return false
  return u.used / u.quota >= 0.9
})
const quotaTitle = computed(() => {
  const u = auth.usage
  if (!u) return ''
  if (u.unlimited) return 'Mensajes sin límite'
  const period = u.quotaPeriod === 'monthly' ? 'este mes' : 'en total'
  return `${u.remaining} mensaje(s) restantes ${period}`
})
function refreshUsage() { auth.fetchMe() }

// ── Cambiar contraseña ─────────────────────────────────────────
const showChangePassword = ref(false)
const cpLoading  = ref(false)
const cpError    = ref('')
const cpSuccess  = ref('')
const cpForm     = reactive({ current: '', newPass: '', confirm: '' })

function openChangePassword() {
  menuOpen.value           = false
  cpForm.current           = ''
  cpForm.newPass           = ''
  cpForm.confirm           = ''
  cpError.value            = ''
  cpSuccess.value          = ''
  showChangePassword.value = true
}

function closeChangePassword() {
  showChangePassword.value = false
}

async function doChangePassword() {
  cpError.value   = ''
  cpSuccess.value = ''

  if (!cpForm.current || !cpForm.newPass || !cpForm.confirm) {
    cpError.value = 'Completa todos los campos'
    return
  }
  if (cpForm.newPass.length < 6) {
    cpError.value = 'La nueva contraseña debe tener al menos 6 caracteres'
    return
  }
  if (cpForm.newPass !== cpForm.confirm) {
    cpError.value = 'Las contraseñas nuevas no coinciden'
    return
  }

  cpLoading.value = true
  try {
    await axios.put('/api/auth/change-password', {
      currentPassword: cpForm.current,
      newPassword:     cpForm.newPass,
    }, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    cpSuccess.value = 'Contraseña actualizada correctamente'
    cpForm.current  = ''
    cpForm.newPass  = ''
    cpForm.confirm  = ''
    setTimeout(() => { showChangePassword.value = false }, 1500)
  } catch (e) {
    cpError.value = e.response?.data?.message || 'Error al cambiar la contraseña'
  } finally {
    cpLoading.value = false
  }
}

const tabs = [
  { id: 'sessions', icon: '📱', label: 'Sesiones'  },
  { id: 'send',     icon: '✉️',  label: 'Enviar'    },
  { id: 'groups',   icon: '👥',  label: 'Grupos'    },
  { id: 'pools',    icon: '🎯',  label: 'Pools'     },
  { id: 'system',   icon: '⚙️',  label: 'Sistema'   },
  { id: 'api',      icon: '📖',  label: 'API'       },
  { id: 'audit',    icon: '📋',  label: 'Auditoría' },
]

// Iniciales del avatar — toma la primera letra del nombre y apellido
const avatarInitials = computed(() => {
  const name = auth.fullName || auth.user || ''
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
})

// Abre el modal de confirmación y cierra el dropdown
function confirmLogout() {
  menuOpen.value    = false
  showConfirm.value = true
}

function doLogout() {
  showConfirm.value = false
  auth.logout()
}

// Cierra el dropdown al hacer click fuera de él
function handleClickOutside(e) {
  if (userWrapRef.value && !userWrapRef.value.contains(e.target)) {
    menuOpen.value = false
  }
}

onMounted(() => {
  wsConnected.value = socket.connected
  socket.on('connect',    () => { wsConnected.value = true  })
  socket.on('disconnect', () => { wsConnected.value = false })
  socket.on('queue:update', refreshUsage)
  auth.fetchMe()   // carga cuota/consumo inicial
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  socket.off('connect')
  socket.off('disconnect')
  socket.off('queue:update', refreshUsage)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center;
  padding: 0 1.5rem; gap: 0.75rem;
  z-index: 100;
  box-shadow: 0 1px 2px rgba(30,58,95,0.04);
}

/* Línea de marca en el borde inferior del header */
.header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 5%; right: 5%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(40,182,201,0.45), rgba(47,111,208,0.4), transparent);
}

.logo { display: flex; align-items: center; gap: 0.7rem; }
.logo-img { height: 26px; width: auto; display: block; flex-shrink: 0; }
.logo-tenant { display: flex; flex-direction: column; padding-left: 0.7rem; border-left: 1px solid var(--border); }
.logo-tenant-label { font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.logo-sub  { font-size: 0.72rem; font-weight: 600; color: var(--text); letter-spacing: 0.01em; }

.header-sep { width: 1px; height: 20px; background: var(--border); margin: 0 0.25rem; flex-shrink: 0; }

.header-nav { display: flex; gap: 2px; }
.nav-btn {
  padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 500;
  color: var(--text-dim); cursor: pointer; border-radius: var(--radius-sm);
  border: none; background: none; font-family: inherit;
  display: flex; align-items: center; gap: 0.35rem;
  transition: all 0.15s; white-space: nowrap;
}
.nav-btn:hover  { color: var(--text); background: var(--bg3); }
.nav-btn.active {
  color: #fff;
  background: var(--grad);
  border: none;
  box-shadow: 0 4px 12px -4px rgba(43,88,192,0.45);
}

.header-right { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }

.quota-pill {
  display: flex; align-items: center; gap: 0.4rem;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 20px; padding: 0.25rem 0.7rem;
  font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-dim);
}
.quota-pill.danger { border-color: rgba(248,113,113,0.4); color: var(--red); background: var(--red-muted); }
.quota-ico  { font-size: 0.8rem; }
.quota-text { color: var(--text); }
.quota-pill.danger .quota-text { color: var(--red); }
.quota-sep  { color: var(--text-muted); margin: 0 0.1rem; }

.ws-pill { display: flex; align-items: center; gap: 0.4rem; }
.ws-dot {
  width: 7px; height: 7px; border-radius: 50%;
  &.green { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
  &.red   { background: var(--red); }
}
.ws-text { font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono); }

/* ── Botón de usuario ── */
.user-wrap { position: relative; }

.user-btn {
  display: flex; align-items: center; gap: 0.55rem;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.3rem 0.65rem 0.3rem 0.4rem;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.user-btn:hover { border-color: var(--border-hi); background: var(--bg2); }

.user-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--cyan));
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: 700; color: #fff;
  flex-shrink: 0; letter-spacing: 0.02em;
}
.user-info { display: flex; flex-direction: column; align-items: flex-start; }
.user-name { font-size: 0.78rem; font-weight: 600; color: var(--text); line-height: 1.2; }
.user-role { font-size: 0.62rem; color: var(--text-dim); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; }
.user-chevron { font-size: 0.65rem; color: var(--text-muted); transition: transform 0.2s; margin-left: 0.1rem; }
.user-chevron.open { transform: rotate(180deg); }

/* ── Dropdown ── */
.user-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 240px;
  background: var(--bg2); border: 1px solid var(--border-hi);
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  overflow: hidden; z-index: 200;
}

.dropdown-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1rem 0.85rem;
  background: var(--bg3);
}
.dh-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent), var(--cyan));
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 700; color: #fff;
}
.dh-name  { font-size: 0.88rem; font-weight: 600; color: var(--text); }
.dh-email { font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono); margin: 0.1rem 0 0.3rem; }
.dh-role-badge {
  font-size: 0.62rem; font-weight: 600; padding: 0.1rem 0.5rem;
  border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em;
  background: var(--accent-muted); color: var(--accent);
}

.dropdown-divider { height: 1px; background: var(--border); }

.dropdown-item {
  display: flex; align-items: center; gap: 0.6rem;
  width: 100%; padding: 0.7rem 1rem;
  background: none; border: none; font-family: inherit;
  font-size: 0.82rem; color: var(--text-dim);
  cursor: pointer; transition: all 0.15s; text-align: left;
}
.dropdown-item:hover { background: var(--bg3); color: var(--text); }
.dropdown-item.danger:hover { background: var(--red-muted); color: var(--red); }
.di-icon { font-size: 0.9rem; }

/* ── Modal de confirmación ── */
.confirm-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.confirm-card {
  background: var(--bg2); border: 1px solid var(--border-hi);
  border-radius: 16px; padding: 2rem 2rem 1.75rem;
  width: 100%; max-width: 360px;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}
.confirm-icon  { font-size: 2rem; margin-bottom: 0.75rem; }
.confirm-title { font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; }
.confirm-desc  { font-size: 0.83rem; color: var(--text-dim); line-height: 1.6; margin-bottom: 1.5rem; }
.confirm-desc b { color: var(--text); }
.confirm-actions { display: flex; gap: 0.65rem; justify-content: center; }

.btn { border: none; border-radius: var(--radius-sm); padding: 0.55rem 1.1rem; font-size: 0.83rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-ghost  { background: var(--bg3); color: var(--text-dim); }
.btn-ghost:hover { color: var(--text); }
.btn-danger { background: var(--red-muted); color: var(--red); border: 1px solid rgba(248,113,113,0.25); }
.btn-danger:hover { background: rgba(248,113,113,0.2); }
.btn-accent { background: var(--accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: var(--accent-hover); }
.btn-accent:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Campos cambiar contraseña ── */
.cp-fields { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; text-align: left; }
.cp-field  { display: flex; flex-direction: column; gap: 0.35rem; }
.cp-field label { font-size: 0.75rem; font-weight: 500; color: var(--text-dim); }
.cp-field input {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.6rem 0.85rem;
  color: var(--text); font-size: 0.88rem; font-family: inherit; outline: none;
  transition: border-color 0.15s;
}
.cp-field input:focus { border-color: var(--accent); }
.cp-error   { font-size: 0.8rem; color: var(--red); background: var(--red-muted); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); }
.cp-success { font-size: 0.8rem; color: var(--green); background: rgba(74,222,128,0.1); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); }

/* Animaciones */
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

@media (max-width: 768px) {
  .nav-label { display: none; }
  .user-info  { display: none; }
}
</style>
