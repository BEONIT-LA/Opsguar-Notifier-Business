import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/axios'
import router from '@/router'

export const useAuthStore = defineStore('auth', () => {

  // ── Estado ────────────────────────────────────────────────────
  const token    = ref(localStorage.getItem('token')    || null)
  const user     = ref(localStorage.getItem('user')     || null)
  const fullName = ref(localStorage.getItem('fullName') || null)
  const email    = ref(localStorage.getItem('email')    || null)
  const role     = ref(localStorage.getItem('role')     || null)

  // ── Computed ──────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!token.value)

  // ── Acciones ──────────────────────────────────────────────────
  async function login(username, password) {
    const { data } = await api.post('/auth/login', { user: username, password })

    token.value    = data.token
    user.value     = data.user
    fullName.value = data.fullName || null
    email.value    = data.email    || null
    role.value     = data.role     || 'operator'

    localStorage.setItem('token',    data.token)
    localStorage.setItem('user',     data.user)
    localStorage.setItem('fullName', data.fullName || '')
    localStorage.setItem('email',    data.email    || '')
    localStorage.setItem('role',     data.role     || 'operator')

    router.push('/')
  }

  function logout() {
    token.value = null; user.value = null
    fullName.value = null; email.value = null; role.value = null
    localStorage.removeItem('token');    localStorage.removeItem('user')
    localStorage.removeItem('fullName'); localStorage.removeItem('email')
    localStorage.removeItem('role')
    router.push('/login')
  }

  return { token, user, fullName, email, role, isAuthenticated, login, logout }
})
