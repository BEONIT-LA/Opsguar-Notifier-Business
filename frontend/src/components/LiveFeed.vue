<template>
  <!-- Panel fijo al fondo de la pantalla, colapsable -->
  <div class="feed-wrap" :class="{ collapsed: !feed.isOpen }">

    <!-- ── Barra de título (siempre visible) ── -->
    <div class="feed-header" @click="feed.toggle()">
      <span class="feed-title">
        ⚡ Actividad en tiempo real
      </span>
      <span class="feed-count">{{ feed.entries.length }} eventos</span>

      <!-- Badge de no leídos cuando está colapsado -->
      <span v-if="!feed.isOpen && feed.unread > 0" class="unread-badge">
        {{ feed.unread }}
      </span>

      <div class="feed-actions" @click.stop>
        <button class="feed-btn" @click="feed.clear()" title="Limpiar">🗑</button>
        <button class="feed-btn" @click="feed.toggle()" :title="feed.isOpen ? 'Minimizar' : 'Expandir'">
          {{ feed.isOpen ? '▾' : '▴' }}
        </button>
      </div>
    </div>

    <!-- ── Lista de eventos ── -->
    <div v-show="feed.isOpen" class="feed-body" ref="feedBody">
      <div v-if="feed.entries.length === 0" class="feed-empty">
        Esperando eventos del servidor...
      </div>

      <div
        v-for="entry in feed.entries"
        :key="entry.id"
        class="feed-entry"
        :class="entry.type"
      >
        <span class="entry-time">{{ entry.time }}</span>
        <!-- v-html → renderiza HTML (para el <b> del nombre de sesión) -->
        <span class="entry-msg" v-html="entry.message"></span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { useLiveFeedStore } from '@/stores/liveFeed'
const feed = useLiveFeedStore()
</script>

<style scoped>
.feed-wrap {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 90;
  background: rgba(255,255,255,0.97);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(12px);
  box-shadow: 0 -8px 24px -16px rgba(30,58,95,0.25);
  transition: height 0.2s ease;
}

/* ── Header ── */
.feed-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 1.25rem;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border);
  height: 36px;
}

.feed-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-dim);
  white-space: nowrap;
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

.feed-count {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.unread-badge {
  background: var(--accent);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 20px;
}

.feed-actions {
  margin-left: auto;
  display: flex;
  gap: 0.25rem;
}

.feed-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  transition: all 0.15s;
}
.feed-btn:hover { color: var(--text); background: var(--bg3); }

/* ── Body (lista de logs) ── */
.feed-body {
  height: 160px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 0.35rem 0;
}

.feed-empty {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-align: center;
  padding: 1rem;
}

.feed-entry {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.22rem 1.25rem;
  font-size: 0.76rem;
  font-family: var(--font-mono);
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.feed-entry:hover { background: var(--bg3); }

.entry-time {
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.7;
}

.entry-msg { color: var(--text-dim); line-height: 1.5; }
.entry-msg b { color: var(--text); font-weight: 500; }

/* Colores por tipo */
.feed-entry.success .entry-msg { color: var(--green);  }
.feed-entry.error   .entry-msg { color: var(--red);    }
.feed-entry.warn    .entry-msg { color: var(--yellow); }
.feed-entry.info    .entry-msg { color: var(--accent); }
.feed-entry.system  .entry-msg { color: var(--text-muted); font-style: italic; }

/* Colapsado: solo se ve el header */
.feed-wrap.collapsed .feed-body { display: none; }
</style>
