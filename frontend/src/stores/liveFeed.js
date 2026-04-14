import { defineStore } from 'pinia'
import { ref } from 'vue'

const MAX_ENTRIES = 200

export const useLiveFeedStore = defineStore('liveFeed', () => {
  const entries  = ref([])   // { id, type, message, time }
  const unread   = ref(0)
  const isOpen   = ref(true)

  function add(type, message) {
    entries.value.unshift({
      id:      Date.now() + Math.random(),
      type,    // 'success' | 'error' | 'warn' | 'info' | 'system'
      message,
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    })
    // Limita a MAX_ENTRIES para no crecer infinito
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES)
    }
    if (!isOpen.value) unread.value++
  }

  function clear() {
    entries.value = []
    unread.value  = 0
  }

  function toggle() {
    isOpen.value  = !isOpen.value
    if (isOpen.value) unread.value = 0
  }

  return { entries, unread, isOpen, add, clear, toggle }
})
