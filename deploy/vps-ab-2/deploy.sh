#!/usr/bin/env bash
# ===================================================================
# Opsguar-Notifier Business (multiempresa, Be On It) - despliegue
# vps-ab-2 / notificaciones.beonit.la. Ver README.deploy.md.
#
# Uso:   ./deploy.sh              # pull + build + migraciones + app
#        SKIP_PULL=1 ./deploy.sh  # despliega el código presente en ./src
#
# Qué hace (idempotente):
#   1. Comprueba red 'web', .env y secretos (sin defaults débiles).
#   2. git pull de ./src (falla si no puede: no despliega código viejo).
#   3. Backup: etiqueta la imagen actual y pg_dump de la BD.
#   4. Construye la imagen de la app.
#   5. Levanta postgres + redis y aplica SÓLO las migraciones pendientes
#      (registro en la tabla schema_migrations).
#   6. Recrea la app y espera a que esté healthy.
#   7. Muestra el log de Bootstrap (clave del superadmin si se generó).
# Rollback: se imprime al final con la etiqueta de la imagen previa.
# ===================================================================
set -euo pipefail
cd "$(dirname "$0")"

APP_IMAGE="opsguar-notifier-business"
DB="docker exec -i opsguard-postgres psql -U opsguard -d opsguard -v ON_ERROR_STOP=1 -q"
# Todo lo anterior a este archivo ya estaba aplicado en los nodos desplegados
# antes de existir schema_migrations (ver paso 5).
BASELINE_LAST="011_api_tokens.sql"
TS="$(date +%Y%m%d-%H%M%S)"
log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

# 1) Requisitos -------------------------------------------------------
docker network inspect web >/dev/null 2>&1 || die "falta la red externa 'web' de Traefik."
[ -d src/.git ] || die "falta ./src. Clona: git clone https://github.com/BEONIT-LA/Opsguar-Notifier-Business.git src"

if [ ! -f .env ]; then
  umask 077
  printf 'POSTGRES_PASS=%s\nJWT_SECRET=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
  log ".env generado (POSTGRES_PASS y JWT_SECRET aleatorios). Guárdalos en Gravity Ops."
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a
[ -n "${POSTGRES_PASS:-}" ] || die "POSTGRES_PASS vacía en .env"
[ "${#JWT_SECRET}" -ge 32 ] || die "JWT_SECRET debe tener 32+ caracteres (openssl rand -hex 32)"

# 2) Código -----------------------------------------------------------
GIT="git -c safe.directory=$PWD/src -C src"
if [ "${SKIP_PULL:-0}" != "1" ]; then
  log "actualizando código (git pull --ff-only)..."
  $GIT pull --ff-only || die "git pull falló. Revisa ./src o usa SKIP_PULL=1 para desplegar lo presente."
fi
REV="$($GIT log --oneline -1)"
log "código: $REV"

# 3) Backup -----------------------------------------------------------
BK="backup-pre-$TS"
mkdir -p "$BK"; chmod 700 "$BK"
cp docker-compose.yml "$BK/"; cp .env "$BK/"; chmod 600 "$BK/.env"
PREV_TAG=""
if docker image inspect "$APP_IMAGE:latest" >/dev/null 2>&1; then
  PREV_TAG="pre-$TS"
  docker tag "$APP_IMAGE:latest" "$APP_IMAGE:$PREV_TAG"
  log "imagen actual etiquetada como $APP_IMAGE:$PREV_TAG"
fi
if docker ps --format '{{.Names}}' | grep -qx opsguard-postgres; then
  (umask 077; docker exec opsguard-postgres pg_dump --clean --if-exists -U opsguard -d opsguard > "$BK/db.sql")
  log "BD respaldada en $BK/db.sql"
fi

# 4) Imagen de la app ---------------------------------------------------
log "construyendo $APP_IMAGE:latest ..."
docker build -t "$APP_IMAGE:latest" ./src > "$BK/build.log" 2>&1 \
  || { tail -20 "$BK/build.log" >&2; die "falló el build (log: $BK/build.log)"; }

# 5) BD + migraciones pendientes ----------------------------------------
docker compose up -d postgres redis
log "esperando a Postgres..."
until docker exec opsguard-postgres pg_isready -U opsguard -d opsguard >/dev/null 2>&1; do sleep 2; done

$DB -c "CREATE TABLE IF NOT EXISTS schema_migrations (
          filename   TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"

# Nodo desplegado antes de schema_migrations: su esquema ya llega hasta
# BASELINE_LAST. Se registran sin ejecutarlas (001 no es re-ejecutable).
APPLIED="$($DB -tAc 'SELECT count(*) FROM schema_migrations')"
HAS_USERS="$($DB -tAc "SELECT to_regclass('public.users') IS NOT NULL")"
if [ "$APPLIED" = "0" ] && [ "$HAS_USERS" = "t" ]; then
  for f in src/database/0*.sql; do
    n="$(basename "$f")"
    [[ "$n" > "$BASELINE_LAST" ]] && continue
    $DB -c "INSERT INTO schema_migrations(filename) VALUES ('$n') ON CONFLICT DO NOTHING"
  done
  log "BD existente: migraciones hasta $BASELINE_LAST registradas como aplicadas"
fi

for f in src/database/0*.sql; do
  n="$(basename "$f")"
  done_="$($DB -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$n'")"
  [ "$done_" = "1" ] && continue
  log "aplicando migración $n"
  { cat "$f"; echo; echo "INSERT INTO schema_migrations(filename) VALUES ('$n');"; } \
    | $DB -1 || die "falló la migración $n (transacción revertida)"
done

# 6) App -------------------------------------------------------------
docker compose up -d app
log "esperando a que la app esté healthy..."
for _ in $(seq 1 30); do
  st="$(docker inspect -f '{{.State.Health.Status}}' opsguard-app 2>/dev/null || true)"
  [ "$st" = "healthy" ] && break
  sleep 5
done
if [ "$st" != "healthy" ]; then
  docker logs --tail 30 opsguard-app >&2 || true
  die "la app no quedó healthy (estado: $st). Rollback: docker tag $APP_IMAGE:${PREV_TAG:-<etiqueta-previa>} $APP_IMAGE:latest && docker compose up -d app"
fi

# 7) Resumen -----------------------------------------------------------
echo ""
log "LISTO: $REV"
docker logs --since 5m opsguard-app 2>&1 | grep -E '\[Bootstrap\]' || true
cat <<EOF

[deploy] Notas:
  - Primer superadmin: si la BD no tenía ninguno, la app lo creó con ADMIN_PASS
    (si está en .env) o con una clave generada que aparece arriba UNA sola vez.
    Guárdala en Gravity Ops y cámbiala tras el primer login.
  - Backup de este despliegue: $BK/
  - Rollback de la app:
      docker tag $APP_IMAGE:${PREV_TAG:-<etiqueta-previa>} $APP_IMAGE:latest && docker compose up -d app
EOF
