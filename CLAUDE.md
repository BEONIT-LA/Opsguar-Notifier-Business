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

## Multi-tenant (OpsGuard SaaS)

Esta es la versión **multiempresa** (fork de OpsGuard Notifier). Conceptos clave:

- **superadmin** (admin de plataforma, `tenant_id NULL`): crea y administra *tenants* (empresas) desde `/admin` → `/api/admin/*`.
- **tenant** (`tenants`): empresa con **cuota de mensajes** (`message_quota`, 0=ilimitado; `quota_period` total|monthly), **vigencia** (`valid_from`/`valid_until`), **tope de sesiones** (`max_sessions`) y estado activo|suspendido.
- **manager** (responsable, role `manager`, ligado a un `tenant_id`): entra a `/` (workspace) y gestiona SUS sesiones, grupos, pools, auditoría y **tokens de API**.
- **Aislamiento**: sesiones (`auth_sessions/{tenantId}/{sessionId}` + tabla `wa_sessions`), `group_pools`, `audit_logs` y eventos Socket.io (rooms `tenant:{id}`) están scopeados por tenant. El `SessionManager` usa clave compuesta `tenantId::sessionId`.
- **Auth dual** (`src/middleware/authMiddleware.js`): JWT del panel (incluye `tenantId`+`role`) **o** token de API `Authorization: Bearer ogt_…` (tabla `tenant_api_tokens`, hash SHA-256). El token de API opera a nivel de su tenant pero no puede gestionar tokens ni `/api/admin`.
- **Cuota**: se valida al encolar (`tenantService.checkCanSend` → 402 si agotada / 403 si suspendida o expirada) y se incrementa (`messages_used`) al completar el envío en el worker.

Variables de entorno BD: `POSTGRES_HOST/PORT/DB/USER/PASS`. Migraciones: `database/006`→`011` (idempotentes, orden alfabético en `docker-entrypoint-initdb.d`). Seed superadmin: `node database/seed.js`.

## Architecture

WhatsApp REST API multiempresa con soporte multi-sesión. Stack: Express + Baileys + BullMQ + Socket.io + PostgreSQL.

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

Todas las rutas `/api/*` (salvo `/api/auth/*`) requieren JWT o token de API y un tenant activo. Las `/api/admin/*` requieren rol superadmin.

**Plataforma (superadmin):**

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/admin/tenants` | Listar tenants con consumo |
| `POST` | `/api/admin/tenants` | Crear tenant + responsable (cuota, vigencia, max_sessions) |
| `PATCH`| `/api/admin/tenants/:id` | Editar cuota/vigencia/estado/etc. |
| `POST` | `/api/admin/tenants/:id/{suspend,activate,reset-usage,reset-password}` | Acciones sobre el tenant |

**Workspace del tenant (manager / token de API):**

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/me` | Datos del tenant + consumo/cuota |
| `GET/POST/DELETE` | `/api/tokens[/:id]` | Tokens de API (solo JWT, no token de API) |
| `POST` | `/api/sessions` | Crear sesión `{ sessionId }` |
| `GET` | `/api/sessions` | Listar sesiones y estado |
| `DELETE` | `/api/sessions/:id` | Eliminar sesión |
| `GET` | `/api/sessions/:id/qr` | QR como base64 PNG |
| `POST` | `/api/send` | Encolar mensaje (round-robin automático) |
| `GET` | `/api/queue/stats` | Stats de la cola Redis |
| `GET` | `/api/status` | Estado global (compatibilidad) |
| `GET` | `/api/groups` | Grupos (`?sessionId=xxx` opcional) |
| `GET` | `/api/group/:groupId` | Metadata de grupo |
