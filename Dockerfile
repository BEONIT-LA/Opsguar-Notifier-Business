# ═══════════════════════════════════════════════════════════════════
# OpsGuard — Dockerfile multi-stage
#
# Stage 1: Compila el frontend Vue (Vite)
# Stage 2: Imagen de producción Node.js (lean, sin herramientas de build)
# ═══════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────
# Stage 1 — Build frontend
# ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Instala dependencias primero (aprovecha caché de Docker)
COPY frontend/package*.json ./
RUN npm ci --silent

# Copia fuentes y compila
# Vite genera los archivos en outDir: '../public' → /build/public/
COPY frontend/ ./
RUN npm run build


# ───────────────────────────────────────────────
# Stage 2 — Producción
# ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Dependencias del sistema necesarias para módulos nativos (baileys, etc.)
RUN apk add --no-cache python3 make g++

# Instala solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production --silent

# Copia el código fuente de la app
COPY src/    ./src/
COPY app.js  ./app.js
COPY server.js ./server.js

# Copia el frontend compilado desde Stage 1
COPY --from=frontend-builder /build/public ./public

# Carpeta de sesiones WhatsApp (se monta como volumen externo)
RUN mkdir -p auth_sessions

# Puerto de la aplicación
EXPOSE 3000

# Health check interno
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
