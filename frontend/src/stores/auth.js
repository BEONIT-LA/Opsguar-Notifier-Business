import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/axios'
import router from '@/router'

function loadTenant() {
  try { return JSON.parse(localStorage.getItem('tenant') || 'null') }
  catch { return null }
}

export const useAuthStore = defineStore('auth', () => {

  // ── Estado ────────────────────────────────────────────────────
  const token    = ref(localStorage.getItem('token')    || null)
  const user     = ref(localStorage.getItem('user')     || null)
  const fullName = ref(localStorage.getItem('fullName') || null)
  const email    = ref(localStorage.getItem('email')    || null)
  const role     = ref(localStorage.getItem('role')     || null)
  const tenant   = ref(loadTenant())   // { id, name, slug } | null
  const usage    = ref(null)           // resumen de cuota/consumo del tenant

  // ── Computed ──────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!token.value)
  const isSuperadmin    = computed(() => role.value === 'superadmin')
  const isManager       = computed(() => role.value === 'manager' || role.value === 'operator')

  // ── Acciones ──────────────────────────────────────────────────
  async function login(username, password) {
    const { data } = await api.post('/auth/login', { user: username, password })

    token.value    = data.token
    user.value     = data.user
    fullName.value = data.fullName || null
    email.value    = data.email    || null
    role.value     = data.role     || 'manager'
    tenant.value   = data.tenant   || null

    localStorage.setItem('token',    data.token)
    localStorage.setItem('user',     data.user)
    localStorage.setItem('fullName', data.fullName || '')
    localStorage.setItem('email',    data.email    || '')
    localStorage.setItem('role',     data.role     || 'manager')
    localStorage.setItem('tenant',   JSON.stringify(data.tenant || null))

    // Redirige según el rol: superadmin → consola de plataforma
    router.push(isSuperadmin.value ? '/admin' : '/')
  }

  /** Carga el consumo/cuota del tenant (solo managers). */
  async function fetchMe() {
    if (!isManager.value) return
    try {
      const { data } = await api.get('/me')
      usage.value  = data.data.usage
      tenant.value = data.data.tenant || tenant.value
      localStorage.setItem('tenant', JSON.stringify(tenant.value))
    } catch (_) { /* no bloquea la UI */ }
  }

  function logout() {
    token.value = null; user.value = null
    fullName.value = null; email.value = null; role.value = null
    tenant.value = null; usage.value = null
    for (const k of ['token','user','fullName','email','role','tenant']) localStorage.removeItem(k)
    router.push('/login')
  }

  return {
    token, user, fullName, email, role, tenant, usage,
    isAuthenticated, isSuperadmin, isManager,
    login, fetchMe, logout,
  }
})
