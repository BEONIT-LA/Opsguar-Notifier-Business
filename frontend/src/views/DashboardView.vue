<template>
  <div class="dashboard">

    <!-- ── Header fijo ── -->
    <TheHeader :active-tab="activeTab" @tab-change="activeTab = $event" />

    <!-- ── Contenido principal ── -->
    <main class="main-content">
      <keep-alive>
        <component :is="currentTabComponent" :key="activeTab" />
      </keep-alive>
    </main>

    <!-- ── Panel de actividad en tiempo real (fijo al fondo) ── -->
    <LiveFeed />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TheHeader     from '@/components/TheHeader.vue'
import LiveFeed      from '@/components/LiveFeed.vue'
import SessionsTab   from '@/components/tabs/SessionsTab.vue'
import SendTab       from '@/components/tabs/SendTab.vue'
import GroupsTab     from '@/components/tabs/GroupsTab.vue'
import SystemTab     from '@/components/tabs/SystemTab.vue'
import ApiTab        from '@/components/tabs/ApiTab.vue'
import AuditTab      from '@/components/tabs/AuditTab.vue'
import { useSocket } from '@/composables/useSocket'

// Inicia la conexión Socket.io cuando se monta el dashboard
onMounted(() => {
  useSocket()
})

// Tab activo por defecto
const activeTab = ref('sessions')

// Mapa de tab → componente
// computed() recalcula cuando cambia activeTab.value
const tabComponents = {
  sessions: SessionsTab,
  send:     SendTab,
  groups:   GroupsTab,
  system:   SystemTab,
  api:      ApiTab,
  audit:    AuditTab,
}

const currentTabComponent = computed(() => tabComponents[activeTab.value])
</script>

<style scoped>
.dashboard { min-height: 100vh; }

.main-content {
  padding-top: var(--header-h);
  /* 36px header del feed + 160px body + 8px margen */
  padding-bottom: 210px;
  position: relative;
  z-index: 1;
}
</style>
