#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Opsguar-Notifier Business — Build y push de imágenes a GHCR (ghcr.io/beonit-la)
#
# USO:
#   ./build.sh 1.0.0       → construye y sube versión 1.0.0
#   ./build.sh 1.0.1       → construye y sube versión 1.0.1
#
# REQUISITOS:
#   - Docker instalado y sesión activa en GHCR:
#       echo "$GHCR_TOKEN" | docker login ghcr.io -u <usuario-github> --password-stdin
#     (token con scope write:packages, guardado en Gravity Ops)
#   - buildx habilitado (incluido en Docker Desktop)
#
# PRIMERA VEZ (solo una vez):
#   docker buildx create --name multiarch --use
# ═══════════════════════════════════════════════════════════════

set -e  # Detiene el script si cualquier comando falla

VERSION=${1:-"latest"}
REGISTRY="ghcr.io/beonit-la"
NAME="opsguar-notifier-business"

if [ "$VERSION" == "latest" ]; then
  echo "⚠  No especificaste versión. Uso: ./build.sh 1.0.0"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  OpsGuard Build — versión: v${VERSION}               "
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. App (Node.js + Vue compilado) ────────────────────────
echo "▶ [1/3] Construyendo ${NAME}-app:${VERSION} ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REGISTRY}/${NAME}-app:${VERSION}" \
  --tag "${REGISTRY}/${NAME}-app:latest" \
  --push \
  .

echo "✅ ${NAME}-app listo"
echo ""

# ── 2. Base de datos (Postgres + migraciones) ────────────────
echo "▶ [2/3] Construyendo ${NAME}-db:${VERSION} ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REGISTRY}/${NAME}-db:${VERSION}" \
  --tag "${REGISTRY}/${NAME}-db:latest" \
  --push \
  ./database

echo "✅ ${NAME}-db listo"
echo ""

# ── 3. Proxy (Nginx + configuración) ────────────────────────
echo "▶ [3/3] Construyendo ${NAME}-proxy:${VERSION} ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REGISTRY}/${NAME}-proxy:${VERSION}" \
  --tag "${REGISTRY}/${NAME}-proxy:latest" \
  --push \
  ./nginx

echo "✅ ${NAME}-proxy listo"
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ Build completo — v${VERSION} publicado en GHCR"
echo "║"
echo "║  Imágenes disponibles:"
echo "║    ${REGISTRY}/${NAME}-app:${VERSION}"
echo "║    ${REGISTRY}/${NAME}-db:${VERSION}"
echo "║    ${REGISTRY}/${NAME}-proxy:${VERSION}"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Recuerda actualizar docker-compose.yml y kubernetes/ si cambias versión:"
echo "  image: ${REGISTRY}/${NAME}-app:${VERSION}"
