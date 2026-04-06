# OpsGuard · Guía de instalación y despliegue

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Node.js 18+ instalado
- Git

---

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd mswhatsappbaileys
```

---

## 2. Configurar variables de entorno

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env   # si existe, si no edita .env directamente
```

Variables importantes en `.env`:

```env
# Servidor
PORT=3000

# PostgreSQL — debe coincidir con docker-compose.yml
POSTGRES_DB=opsguard
POSTGRES_USER=opsguard
POSTGRES_PASS=opsguard2024
DATABASE_URL=postgresql://opsguard:opsguard2024@localhost:5432/opsguard

# Redis
REDIS_URL=redis://localhost:6379

# JWT — cambia esto en producción por una cadena aleatoria larga
JWT_SECRET=opsguard_super_secret_cambiame_en_produccion
JWT_EXPIRES=8h
```

---

## 3. Levantar los contenedores (PostgreSQL + Redis)

```bash
# Inicia ambos servicios en background
docker compose up -d

# Verifica que estén corriendo
docker compose ps
```

Salida esperada:
```
NAME                 STATUS
opsguard-postgres    running (healthy)
opsguard-redis       running (healthy)
```

### ¿Qué hace cada contenedor?

| Contenedor | Puerto | Función |
|---|---|---|
| `opsguard-postgres` | 5432 | Base de datos principal (usuarios + auditoría) |
| `opsguard-redis` | 6379 | Cola BullMQ + caché de sesiones |

> Las migraciones SQL (`001_users.sql`, `002_audit_logs.sql`) se ejecutan
> **automáticamente** la primera vez que se crea el contenedor de Postgres.

---

## 4. Instalar dependencias Node.js

```bash
# Backend
npm install

# Frontend Vue
npm run ui:install
```

---

## 5. Crear usuario administrador inicial

```bash
node database/seed.js
```

Salida esperada:
```
🌱 Conectando a PostgreSQL...
✅ Conexión OK
✅ Usuario creado/actualizado:
   ID:       1
   Username: admin
   Role:     admin
   Password: admin123
```

Para crear un usuario con credenciales personalizadas:
```bash
node database/seed.js --user=miusuario --pass=miPassword123
```

> ⚠️ **Cambia la contraseña después del primer login.**

---

## 6. Compilar el frontend Vue

```bash
npm run ui:build
```

Esto genera los archivos en `public/` que Express sirve automáticamente.

---

## 7. Iniciar el servidor

```bash
node server.js
```

Salida esperada:
```
[DB] PostgreSQL conectado ✓
🚀 Server running on port 3000 in development mode
🔌 WebSocket disponible en ws://localhost:3000
```

Abre: **http://localhost:3000**
Login: `admin` / `admin123`

---

## Comandos útiles de Docker

```bash
# Ver logs de PostgreSQL en tiempo real
docker compose logs -f postgres

# Ver logs de Redis
docker compose logs -f redis

# Entrar a la consola de PostgreSQL
docker exec -it opsguard-postgres psql -U opsguard -d opsguard

# Ver registros de auditoría directamente en SQL
docker exec -it opsguard-postgres psql -U opsguard -d opsguard \
  -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;"

# Ver usuarios
docker exec -it opsguard-postgres psql -U opsguard -d opsguard \
  -c "SELECT id, username, role, last_login FROM users;"

# Detener contenedores (datos se conservan)
docker compose down

# Detener Y borrar todos los datos
docker compose down -v
```

---

## Comandos útiles de Redis

```bash
# Entrar a Redis CLI
docker exec -it opsguard-redis redis-cli

# Ver contadores históricos de la cola
127.0.0.1:6379> GET wa:stats:completed
127.0.0.1:6379> GET wa:stats:failed

# Ver todas las claves de BullMQ
127.0.0.1:6379> KEYS bull:*

# Ver info general
127.0.0.1:6379> INFO server
```

---

## Estructura de la base de datos

### Tabla `users`

| Columna | Tipo | Descripción |
|---|---|---|
| id | SERIAL | Clave primaria |
| username | VARCHAR(100) | Único, usado para login |
| password | VARCHAR(255) | Hash bcrypt (nunca texto plano) |
| role | VARCHAR(20) | `admin` o `operator` |
| is_active | BOOLEAN | Si puede iniciar sesión |
| first_name | VARCHAR(100) | Nombre |
| last_name | VARCHAR(100) | Apellido |
| email | VARCHAR(200) | Correo electrónico (único) |
| last_login | TIMESTAMPTZ | Último acceso |
| created_at | TIMESTAMPTZ | Fecha de creación |
| updated_at | TIMESTAMPTZ | Última modificación |

### Tabla `audit_logs`

| Columna | Tipo | Descripción |
|---|---|---|
| id | BIGSERIAL | Clave primaria |
| job_id | VARCHAR | ID del job en BullMQ |
| status | VARCHAR | `completed` o `failed` |
| session_id | VARCHAR | Sesión WhatsApp usada |
| group_id | VARCHAR | Grupo destino |
| type | VARCHAR | `text`, `image` o `document` |
| text | TEXT | Preview del mensaje (máx 500 chars) |
| ip | VARCHAR | IP de origen de la petición |
| duration | INTEGER | Tiempo de procesamiento (ms) |
| attempt | SMALLINT | Número de intento (1-5) |
| error | TEXT | Mensaje de error si falló |
| created_at | TIMESTAMPTZ | Timestamp del evento |

---

## Próxima fase — Mejoras planificadas

- [ ] UI para gestión de usuarios (crear, editar, desactivar)
- [ ] Limpieza automática de audit_logs por antigüedad (ej: > 90 días)
- [ ] Dashboard de métricas con gráficos (Chart.js o recharts)
- [ ] Notificaciones por webhook cuando falla un job
- [ ] 2FA para el login de administradores
