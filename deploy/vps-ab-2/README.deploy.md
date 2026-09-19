# Opsguar-Notifier Business - despliegue (vps-ab-2 / notificaciones.beonit.la)

App **multiempresa** (multi-tenant) con identidad **Be On It**. Reemplazo del
OpsGuard Notifier single-tenant. Stack: Node.js + Vue (Baileys/BullMQ/socket.io)
+ PostgreSQL 16 + Redis, detras del Traefik existente.

## Componentes en /opt/opsguard
- `docker-compose.yml` - integrado a Traefik (router Host notificaciones.beonit.la,
  websecure, certresolver=le, service port 3000). Redes: web (externa) + opsguard-internal.
- `.env` (600) - `POSTGRES_PASS` + `JWT_SECRET` (32+ caracteres; obligatorios, sin
  defaults). Opcional: `ADMIN_USER` / `ADMIN_PASS` para el primer superadmin.
  Los valores viven en Gravity Ops.
- `src/` - codigo (git: github.com/BEONIT-LA/Opsguar-Notifier-Business). La imagen
  de la app se CONSTRUYE aqui: `opsguar-notifier-business:latest`.
- `deploy.sh` - despliegue idempotente (ver abajo).
- `backup-pre-<fecha>/` - uno por despliegue: compose, .env, `db.sql` y `build.log`.
- `backup-pre-saas/` - estado single-tenant previo (rollback historico).

## Imagenes
- app: `opsguar-notifier-business:latest` (LOCAL, construida desde ./src; pull_policy: never).
  Cada despliegue deja la anterior como `opsguar-notifier-business:pre-<fecha>`.
- postgres: `postgres:16-alpine` oficial, **sin** migraciones embebidas. El esquema lo
  aplica `deploy.sh` desde `src/database`. (Antes: `jeffoisrael/opsguardchannel-db`,
  que en un nodo nuevo sembraba `admin/admin123`; mismo PG16/Alpine/en_US.utf8, el
  volumen es compatible.)
- redis: `redis:7-alpine` (maxmemory-policy noeviction, requerido por BullMQ).

## Desplegar / actualizar
```
cd /opt/opsguard
./deploy.sh               # git pull + backup + build + migraciones pendientes + app
SKIP_PULL=1 ./deploy.sh   # desplegar el codigo presente en ./src sin pull
```
`deploy.sh`:
1. Valida red `web`, `.env` (genera secretos aleatorios si no existe) y `JWT_SECRET` 32+.
2. `git pull --ff-only` de `./src`; si falla, **aborta** (no despliega codigo viejo).
3. Backup: etiqueta la imagen actual y hace `pg_dump` en `backup-pre-<fecha>/`.
4. Construye la imagen (log en el backup).
5. Levanta postgres + redis y aplica **solo las migraciones pendientes**, cada una en
   una transaccion, registradas en la tabla `schema_migrations`. En un nodo desplegado
   antes de existir esa tabla, registra `001`-`011` como ya aplicadas sin ejecutarlas
   (`001_users.sql` no es re-ejecutable).
6. Recrea la app y espera a `healthy`; si no llega, aborta y muestra el log.
7. Muestra el log `[Bootstrap]` y el comando de rollback.

No hace falta aplicar migraciones a mano.

## Superadmin
- No hay usuario ni contrasena por defecto.
- **Nodo nuevo**: al arrancar, si la BD no tiene superadmin, la app lo crea
  (`ADMIN_USER`, default `admin`) con `ADMIN_PASS` o, si esta vacia, con una clave
  aleatoria que aparece **una sola vez** en el log:
  `docker logs opsguard-app | grep Bootstrap`. Guardala en Gravity Ops y cambiala.
- **Nodo existente**: se conserva el superadmin. Si aun usa la antigua `admin123`,
  la app lo avisa en el log en cada arranque.
- Olvide la contrasena:
  ```
  HASH=$(docker exec opsguard-app node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'NUEVA-CLAVE-LARGA')
  docker exec opsguard-postgres psql -U opsguard -d opsguard -c "UPDATE users SET password='$HASH' WHERE username='admin';"
  ```

## Modelo multiempresa
- superadmin (admin de plataforma) -> /admin: crea tenants (empresas) con cuota de
  mensajes, vigencia y tope de sesiones, y su responsable (manager).
- manager -> / (workspace): sus sesiones, grupos, pools, auditoria y tokens de API (ogt_).

## Modo humano
Cada envio: pausa de reaccion -> "escribiendo..." -> envio; luego el numero descansa
4-12 s. Ajustable con `HUMAN_*` en el `environment` de la app (ver `src/CLAUDE.md`);
`HUMAN_MODE=false` lo apaga.

## Rollback
App (lo imprime `deploy.sh` con la etiqueta exacta):
```
docker tag opsguar-notifier-business:pre-<fecha> opsguar-notifier-business:latest
docker compose up -d app
```
BD (solo si una migracion nueva causo el problema):
```
docker exec -i opsguard-postgres psql -U opsguard -d opsguard < backup-pre-<fecha>/db.sql
```
Compose previo: `cp backup-pre-<fecha>/docker-compose.yml .` y `docker compose up -d`.

## Notas
- Crear sesiones de WhatsApp desde el workspace del tenant (POST /api/sessions + QR).
  Las sesiones persisten en el volumen `sessions_data`: recrear la app no pide QR.
- DNS A notificaciones.beonit.la -> 45.169.146.201 (Cloudflare, DNS-only). TLS Let's Encrypt via Traefik.
