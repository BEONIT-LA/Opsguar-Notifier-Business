<template>
  <!--
    App.vue es el componente raíz — el "contenedor" de toda la app.
    <router-view /> renderiza automáticamente el componente
    que corresponde a la ruta actual (login o dashboard).
  -->
  <router-view />
</template>

<style>
/* ── Reset y variables globales de diseño OPSGUARD ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:           #161b26;
  --bg2:          #1e2535;
  --bg3:          #263044;
  --border:       rgba(26,133,251,0.10);
  --border-hi:    rgba(26,133,251,0.25);
  --accent:       #1a85fb;
  --accent-hover: #3b96fc;
  --accent-muted: rgba(26,133,251,0.13);
  --cyan:         #3bd1ff;
  --cyan-muted:   rgba(59,209,255,0.12);
  --text:         #dce8f8;
  --text-dim:     #7a94b8;
  --text-muted:   #2e3a50;
  --green:        #34d399;
  --green-muted:  rgba(52,211,153,0.1);
  --yellow:       #fbbf24;
  --yellow-muted: rgba(251,191,36,0.1);
  --red:          #f87171;
  --red-muted:    rgba(248,113,113,0.1);
  --radius:       10px;
  --radius-sm:    6px;
  --header-h:     56px;

  /* ── Tipografía ────────────────────────────────────────────── */
  /* Space Grotesk: geométrica, moderna — ideal para dashboards tech */
  --font-ui:   'Space Grotesk', system-ui, -apple-system, sans-serif;
  /* JetBrains Mono: para datos técnicos — IDs, números, logs, código */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}

body {
  font-family: var(--font-ui);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-size: 14px;
  line-height: 1.5;
}

/* ── Clases globales de fuente ── */
code, .mono         { font-family: var(--font-mono); }
.font-mono          { font-family: var(--font-mono); }
.tabular-nums       { font-variant-numeric: tabular-nums; }

/* Dot grid — efecto de fondo estilo n8n */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(26,133,251,0.07) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  z-index: 0;
}

/* Glow ambiental */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 10% 15%, rgba(26,133,251,0.10) 0%, transparent 50%),
    radial-gradient(ellipse at 90% 85%, rgba(59,209,255,0.07) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Scrollbar personalizada */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 3px; }
</style>
