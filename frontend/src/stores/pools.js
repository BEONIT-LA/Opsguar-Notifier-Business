import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/axios'

export const usePoolsStore = defineStore('pools', () => {
  const pools   = ref([])
  const loading = ref(false)
  const error   = ref(null)

  async function fetchPools() {
    loading.value = true
    error.value   = null
    try {
      const { data } = await api.get('/pools')
      pools.value = data.data
    } catch (e) {
      error.value = e.response?.data?.message || e.message
    } finally {
      loading.value = false
    }
  }

  async function createPool(payload) {
    const { data } = await api.post('/pools', payload)
    pools.value.push(data.data)
    return data.data
  }

  async function updatePool(id, payload) {
    const { data } = await api.put(`/pools/${id}`, payload)
    const idx = pools.value.findIndex(p => p.id === id)
    if (idx !== -1) pools.value[idx] = data.data
    return data.data
  }

  async function deletePool(id) {
    await api.delete(`/pools/${id}`)
    pools.value = pools.value.filter(p => p.id !== id)
  }

  return { pools, loading, error, fetchPools, createPool, updatePool, deletePool }
})
