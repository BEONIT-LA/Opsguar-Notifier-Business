<template>
  <div class="tab-page">
    <div class="page-header">
      <div>
        <div class="page-title">Sistema</div>
        <div class="page-desc">Estado general del servicio · salud de componentes</div>
      </div>
      <button class="btn btn-ghost" @click="fetchHealth">↺ Actualizar</button>
    </div>

    <div v-if="loading" class="loading-text">Cargando...</div>

    <div v-else-if="health" class="system-grid">

      <!-- Status general -->
      <div class="sys-card wide">
        <div class="sys-card-header">
          <span class="sys-icon">🚦</span>
          <span class="sys-title">Estado general</span>
          <span class="badge" :class="health.status === 'ok' ? 'ready' : 'failed'">
            {{ health.status }}
          </span>
        </div>
        <div class="sys-stats">
          <div class="sys-stat">
            <div class="sys-val">{{ formatUptime(health.uptime) }}</div>
            <div class="sys-lbl">Uptime</div>
          </div>
          <div class="sys-stat">
            <div class="sys-val" :class="health.redis === 'ok' ? 'green' : 'red'">
              {{ health.redis === 'ok' ? '✓ OK' : '✗ Error' }}
            </div>
            <div class="sys-lbl">Redis</div>
          </div>
          <div class="sys-stat">
            <div class="sys-val green">{{ health.sessions?.ready }}</div>
            <div class="sys-lbl">Sesiones listas</div>
          </div>
          <div class="sys-stat">
            <div class="sys-val">{{ health.sessions?.total }}</div>
            <div class="sys-lbl">Sesiones total</div>
          </div>
        </div>
      </div>

      <!-- Memoria -->
      <div class="sys-card">
        <div class="sys-card-header">
          <span class="sys-icon">💾</span>
          <span class="sys-title">Memoria</span>
        </div>
        <div class="mem-bars">
          <div class="mem-row">
            <span class="mem-lbl">Heap usado</span>
            <div class="mem-bar-wrap">
              <div class="mem-bar" :style="{ width: heapPct + '%' }" :class="heapPct > 80 ? 'red' : 'accent'"></div>
            </div>
            <span class="mem-val">{{ health.memory?.heapUsedMB }} MB</span>
          </div>
          <div class="mem-row">
            <span class="mem-lbl">Heap total</span>
            <div class="mem-bar-wrap">
              <div class="mem-bar accent" style="width:100%"></div>
            </div>
            <span class="mem-val">{{ health.memory?.heapTotalMB }} MB</span>
          </div>
          <div class="mem-row">
            <span class="mem-lbl">RSS proceso</span>
            <div class="mem-bar-wrap">
              <div class="mem-bar cyan" :style="{ width: Math.min(100, (health.memory?.rssMB / 512) * 100) + '%' }"></div>
            </div>
            <span class="mem-val">{{ health.memory?.rssMB }} MB</span>
          </div>
        </div>
      </div>

      <!-- Cola -->
      <div class="sys-card">
        <div class="sys-card-header">
          <span class="sys-icon">📬</span>
          <span class="sys-title">Cola de mensajes</span>
        </div>
        <div class="sys-stats small">
          <div class="sys-stat">
            <div class="sys-val yellow">{{ queue.stats.waiting }}</div>
            <div class="sys-lbl">En espera</div>
          </div>
          <div class="sys-stat">
            <div class="sys-val accent">{{ queue.stats.active }}</div>
            <div class="sys-lbl">Activos</div>
          </div>
          <div class="sys-stat">
            <div class="sys-val green">{{ queue.stats.totalCompleted }}</div>
            <div class="sys-lbl">Completados</div>
          </div>
          <div class="sys-stat">
            <div class="sys-val red">{{ queue.stats.totalFailed }}</div>
            <div class="sys-lbl">Fallidos</div>
          </div>
        </div>
      </div>

      <!-- Timestamp -->
      <div class="sys-footer">Última actualización: {{ health.timestamp ? new Date(health.timestamp).toLocaleString('es') : '–' }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'
import { useQueueStore } from '@/stores/queue'

const queue   = useQueueStore()
const health  = ref(null)
const loading = ref(false)

onMounted(async () => {
  await Promise.all([fetchHealth(), queue.fetchStats()])
})

async function fetchHealth() {
  loading.value = true
  try {
    const { data } = await api.get('/health')
    health.value = data.data
  } finally {
    loading.value = false
  }
}

// Porcentaje heap para la barra
const heapPct = computed(() =>
  health.value
    ? Math.round((health.value.memory.heapUsedMB / health.value.memory.heapTotalMB) * 100)
    : 0
)

function formatUptime(seconds) {
  if (!seconds) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}h ${m}m ${s}s`
}
</script>

<style scoped>
.tab-page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
.page-title  { font-size: 1.15rem; font-weight: 600; }
.page-desc   { font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem; }
.loading-text { color: var(--text-dim); text-align: center; padding: 3rem; }

.system-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.sys-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.sys-card.wide { grid-column: 1 / -1; }

.sys-card-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.sys-icon  { font-size: 1.1rem; }
.sys-title { font-size: 0.9rem; font-weight: 600; flex: 1; }

.badge { font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 20px; text-transform: uppercase; }
.badge.ready  { background: var(--green-muted); color: var(--green); }
.badge.failed { background: var(--red-muted);   color: var(--red);   }

.sys-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.sys-stats.small { grid-template-columns: repeat(2, 1fr); }
.sys-stat  { text-align: center; }
.sys-val   { font-size: 1.5rem; font-weight: 700; }
.sys-val.green  { color: var(--green);  }
.sys-val.red    { color: var(--red);    }
.sys-val.yellow { color: var(--yellow); }
.sys-val.accent { color: var(--accent); }
.sys-lbl   { font-size: 0.72rem; color: var(--text-dim); margin-top: 0.2rem; }

.mem-bars { display: flex; flex-direction: column; gap: 0.75rem; }
.mem-row  { display: grid; grid-template-columns: 90px 1fr 60px; align-items: center; gap: 0.75rem; }
.mem-lbl  { font-size: 0.75rem; color: var(--text-dim); }
.mem-bar-wrap { background: var(--bg3); border-radius: 4px; height: 6px; overflow: hidden; }
.mem-bar  { height: 100%; border-radius: 4px; transition: width 0.4s; }
.mem-bar.accent { background: var(--accent); }
.mem-bar.cyan   { background: var(--cyan); }
.mem-bar.red    { background: var(--red); }
.mem-val  { font-size: 0.75rem; color: var(--text-dim); text-align: right; }

.sys-footer { grid-column: 1/-1; font-size: 0.72rem; color: var(--text-muted); text-align: right; }

.btn { border: none; border-radius: var(--radius-sm); padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; }
.btn-ghost { background: var(--bg3); color: var(--text-dim); }
.btn-ghost:hover { color: var(--text); }

@media (max-width: 600px) {
  .system-grid { grid-template-columns: 1fr; }
  .sys-card.wide { grid-column: 1; }
  .sys-stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
