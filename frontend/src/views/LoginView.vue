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
          <div class="brand-sub">Notificaciones WhatsApp</div>
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
/* ── Login page — Aurora UI + Glassmorphism (skill: Tech Startup) ── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  padding: 1rem;
}

/* Orbs decorativos Aurora detrás del card */
.login-page::before {
  content: '';
  position: fixed;
  width: 600px; height: 600px;
  top: -150px; left: -150px;
  background: radial-gradient(circle, rgba(26,133,251,0.18) 0%, transparent 65%);
  border-radius: 50%;
  pointer-events: none;
  animation: orb-float 12s ease-in-out infinite alternate;
}
.login-page::after {
  content: '';
  position: fixed;
  width: 500px; height: 500px;
  bottom: -100px; right: -100px;
  background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 65%);
  border-radius: 50%;
  pointer-events: none;
  animation: orb-float 15s ease-in-out infinite alternate-reverse;
}

/* transform + scale únicamente — GPU-accelerated ✅ */
@keyframes orb-float {
  0%   { transform: translate(0px, 0px)   scale(1);    opacity: 1;   }
  50%  { transform: translate(25px, 15px) scale(1.08); opacity: 0.8; }
  100% { transform: translate(40px, 30px) scale(1.12); opacity: 0.9; }
}

/* ── Card glassmorphism ── */
.login-card {
  width: 100%;
  max-width: 400px;
  background: rgba(13, 17, 23, 0.72);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(26,133,251,0.18);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  box-shadow:
    0 32px 80px rgba(0,0,0,0.5),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 1px 0 rgba(255,255,255,0.06) inset;
  position: relative;
  z-index: 2;
}

/* Línea superior degradada — detalle premium */
.login-card::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(26,133,251,0.6), rgba(124,58,237,0.5), transparent);
  border-radius: 1px;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.brand-icon {
  width: 48px; height: 48px;
  background: linear-gradient(135deg, rgba(26,133,251,0.2), rgba(124,58,237,0.2));
  border: 1px solid rgba(26,133,251,0.3);
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 24px rgba(26,133,251,0.3), 0 0 48px rgba(124,58,237,0.15);
}

.brand-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.09em;
  font-family: var(--font-ui);
  background: linear-gradient(135deg, #e2eaf6, #1a85fb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-sub {
  font-size: 0.68rem;
  color: var(--text-dim);
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}

.login-title {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.3rem;
  font-family: var(--font-ui);
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
  letter-spacing: 0.02em;
}

.field-input {
  background: rgba(30, 39, 54, 0.8);
  border: 1px solid rgba(26,133,251,0.12);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.95rem;
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.field-input:focus {
  border-color: rgba(26,133,251,0.5);
  background: rgba(30, 39, 54, 0.95);
  box-shadow: 0 0 0 3px rgba(26,133,251,0.10), 0 0 20px rgba(26,133,251,0.08);
}

.field-input::placeholder { color: var(--text-muted); }

.login-error {
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: var(--radius-sm);
  color: var(--red);
  font-size: 0.82rem;
  padding: 0.6rem 0.9rem;
}

/* Botón con gradiente aurora */
.login-btn {
  margin-top: 0.5rem;
  background: linear-gradient(135deg, var(--accent) 0%, var(--violet) 100%);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 20px rgba(26,133,251,0.25);
  letter-spacing: 0.02em;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.92;
  box-shadow: 0 6px 28px rgba(26,133,251,0.35);
  transform: translateY(-1px);
}
.login-btn:active:not(:disabled) { transform: scale(0.98) translateY(0); }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

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

@media (prefers-reduced-motion: reduce) {
  .login-page::before,
  .login-page::after { animation: none; }
}
</style>
