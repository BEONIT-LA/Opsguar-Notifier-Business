import axios from 'axios'

/**
 * Instancia de Axios configurada para la API.
 * Todas las peticiones al backend pasan por aquí.
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// ── Interceptor de REQUEST ──────────────────────────────────────
// Se ejecuta ANTES de cada petición.
// Añade automáticamente el token JWT en el header Authorization.
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de RESPONSE ─────────────────────────────────────
// Se ejecuta DESPUÉS de cada respuesta.
// Si el servidor devuelve 401 (token expirado) → logout automático.
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
