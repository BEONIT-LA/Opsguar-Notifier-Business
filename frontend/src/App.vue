<template>
  <!--
    App.vue es el componente raíz — el "contenedor" de toda la app.
    <router-view /> renderiza automáticamente el componente
    que corresponde a la ruta actual (login o dashboard).
  -->
  <router-view />
</template>

<style>
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* ── Fondos ── */
  --bg:           #0d1117;
  --bg2:          #161c27;
  --bg3:          #1e2736;

  /* ── Acentos principales ── */
  --accent:        #1a85fb;
  --accent-hover:  #3b96fc;
  --accent-muted:  rgba(26,133,251,0.12);

  /* ── Violeta — segundo acento (Aurora UI) ── */
  --violet:        #7c3aed;
  --violet-hover:  #8b5cf6;
  --violet-muted:  rgba(124,58,237,0.12);

  /* ── Cyan ── */
  --cyan:          #3bd1ff;
  --cyan-muted:    rgba(59,209,255,0.10);

  /* ── Bordes ── */
  --border:        rgba(26,133,251,0.08);
  --border-hi:     rgba(26,133,251,0.22);

  /* ── Texto ── */
  --text:          #e2eaf6;
  --text-dim:      #6e8aad;
  --text-muted:    #2a3548;

  /* ── Estados ── */
  --green:         #34d399;
  --green-muted:   rgba(52,211,153,0.10);
  --yellow:        #fbbf24;
  --yellow-muted:  rgba(251,191,36,0.10);
  --red:           #f87171;
  --red-muted:     rgba(248,113,113,0.10);

  /* ── Forma ── */
  --radius:        12px;
  --radius-sm:     7px;
  --radius-lg:     18px;
  --header-h:      56px;

  /* ── Glassmorphism ── */
  --glass-bg:      rgba(22,28,39,0.65);
  --glass-border:  rgba(26,133,251,0.14);
  --glass-blur:    20px;
  --glass-shadow:  0 8px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset;

  /* ── Tipografía (Tech Startup — skill: Space Grotesk + DM Sans) ── */
  --font-ui:   'Space Grotesk', 'DM Sans', system-ui, sans-serif;
  --font-body: 'DM Sans', 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* ── Fuentes ── */
h1, h2, h3, h4, h5, h6, .font-ui { font-family: var(--font-ui); }
code, .mono, .font-mono            { font-family: var(--font-mono); }
.tabular-nums                      { font-variant-numeric: tabular-nums; }

/* ── Aurora UI — orbs estáticos (gradientes fijos, sin animar background) ── */
/* El movimiento usa SOLO transform → GPU-accelerated, cero repaint          */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  /* Gradiente base estático — no se anima, no cuesta nada */
  background:
    radial-gradient(ellipse 70% 55% at 12% 8%,   rgba(26,133,251,0.11)  0%, transparent 55%),
    radial-gradient(ellipse 55% 45% at 88% 82%,  rgba(59,209,255,0.08)  0%, transparent 55%),
    radial-gradient(ellipse 50% 42% at 78% 12%,  rgba(124,58,237,0.09)  0%, transparent 52%),
    radial-gradient(ellipse 42% 36% at 18% 88%,  rgba(124,58,237,0.06)  0%, transparent 52%);
  pointer-events: none;
  z-index: 0;
  will-change: transform;
  /* transform en el contenedor — GPU, sin repaint */
  animation: aurora-drift 25s ease-in-out infinite alternate;
}

/* ── Dot grid sutil ── */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(26,133,251,0.05) 1px, transparent 1px);
  background-size: 30px 30px;
  pointer-events: none;
  z-index: 0;
}

/* Solo transform + opacity — 100% GPU, cero repaint ✅ */
@keyframes aurora-drift {
  0%   { transform: translate(0px, 0px)   scale(1);    opacity: 1;    }
  33%  { transform: translate(15px, -10px) scale(1.03); opacity: 0.88; }
  66%  { transform: translate(-10px, 12px) scale(0.97); opacity: 0.95; }
  100% { transform: translate(8px, -8px)  scale(1.02); opacity: 0.9;  }
}

/* ── Glassmorphism — clase utilitaria global ── */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

/* ── Scrollbar ── */
::-webkit-scrollbar       { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(26,133,251,0.25); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(26,133,251,0.45); }

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}
</style>
