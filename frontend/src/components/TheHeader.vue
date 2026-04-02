<template>
  <header class="header">
    <!-- Logo -->
    <div class="logo">
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
            fill="url(#sh2)" />
          <circle cx="12" cy="12" r="3" fill="white" opacity="0.9"/>
          <defs>
            <linearGradient id="sh2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1a85fb"/>
              <stop offset="100%" stop-color="#3bd1ff"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div>
        <div class="logo-text">OPSGUARD</div>
        <div class="logo-sub">WA Automation</div>
      </div>
    </div>

    <div class="header-sep"></div>

    <!-- Navegación de tabs -->
    <!--
      v-for → itera sobre un array (como .map() en JS).
      @click → escucha el evento click (shorthand de v-on:click).
      :class → clases dinámicas: añade 'active' si el tab es el activo.
      $emit → emite un evento al componente padre (DashboardView).
    -->
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

    <!-- Lado derecho: estado WS + usuario + logout -->
    <div class="header-right">
      <!-- Indicador Socket.io -->
      <div class="ws-pill">
        <span class="ws-dot" :class="wsConnected ? 'green' : 'red'"></span>
        <span class="ws-text">{{ wsConnected ? 'Live' : 'Offline' }}</span>
      </div>

      <div class="header-sep"></div>

      <!-- Usuario logueado -->
      <span class="header-user">👤 {{ auth.user }}</span>

      <!-- Botón logout -->
      <button class="logout-btn" @click="auth.logout()" title="Cerrar sesión">⏏</button>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSocket }    from '@/composables/useSocket'

// defineProps → declara las props que recibe este componente del padre.
// Equivalente a los "atributos" de un componente React.
const props = defineProps({
  activeTab: { type: String, required: true },
})

// defineEmits → declara los eventos que este componente puede emitir al padre.
defineEmits(['tab-change'])

const auth = useAuthStore()

// Tabs de navegación
const tabs = [
  { id: 'sessions', icon: '📱', label: 'Sesiones'  },
  { id: 'send',     icon: '✉️',  label: 'Enviar'    },
  { id: 'groups',   icon: '👥',  label: 'Grupos'    },
  { id: 'system',   icon: '⚙️',  label: 'Sistema'   },
  { id: 'api',      icon: '📖',  label: 'API'       },
  { id: 'audit',    icon: '📋',  label: 'Auditoría' },
]

// Estado de conexión Socket.io
const wsConnected = ref(false)
const { socket } = useSocket()

// onMounted → se ejecuta cuando el componente se inserta en el DOM.
// Equivalente a componentDidMount en React.
onMounted(() => {
  wsConnected.value = socket.connected
  socket.on('connect',    () => { wsConnected.value = true  })
  socket.on('disconnect', () => { wsConnected.value = false })
})

// onUnmounted → limpieza cuando el componente se destruye.
onUnmounted(() => {
  socket.off('connect')
  socket.off('disconnect')
})
</script>

<style scoped>
.header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  background: rgba(22,27,38,0.93);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  gap: 0.75rem;
  z-index: 100;
}

.logo { display: flex; align-items: center; gap: 0.6rem; }

.logo-icon {
  width: 32px; height: 32px;
  background: var(--accent-muted);
  border: 1px solid var(--border-hi);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 18px rgba(26,133,251,0.40);
}

.logo-text { font-size: 0.88rem; font-weight: 700; color: var(--text); letter-spacing: 0.08em; font-family: var(--font-ui); }
.logo-sub  { font-size: 0.63rem; color: var(--text-dim); font-family: var(--font-mono); letter-spacing: 0.04em; }

.header-sep { width: 1px; height: 20px; background: var(--border); margin: 0 0.25rem; flex-shrink: 0; }

.header-nav { display: flex; gap: 2px; }

.nav-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-dim);
  cursor: pointer;
  border-radius: var(--radius-sm);
  border: none;
  background: none;
  font-family: inherit;
  display: flex; align-items: center; gap: 0.35rem;
  transition: all 0.15s;
  white-space: nowrap;
}
.nav-btn:hover  { color: var(--text); background: var(--bg3); }
.nav-btn.active { color: var(--accent); background: var(--accent-muted); }

.header-right {
  margin-left: auto;
  display: flex; align-items: center; gap: 0.75rem;
}

.ws-pill { display: flex; align-items: center; gap: 0.4rem; }
.ws-dot {
  width: 7px; height: 7px; border-radius: 50%;
  &.green { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
  &.red   { background: var(--red); }
}
.ws-text { font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono); }

.header-user { font-size: 0.78rem; color: var(--text-dim); }

.logout-btn {
  background: none; border: none; cursor: pointer;
  color: var(--text-dim); font-size: 1rem; padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm); transition: all 0.15s;
}
.logout-btn:hover { color: var(--red); background: var(--red-muted); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@media (max-width: 768px) {
  .nav-label { display: none; }
  .header-user { display: none; }
}
</style>
