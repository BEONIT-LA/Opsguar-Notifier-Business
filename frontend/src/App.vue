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
  /* ════════════════════════════════════════════════════════════
     Identidad Be On It — tema claro, white-forward.
     Degradado de marca teal→azul; navy para texto.
     (Se conservan los NOMBRES de variables del tema anterior para
      no romper componentes; sólo cambian los valores a la paleta Beonit.)
     ════════════════════════════════════════════════════════════ */

  /* ── Superficies (blanco dominante) ── */
  --bg:           #eef2f8;   /* fondo app  */
  --bg2:          #ffffff;   /* superficie (tarjetas, header) */
  --bg3:          #f5f8fc;   /* superficie-2 (inputs, sutil)  */

  /* ── Acento de marca (azul) ── */
  --accent:        #2f6fd0;
  --accent-hover:  #255fc0;
  --accent-muted:  rgba(47,111,208,0.12);

  /* ── Degradado de marca ── */
  --grad:          linear-gradient(145deg, #28b6c9 0%, #2f80d0 52%, #2b58c0 100%);
  --grad-login:    linear-gradient(150deg, #1f63c4 0%, #2f80d0 45%, #28b6c9 100%);

  /* ── Segundo acento (azul profundo, antes "violeta") ── */
  --violet:        #2b58c0;
  --violet-hover:  #2f6fd0;
  --violet-muted:  rgba(43,88,192,0.12);

  /* ── Teal (antes "cyan") ── */
  --cyan:          #28b6c9;
  --cyan-muted:    rgba(40,182,201,0.12);

  /* ── Bordes / líneas ── */
  --border:        #e4eaf2;
  --border-hi:     #cfe0f5;

  /* ── Texto (navy) ── */
  --text:          #22303c;
  --text-dim:      #5d6b7c;
  --text-muted:    #94a3b5;

  /* ── Estados ── */
  --green:         #16a34a;
  --green-muted:   rgba(22,163,74,0.10);
  --yellow:        #d97706;
  --yellow-muted:  rgba(217,119,6,0.10);
  --red:           #e23b50;
  --red-muted:     rgba(226,59,80,0.10);

  /* ── Forma ── */
  --radius:        12px;
  --radius-sm:     9px;
  --radius-lg:     18px;
  --header-h:      56px;

  /* ── "Glass" claro + sombra Beonit ── */
  --glass-bg:      rgba(255,255,255,0.72);
  --glass-border:  rgba(47,111,208,0.14);
  --glass-blur:    18px;
  --glass-shadow:  0 1px 2px rgba(30,58,95,0.05), 0 10px 28px -14px rgba(30,58,95,0.22);
  --shadow:        0 1px 2px rgba(30,58,95,0.05), 0 10px 28px -14px rgba(30,58,95,0.22);

  /* ── Tipografía (Be On It → Poppins, equivalente web de Univia Pro) ── */
  --font-ui:   'Poppins', system-ui, sans-serif;
  --font-body: 'Poppins', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
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

/* ── Glow de marca muy sutil (white-forward: casi imperceptible) ── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 45% at 10% 2%,  rgba(40,182,201,0.07) 0%, transparent 55%),
    radial-gradient(ellipse 55% 45% at 92% 6%,  rgba(47,111,208,0.06) 0%, transparent 55%);
  pointer-events: none;
  z-index: 0;
}

/* ── Glassmorphism claro — clase utilitaria global ── */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

/* ── Scrollbar ── */
::-webkit-scrollbar       { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(47,111,208,0.22); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(47,111,208,0.40); }
</style>
