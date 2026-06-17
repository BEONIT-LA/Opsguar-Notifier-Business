# OpsGuard — Manual Técnico

> Sistema de Notificaciones WhatsApp
> Versión 1.0 · Última actualización: 2026

---

## Tabla de Contenido

1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Imágenes Docker](#4-imágenes-docker)
5. [CI/CD — GitLab](#5-cicd--gitlab)
6. [Instalación en Servidor](#6-instalación-en-servidor)
7. [Variables de Entorno](#7-variables-de-entorno)
8. [API REST](#8-api-rest)
9. [Base de Datos](#9-base-de-datos)
10. [Cola de Mensajes](#10-cola-de-mensajes)
11. [Tests Automatizados](#11-tests-automatizados)
12. [Resolución de Problemas](#12-resolución-de-problemas)

---

## 1. Arquitectura del Sistema

```
Cliente (navegador)
        │
        ▼
    Nginx (proxy)
        │
        ▼
   Node.js App
    ├── API REST (Express)
    ├── Vue.js (frontend compilado)
    └── WebSocket (Socket.io)
        │
        ├──▶ PostgreSQL (datos, sesiones, auditoría)
        ├──▶ Redis (cola BullMQ)
        └──▶ WhatsApp (Baileys)
```

**Flujo de un mensaje:**

```
POST /api/send
    │
    ▼
Cola BullMQ (Redis)
    │
    ▼
Worker toma el job
    │
    ▼
Sesión WhatsApp disponible
    │
    ▼
Envío vía Baileys
    │
    ▼
Registro en audit_logs (PostgreSQL)
```

---

## 2. Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Backend | Node.js | 20 LTS |
| Framework | Express | 5.x |
| Frontend | Vue.js + Vite | 3.x |
| Base de datos | PostgreSQL | 16 |
| Cola de mensajes | BullMQ + Redis | 7 |
| WhatsApp | Baileys | latest |
| Proxy | Nginx | Alpine |
| Contenedores | Docker + Compose | v2 |
| CI/CD | GitLab CI | - |

---

## 3. Estructura del Proyecto

```
mswhatsappbaileys/
├── src/
│   ├── config/
│   │   ├── database.js       → Pool de conexiones PostgreSQL
│   │   └── index.js          → Configuración general
│   ├── controllers/
│   │   └── whatsappController.js → Lógica de endpoints
│   ├── middleware/
│   │   ├── authMiddleware.js  → Validación JWT
│   │   └── uploadMiddleware.js → Manejo de archivos (multer)
│   ├── routes/
│   │   ├── authRoutes.js      → Login, cambio de contraseña
│   │   └── whatsappRoutes.js  → Sesiones, grupos, envío, pools
│   ├── services/
│   │   ├── auditService.js    → Lectura/escritura de logs
│   │   ├── poolService.js     → Gestión de pools de sesiones
│   │   ├── queueService.js    → BullMQ — encolar mensajes
│   │   └── sessionManager.js → Gestión de sesiones WhatsApp
│   └── workers/
│       └── messageWorker.js   → Procesador de la cola
├── frontend/                  → Aplicación Vue.js
├── database/
│   ├── 001_users.sql          → Tabla de usuarios
│   ├── 002_audit_logs.sql     → Tabla de auditoría
│   ├── 003_seed.sql           → Usuario admin inicial
│   └── Dockerfile             → Imagen con migraciones incluidas
├── nginx/
│   ├── nginx.conf             → Configuración del proxy
│   ├── ssl/                   → Certificados SSL (no en repo)
│   └── Dockerfile
├── kubernetes/                → Manifests para Kubernetes
├── tests/                     → Tests automatizados Jest
├── docs/
│   ├── MANUAL_USUARIO.md
│   └── MANUAL_TECNICO.md
├── .gitlab-ci.yml             → Pipeline CI/CD
├── docker-compose.yml         → Orquestación local/producción
├── server.js                  → Punto de entrada
└── INSTRUCCIONES.txt          → Base de conocimiento
```

---

## 4. Imágenes Docker

### Repositorio

```
hub.docker.com/u/jeffoisrael
```

| Imagen | Descripción |
|--------|-------------|
| `jeffoisrael/opsguardchannel-app` | Node.js + Vue compilado |
| `jeffoisrael/opsguardchannel-db` | PostgreSQL + migraciones automáticas |
| `jeffoisrael/opsguardchannel-proxy` | Nginx reverse proxy |

### Arquitecturas soportadas

- `linux/amd64` — servidores x86 estándar
- `linux/arm64` — AWS Graviton, Oracle Cloud ARM, Apple M1/M2

### Tags disponibles

| Tag | Descripción |
|-----|-------------|
| `latest` | Última versión estable |
| `v1.0.0` | Versión específica (inmutable) |

---

## 5. CI/CD — GitLab

### Flujo completo

```
push a develop
    │
    ▼
GitLab runner (node:20-alpine)
    ├── npm ci
    └── npm test (35 tests)
         │
         ├── ✅ Pasa → notificación verde
         └── ❌ Falla → email de alerta

git tag v1.0.x (desde main)
    │
    ▼
GitLab runner (docker:26 + dind)
    ├── docker login Docker Hub
    ├── binfmt (QEMU multi-arch)
    ├── buildx create
    └── build + push (amd64 + arm64)
         ├── opsguardchannel-app
         ├── opsguardchannel-db
         └── opsguardchannel-proxy
```

### Variables requeridas en GitLab

`Settings → CI/CD → Variables`

| Variable | Valor |
|----------|-------|
| `DOCKERHUB_USER` | `jeffoisrael` |
| `DOCKERHUB_TOKEN` | Access Token de Docker Hub |

### Publicar nueva versión

```bash
# 1. Trabajar en develop
git add .
git commit -m "feat: descripción del cambio"
git push origin develop        # → tests automáticos

# 2. Merge develop → main (desde GitLab)

# 3. Crear tag (dispara build de imágenes)
git tag v1.0.4
git push origin v1.0.4
```

### Estrategia de versiones

| Tag | Cuándo usarlo |
|-----|--------------|
| `v1.0.x` | Bug fix sin cambios de estructura |
| `v1.x.0` | Nueva funcionalidad compatible |
| `v2.0.0` | Breaking change (nueva BD, nueva API) |

---

## 6. Instalación en Servidor

### Requisitos

- Ubuntu 22.04 LTS
- Docker CE instalado
- Mínimo 2 GB RAM
- Puerto 8080 (HTTP) o 8443 (HTTPS) disponible

### Sin SSL

```bash
mkdir ~/notificaciones && cd ~/notificaciones

# Copiar desde tu máquina
scp docker-compose.yml usuario@IP:~/notificaciones/

# Crear .env
nano .env
# Contenido:
# POSTGRES_PASS=password-seguro
# JWT_SECRET=clave-larga-aleatoria

# Levantar
docker compose up -d
docker compose ps
```

Acceso: `http://IP:8080`

### Con SSL

```bash
mkdir ~/notificaciones && cd ~/notificaciones

# Copiar archivos
scp docker-compose.yml nginx.conf usuario@IP:~/notificaciones/

# Crear .env
nano .env

# Copiar certificados
mkdir ssl
cp /ruta/fullchain.crt ~/notificaciones/ssl/cert.pem
cp /ruta/dominio.key   ~/notificaciones/ssl/key.pem

# Levantar
docker compose up -d
```

Acceso: `https://dominio.com:8443`

### Actualizar a nueva versión

```bash
docker compose pull
docker compose up -d
```

---

## 7. Variables de Entorno

### En el servidor (.env)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `POSTGRES_PASS` | Contraseña de PostgreSQL | `MiPassword123` |
| `JWT_SECRET` | Clave de cifrado JWT | `openssl rand -hex 32` |

### Internas (docker-compose.yml)

| Variable | Valor en producción |
|----------|-------------------|
| `NODE_ENV` | `production` |
| `REDIS_URL` | `redis://redis:6379` |
| `DATABASE_URL` | `postgresql://opsguard:...@postgres:5432/opsguard` |
| `POSTGRES_HOST` | `postgres` |
| `POSTGRES_DB` | `opsguard` |
| `POSTGRES_USER` | `opsguard` |
| `JWT_EXPIRES` | `8h` |

---

## 8. API REST

### Autenticación

Todos los endpoints (excepto `/api/auth/login`) requieren JWT en el header:

```
Authorization: Bearer <token>
```

### Endpoints

#### Auth

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login — devuelve token JWT |
| PUT | `/api/auth/change-password` | Cambiar contraseña |

**Login:**
```bash
curl -X POST https://dominio.com:8443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user": "admin", "password": "admin123"}'
```

Respuesta:
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": "admin",
  "role": "admin",
  "expiresIn": "8h"
}
```

---

#### Sesiones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/sessions` | Listar todas las sesiones |
| POST | `/api/sessions` | Crear nueva sesión |
| DELETE | `/api/sessions/:id` | Eliminar sesión |
| GET | `/api/sessions/:id/qr` | Obtener QR de sesión |

**Crear sesión:**
```bash
curl -X POST https://dominio.com:8443/api/sessions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "ventas"}'
```

---

#### Enviar Mensaje

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/send` | Encolar mensaje |

**Solo texto:**
```bash
curl -X POST https://dominio.com:8443/api/send \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId": "120363XXX@g.us", "text": "Hola grupo"}'
```

**Con imagen (multipart/form-data):**
```bash
curl -X POST https://dominio.com:8443/api/send \
  -H "Authorization: Bearer TOKEN" \
  -F "groupId=120363XXX@g.us" \
  -F "text=Mira esta imagen" \
  -F "image=@/ruta/imagen.png"
```

**Con documento:**
```bash
curl -X POST https://dominio.com:8443/api/send \
  -H "Authorization: Bearer TOKEN" \
  -F "groupId=120363XXX@g.us" \
  -F "text=Reporte adjunto" \
  -F "document=@/ruta/reporte.pdf"
```

Respuesta:
```json
{
  "success": true,
  "message": "Mensaje encolado correctamente.",
  "data": { "jobId": "1234" }
}
```

**Combinaciones válidas:**

| text | image | document | Mensajes enviados |
|------|-------|----------|-------------------|
| ✅ | ❌ | ❌ | 1 (texto) |
| ❌ | ✅ | ❌ | 1 (imagen) |
| ❌ | ❌ | ✅ | 1 (documento) |
| ✅ | ✅ | ❌ | 1 (imagen con caption) |
| ✅ | ❌ | ✅ | 1 (documento con caption) |
| ✅ | ✅ | ✅ | 2 (imagen+texto, documento) |

---

#### Grupos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/groups` | Listar grupos de una sesión |
| GET | `/api/groups/:groupId` | Detalle de un grupo |

---

#### Pools

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/pools` | Listar pools |
| POST | `/api/pools` | Crear pool |
| PUT | `/api/pools/:id` | Actualizar pool |
| DELETE | `/api/pools/:id` | Eliminar pool |

**Crear pool:**
```bash
curl -X POST https://dominio.com:8443/api/pools \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "soporte",
    "groupId": "120363XXX@g.us",
    "sessionIds": ["ventas", "soporte"]
  }'
```

---

#### Monitoreo

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Estado del sistema |
| GET | `/api/status` | Sesiones activas |
| GET | `/api/queue/stats` | Estadísticas de la cola |
| GET | `/api/audit` | Historial de envíos |
| GET | `/api/audit/stats` | Estadísticas de auditoría |

---

#### Códigos de respuesta

| Código | Significado |
|--------|-------------|
| `200` | OK |
| `201` | Creado |
| `202` | Aceptado (encolado) |
| `400` | Datos inválidos |
| `401` | No autenticado |
| `404` | No encontrado |
| `409` | Conflicto (ya existe) |
| `500` | Error interno |
| `503` | Sin sesiones disponibles |

---

## 9. Base de Datos

### Tablas

**users**
```sql
id, username, password (bcrypt), role, is_active,
first_name, last_name, email, last_login, created_at
```

**audit_logs**
```sql
id, job_id, status, session_id, group_id, type,
text, image_path, doc_path, ip, duration, attempt,
error, created_at
```

**group_pools**
```sql
id, name, group_id, session_ids (jsonb), created_at, updated_at
```

### Migraciones

Las migraciones corren automáticamente al iniciar el contenedor `db`:

```
database/001_users.sql      → tabla users + trigger updated_at
database/002_audit_logs.sql → tabla audit_logs + índices
database/003_seed.sql       → usuario admin inicial (admin/admin123)
```

### Conexión directa (solo para debugging)

```bash
docker exec opsguard-postgres psql -U opsguard -d opsguard
```

---

## 10. Cola de Mensajes

### BullMQ + Redis

- **Concurrencia:** igual al número de sesiones listas
- **Reintentos:** hasta 5 veces con backoff exponencial
- **Delay entre envíos:** 3–6 segundos aleatorio (anti rate-limit)

### Backoff exponencial

| Intento | Espera |
|---------|--------|
| 1 | 15 segundos |
| 2 | 30 segundos |
| 3 | 60 segundos |
| 4 | 120 segundos |
| 5 | falla definitiva |

### Paralelismo

```
1 sesión  → 1 carril → mensajes secuenciales
2 sesiones → 2 carriles → 2 mensajes simultáneos
N sesiones → N carriles → N mensajes simultáneos
```

> ⚠️ **Crítico:** El servicio `app` debe tener siempre `replicas: 1`.
> WhatsApp solo permite una conexión por número. Múltiples instancias
> causan desconexiones.

---

## 11. Tests Automatizados

### Ejecutar

```bash
npm test              # corre los 35 tests
npm run test:watch    # modo watch
```

### Suites

| Archivo | Tests | Cubre |
|---------|-------|-------|
| `auth.test.js` | 8 | Login, cambio de contraseña |
| `security.test.js` | 14 | JWT en todas las rutas |
| `validation.test.js` | 6 | Validación de inputs |
| `health.test.js` | 7 | Health, status, queue |

Los tests usan **mocks** — no requieren WhatsApp, Redis ni PostgreSQL.

---

## 12. Resolución de Problemas

### Contenedor postgres unhealthy

```bash
docker compose logs postgres | tail -30
docker compose down -v   # borra volúmenes
docker compose up -d     # reinicia limpio
```

### App no conecta a PostgreSQL

Verificar variables de entorno:
```bash
docker exec opsguard-app env | grep -E "DATABASE|POSTGRES"
```

Verificar conectividad:
```bash
docker exec opsguard-postgres psql -U opsguard -d opsguard -c "\dt"
```

### Puerto ya en uso

```bash
sudo ss -tlnp | grep LISTEN   # ver puertos ocupados
```

Cambiar puerto en `docker-compose.yml`:
```yaml
ports:
  - "8080:80"    # cambiar 8080 por puerto libre
```

### Olvidé la contraseña de admin

```bash
docker exec opsguard-postgres psql -U opsguard -d opsguard -c \
"UPDATE users SET password='\$2b\$12\$yj9qxFid2GZjgAI1FDSr0.Ji6SqsbK4qrmiGlSVJkU1wBdS54BqAO' WHERE username='admin';"
```

Entra con `admin` / `admin123` y cambia la contraseña.

### Errores de certificados SSL

Verificar que los archivos existen:
```bash
ls ~/notificaciones/ssl/
# debe mostrar: cert.pem  key.pem
```

Reiniciar nginx:
```bash
docker compose up -d --no-deps nginx
docker compose logs nginx
```

### Ver logs en tiempo real

```bash
docker compose logs -f app       # logs de la app
docker compose logs -f nginx     # logs del proxy
docker compose logs postgres     # logs de la DB
```

### Actualizar imágenes

```bash
docker compose pull
docker compose up -d
```
