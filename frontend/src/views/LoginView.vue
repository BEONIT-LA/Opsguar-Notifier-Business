<template>
  <div class="login-page">
    <!-- Fondo de marca: degradado teal→azul + círculos glassmorphism flotantes -->
    <div class="bg"></div>
    <ul class="circles" aria-hidden="true">
      <li></li><li></li><li></li><li></li><li></li>
      <li></li><li></li><li></li><li></li><li></li>
    </ul>

    <div class="login-card">

      <!-- Marca Be On It -->
      <div class="login-brand">
        <div class="brand-mark">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#fff" opacity="0.95"/>
            <circle cx="12" cy="12" r="3" fill="#2f6fd0"/>
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-name">Be On It</div>
          <div class="brand-sub">OpsGuard SaaS</div>
        </div>
      </div>

      <h2 class="login-title">Iniciar sesión</h2>
      <p class="login-desc">Ingresa tus credenciales para continuar</p>

      <form @submit.prevent="handleLogin" class="login-form">

        <div class="field-group">
          <label class="field-label">Usuario</label>
          <input
            v-model="form.user"
            type="text"
            class="field-input"
            placeholder="tu usuario"
            autocomplete="username"
            required
          />
        </div>

        <div class="field-group">
          <label class="field-label">Contraseña</label>
          <div class="field-pass">
            <input
              v-model="form.password"
              :type="showPass ? 'text' : 'password'"
              class="field-input"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
            <button type="button" class="pass-toggle" @click="showPass = !showPass" tabindex="-1">
              {{ showPass ? '🙈' : '👁' }}
            </button>
          </div>
        </div>

        <div v-if="errorMsg" class="login-error">⚠ {{ errorMsg }}</div>

        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Ingresar</span>
        </button>
      </form>

      <div class="login-footer">Be digital, be secure, be inspired.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const form = reactive({ user: '', password: '' })
const loading  = ref(false)
const errorMsg = ref('')
const showPass = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  loading.value  = true
  try {
    await auth.login(form.user, form.password)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ── Pantalla de bienvenida Be On It (momento de marca) ── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 1rem;
  overflow: hidden;
}

.bg {
  position: fixed; inset: 0;
  background: var(--grad-login, linear-gradient(150deg, #1f63c4 0%, #2f80d0 45%, #28b6c9 100%));
  z-index: 0;
}

/* Círculos glassmorphism flotantes */
.circles { position: fixed; inset: 0; overflow: hidden; margin: 0; padding: 0; z-index: 1; }
.circles li {
  position: absolute; display: block; list-style: none;
  width: 20px; height: 20px;
  background: rgba(255,255,255,0.13);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 18px;
  backdrop-filter: blur(6px);
  bottom: -160px;
  animation: floatup 26s linear infinite;
}
.circles li:nth-child(1)  { left: 25%; width: 80px;  height: 80px;  animation-delay: 0s;  }
.circles li:nth-child(2)  { left: 10%; width: 24px;  height: 24px;  animation-delay: 2s;  animation-duration: 18s; }
.circles li:nth-child(3)  { left: 70%; width: 24px;  height: 24px;  animation-delay: 4s;  }
.circles li:nth-child(4)  { left: 40%; width: 60px;  height: 60px;  animation-delay: 0s;  animation-duration: 20s; }
.circles li:nth-child(5)  { left: 65%; width: 24px;  height: 24px;  animation-delay: 0s;  }
.circles li:nth-child(6)  { left: 75%; width: 110px; height: 110px; animation-delay: 3s;  }
.circles li:nth-child(7)  { left: 35%; width: 150px; height: 150px; animation-delay: 7s;  }
.circles li:nth-child(8)  { left: 50%; width: 28px;  height: 28px;  animation-delay: 15s; animation-duration: 35s; }
.circles li:nth-child(9)  { left: 20%; width: 16px;  height: 16px;  animation-delay: 2s;  animation-duration: 35s; }
.circles li:nth-child(10) { left: 85%; width: 150px; height: 150px; animation-delay: 0s;  animation-duration: 13s; }

@keyframes floatup {
  0%   { transform: translateY(0) rotate(0);        opacity: 1; border-radius: 18px; }
  100% { transform: translateY(-1100px) rotate(720deg); opacity: 0; border-radius: 50%; }
}

/* Tarjeta blanca */
.login-card {
  position: relative; z-index: 2;
  width: 100%; max-width: 380px;
  background: rgba(255,255,255,0.95);
  border-radius: 22px;
  padding: 2.25rem 2rem;
  box-shadow: 0 30px 70px -25px rgba(16,40,80,0.5);
  backdrop-filter: blur(8px);
}

.login-brand { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 1.5rem; }
.brand-mark {
  width: 44px; height: 44px; border-radius: 13px;
  display: grid; place-items: center;
  background: var(--grad, linear-gradient(145deg,#28b6c9,#2b58c0));
  box-shadow: 0 8px 18px -6px rgba(43,88,192,0.55);
}
.brand-name { font-size: 1.05rem; font-weight: 700; color: var(--ink, #22303c); letter-spacing: -0.01em; }
.brand-sub  { font-size: 0.7rem; color: var(--muted, #5d6b7c); font-family: var(--font-mono); letter-spacing: 0.02em; }

.login-title { font-size: 1.3rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; }
.login-desc  { font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem; }

.login-form { display: flex; flex-direction: column; gap: 1rem; }
.field-group { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-size: 0.78rem; font-weight: 500; color: var(--text-dim); }
.field-input {
  width: 100%;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg3);
  color: var(--text);
  font-size: 0.9rem; font-family: inherit;
  outline: none; transition: 0.15s;
}
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); background: #fff; }

.field-pass { position: relative; }
.pass-toggle {
  position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 0.95rem; opacity: 0.7;
}
.pass-toggle:hover { opacity: 1; }

.login-error {
  font-size: 0.8rem; color: var(--red);
  background: var(--red-soft, var(--red-muted)); border: 1px solid rgba(226,59,80,0.25);
  padding: 0.55rem 0.75rem; border-radius: 9px;
}

.login-btn {
  margin-top: 0.25rem;
  padding: 0.8rem;
  border: none; border-radius: 11px;
  background: var(--grad, linear-gradient(145deg,#28b6c9,#2b58c0));
  color: #fff; font-weight: 700; font-size: 0.9rem; font-family: inherit;
  cursor: pointer; transition: 0.15s;
  box-shadow: 0 12px 26px -10px rgba(47,111,208,0.6);
  display: flex; align-items: center; justify-content: center;
}
.login-btn:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
.login-btn:disabled { opacity: 0.7; cursor: not-allowed; }

.spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.login-footer { margin-top: 1.5rem; text-align: center; font-size: 0.72rem; color: var(--text-muted); }

@media (prefers-reduced-motion: reduce) {
  .circles li { animation: none; display: none; }
}
</style>
