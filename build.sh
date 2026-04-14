#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# OpsGuard — Build y push de imágenes Docker a Docker Hub
#
# USO:
#   ./build.sh 1.0.0       → construye y sube versión 1.0.0
#   ./build.sh 1.0.1       → construye y sube versión 1.0.1
#
# REQUISITOS:
#   - Docker instalado y sesión activa (docker login)
#   - buildx habilitado (incluido en Docker Desktop)
#
# PRIMERA VEZ (solo una vez):
#   docker buildx create --name multiarch --use
# ═══════════════════════════════════════════════════════════════

set -e  # Detiene el script si cualquier comando falla

VERSION=${1:-"latest"}
REGISTRY="jeffoisrael"

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
echo "▶ [1/3] Construyendo opsguard-app:v${VERSION} ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REGISTRY}/opsguard-app:v${VERSION}" \
  --tag "${REGISTRY}/opsguard-app:latest" \
  --push \
  .

echo "✅ opsguard-app listo"
echo ""

# ── 2. Base de datos (Postgres + migraciones) ────────────────
echo "▶ [2/3] Construyendo opsguard-db:v${VERSION} ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REGISTRY}/opsguard-db:v${VERSION}" \
  --tag "${REGISTRY}/opsguard-db:latest" \
  --push \
  ./database

echo "✅ opsguard-db listo"
echo ""

# ── 3. Proxy (Nginx + configuración) ────────────────────────
echo "▶ [3/3] Construyendo opsguard-proxy:v${VERSION} ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${REGISTRY}/opsguard-proxy:v${VERSION}" \
  --tag "${REGISTRY}/opsguard-proxy:latest" \
  --push \
  ./nginx

echo "✅ opsguard-proxy listo"
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ Build completo — v${VERSION} publicado en Docker Hub"
echo "║"
echo "║  Imágenes disponibles:"
echo "║    ${REGISTRY}/opsguard-app:v${VERSION}"
echo "║    ${REGISTRY}/opsguard-db:v${VERSION}"
echo "║    ${REGISTRY}/opsguard-proxy:v${VERSION}"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Recuerda actualizar docker-compose.yml si cambias versión:"
echo "  image: ${REGISTRY}/opsguard-app:v${VERSION}"
