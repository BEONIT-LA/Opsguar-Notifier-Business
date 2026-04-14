import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/axios'

export const useSessionsStore = defineStore('sessions', () => {

  // ── Estado ────────────────────────────────────────────────────
  const sessions = ref({})   // { sessionId: { status, isReady, phone, ... } }
  const loading  = ref(false)
  const error    = ref(null)

  // ── Computed helpers ──────────────────────────────────────────
  const sessionList  = () => Object.entries(sessions.value).map(([id, s]) => ({ id, ...s }))
  const totalReady   = () => Object.values(sessions.value).filter(s => s.isReady).length
  const totalSessions = () => Object.keys(sessions.value).length

  // ── Acciones ──────────────────────────────────────────────────
  async function fetchSessions() {
    try {
      loading.value = true
      const { data } = await api.get('/sessions')
      sessions.value = data.data.sessions
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createSession(sessionId) {
    const { data } = await api.post('/sessions', { sessionId })
    await fetchSessions()
    return data
  }

  async function deleteSession(id) {
    await api.delete(`/sessions/${id}`)
    await fetchSessions()
  }

  async function getQR(id) {
    const { data } = await api.get(`/sessions/${id}/qr`)
    return data.data
  }

  // Actualiza desde Socket.io sin necesidad de hacer fetch completo
  function updateFromSocket(sessionsData) {
    sessions.value = sessionsData
  }

  return {
    sessions, loading, error,
    sessionList, totalReady, totalSessions,
    fetchSessions, createSession, deleteSession, getQR, updateFromSocket,
  }
})
