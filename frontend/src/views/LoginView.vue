<template>
  <div class="login-page">
    <div class="login-card">

      <!-- Logo OPSGUARD -->
      <div class="login-brand">
        <div class="brand-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
              fill="url(#shield-grad)" />
            <circle cx="12" cy="12" r="3" fill="white" opacity="0.9"/>
            <defs>
              <linearGradient id="shield-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#1a85fb"/>
                <stop offset="100%" stop-color="#3bd1ff"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <div class="brand-name">OPSGUARD</div>
          <div class="brand-sub">WA Automation Hub</div>
        </div>
      </div>

      <h2 class="login-title">Iniciar sesión</h2>
      <p class="login-desc">Ingresa tus credenciales para continuar</p>

      <!-- Formulario de login -->
      <!-- @submit.prevent → evita el reload del navegador (como e.preventDefault()) -->
      <form @submit.prevent="handleLogin" class="login-form">

        <div class="field-group">
          <label class="field-label">Usuario</label>
          <!-- v-model → enlaza el input con la variable reactiva (two-way binding) -->
          <input
            v-model="form.user"
            type="text"
            class="field-input"
            placeholder="admin"
            autocomplete="username"
            required
          />
        </div>

        <div class="field-group">
          <label class="field-label">Contraseña</label>
          <input
            v-model="form.password"
            :type="showPass ? 'text' : 'password'"
            class="field-input"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>

        <!-- v-if / v-else → renderizado condicional (como if/else en JS) -->
        <div v-if="errorMsg" class="login-error">⚠ {{ errorMsg }}</div>

        <button type="submit" class="login-btn" :disabled="loading">
          <!-- :disabled → binding dinámico de atributos (el : es shorthand de v-bind:) -->
          <span v-if="loading" class="spinner"></span>
          <span v-else>Ingresar</span>
        </button>
      </form>

      <div class="login-footer">OpsGuard · Keep it simple, get it right.</div>
    </div>
  </div>
</template>

<script setup>
/**
 * <script setup> → es la sintaxis moderna de Vue 3 (Composition API).
 * Todo lo que declaras aquí es automáticamente accesible en el template.
 * Es equivalente al setup() de Vue 3 pero más conciso.
 */
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// reactive() → objeto reactivo (como ref pero para objetos)
const form = reactive({ user: '', password: '' })
const loading  = ref(false)
const errorMsg = ref('')
const showPass = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  loading.value  = true
  try {
    await auth.login(form.user, form.password)
    // Si login() no lanza error → el router redirige al dashboard automáticamente
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/**
 * scoped → los estilos aplican SOLO a este componente.
 * Vue agrega un atributo único data-v-xxxx para aislarlos.
 */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--bg2);
  border: 1px solid var(--border-hi);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(26,133,251,0.08);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.brand-icon {
  width: 48px; height: 48px;
  background: var(--accent-muted);
  border: 1px solid var(--border-hi);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(26,133,251,0.25);
}

.brand-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.08em;
  font-family: var(--font-ui);
}

.brand-sub {
  font-size: 0.68rem;
  color: var(--text-dim);
  font-family: var(--font-mono);
  letter-spacing: 0.03em;
}

.login-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.3rem;
}

.login-desc {
  font-size: 0.82rem;
  color: var(--text-dim);
  margin-bottom: 1.75rem;
}

.login-form { display: flex; flex-direction: column; gap: 1rem; }

.field-group { display: flex; flex-direction: column; gap: 0.4rem; }

.field-label {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-dim);
}

.field-input {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.9rem;
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.field-input::placeholder { color: var(--text-muted); }

.login-error {
  background: var(--red-muted);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: var(--radius-sm);
  color: var(--red);
  font-size: 0.82rem;
  padding: 0.6rem 0.9rem;
}

.login-btn {
  margin-top: 0.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.login-btn:hover:not(:disabled) { background: var(--accent-hover); }
.login-btn:active:not(:disabled) { transform: scale(0.98); }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.login-footer {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-muted);
}
</style>
