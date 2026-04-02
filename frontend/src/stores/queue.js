import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/axios'

export const useQueueStore = defineStore('queue', () => {

  const stats   = ref({ waiting: 0, active: 0, completed: 0, failed: 0, totalCompleted: 0, totalFailed: 0 })
  const loading = ref(false)

  async function fetchStats() {
    try {
      loading.value = true
      const { data } = await api.get('/queue/stats')
      stats.value = data.data
    } finally {
      loading.value = false
    }
  }

  // Actualiza desde Socket.io en tiempo real
  function updateFromSocket(newStats) {
    stats.value = { ...stats.value, ...newStats }
  }

  return { stats, loading, fetchStats, updateFromSocket }
})
