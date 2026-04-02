import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/axios'
import router from '@/router'

/**
 * Store de autenticación.
 * defineStore(id, setup) → crea un store con la Composition API de Pinia.
 * Es como un "estado global" accesible desde cualquier componente.
 */
export const useAuthStore = defineStore('auth', () => {

  // ── Estado ───────────────────────────────────────────────────
  // ref() → variable reactiva. Cuando cambia, los componentes que la
  // usan se re-renderizan automáticamente (como useState en React).
  const token = ref(localStorage.getItem('token') || null)
  const user  = ref(localStorage.getItem('user')  || null)

  // ── Computed ──────────────────────────────────────────────────
  // computed() → valor derivado que se recalcula cuando cambia su dependencia.
  // isAuthenticated = true si hay token, false si no.
  const isAuthenticated = computed(() => !!token.value)

  // ── Acciones ──────────────────────────────────────────────────
  async function login(username, password) {
    // Llama al backend: POST /api/auth/login
    const { data } = await api.post('/auth/login', { user: username, password })

    // Guarda en el estado reactivo Y en localStorage (persiste al recargar)
    token.value = data.token
    user.value  = username
    localStorage.setItem('token', data.token)
    localStorage.setItem('user',  username)

    // Navega al dashboard
    router.push('/')
  }

  function logout() {
    token.value = null
    user.value  = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  // Los valores y funciones que expones al componente que use este store
  return { token, user, isAuthenticated, login, logout }
})
