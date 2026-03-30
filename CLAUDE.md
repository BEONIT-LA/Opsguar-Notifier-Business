# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Instalar dependencias
npm install

# Arrancar el servidor (requiere Redis corriendo)
node server.js

# Redis local con Docker
docker run -d --name redis-whatsapp -p 6379:6379 redis:alpine
```

## Environment Variables

- `PORT` — puerto HTTP (default: `3000`)
- `NODE_ENV` — entorno (default: `development`)
- `REDIS_URL` — conexión Redis (default: `redis://localhost:6379`)

## Architecture

WhatsApp REST API con soporte multi-sesión. Stack: Express + Baileys + BullMQ + Socket.io.

```
HTTP + WebSocket (Socket.io)
         │
    Routes → Controllers
         │
   SessionManager (EventEmitter singleton)
    ├── sesion_1  →  auth_sessions/sesion_1/  (Baileys sock)
    ├── sesion_2  →  auth_sessions/sesion_2/
    └── sesion_N  →  auth_sessions/sesion_N/
         │ eventos (qr, ready, failed, disconnected)
    socketHandler → Socket.io → Frontend

POST /api/send → BullMQ Queue (Redis)
                      │
               MessageWorker (concurrency: 5)
                      │
            getNextAvailableSession()  ← round-robin solo entre 'ready'
```

### SessionManager (`src/services/sessionManager.js`)

Singleton `EventEmitter`. Mantiene un `Map<sessionId, SessionState>`. Al arrancar llama `initializeSessions()` que escanea `auth_sessions/` y restaura sesiones persistidas.

**Ciclo de vida de una sesión:**
- `connecting` → genera QR → `qr_needed`
- QR escaneado → `ready`
- Desconexión → reintento con backoff (3s, 6s, 9s) → tras 3 fallos: `failed`
- `failed` emite `session:failed` — el frontend debe pedir re-escanear QR
- `removeSession()` solo borra `auth_sessions/{id}/`, nunca toca otras carpetas

**Eventos emitidos:** `session:qr`, `session:ready`, `session:disconnected`, `session:failed`, `session:removed`

### Queue + Worker

- `src/services/queueService.js` — BullMQ `Queue` "whatsapp-messages", 3 reintentos con backoff exponencial
- `src/workers/messageWorker.js` — BullMQ `Worker`, concurrency 5, llama `getNextAvailableSession()` por cada job

### Socket.io (`src/socket/socketHandler.js`)

Vincula los eventos del `SessionManager` a todos los clientes conectados. Al conectarse un cliente recibe `sessions:state` con el estado actual completo.

**Eventos emitidos al frontend:**

| Evento | Payload |
|--------|---------|
| `sessions:state` | `{ sessionId: { status, isReady, hasQR, retryCount } }` |
| `session:qr` | `{ sessionId, qr, qrBase64 }` |
| `session:ready` | `{ sessionId, status }` |
| `session:disconnected` | `{ sessionId, statusCode }` |
| `session:failed` | `{ sessionId, reason }` |
| `session:removed` | `{ sessionId }` |

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/sessions` | Crear sesión `{ sessionId }` |
| `GET` | `/api/sessions` | Listar sesiones y estado |
| `DELETE` | `/api/sessions/:id` | Eliminar sesión |
| `GET` | `/api/sessions/:id/qr` | QR como base64 PNG |
| `POST` | `/api/send` | Encolar mensaje (round-robin automático) |
| `GET` | `/api/queue/stats` | Stats de la cola Redis |
| `GET` | `/api/status` | Estado global (compatibilidad) |
| `GET` | `/api/groups` | Grupos (`?sessionId=xxx` opcional) |
| `GET` | `/api/group/:groupId` | Metadata de grupo |
