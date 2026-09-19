# OpsGuard — Despliegue en Kubernetes

## Orden de aplicación

```bash
# 1. Namespace
kubectl apply -f 00-namespace.yaml

# 2. Secrets de la app (valores desde Gravity Ops; nunca en archivos del repo).
#    Sin defaults: la app NO arranca en producción sin POSTGRES_PASS y un
#    JWT_SECRET de 32+ caracteres. ADMIN_PASS es opcional (primer superadmin).
kubectl create secret generic opsguard-secrets -n opsguard   --from-literal=POSTGRES_PASS="$POSTGRES_PASS"   --from-literal=JWT_SECRET="$(openssl rand -hex 32)"   --from-literal=ADMIN_PASS="$ADMIN_PASS"
#    (alternativa: 01-secrets.yaml.example)

# 3. Credencial para bajar las imágenes privadas de GHCR (ghcr.io/beonit-la).
#    Token de GitHub con scope read:packages, guardado en Gravity Ops (módulo Vault).
#    No lo escribas en archivos: pásalo por variable de entorno.
kubectl create secret docker-registry ghcr-pull -n opsguard   --docker-server=ghcr.io   --docker-username=<usuario-github>   --docker-password="$GHCR_TOKEN"

# 4. Aplica el resto de manifiestos en orden
kubectl apply -f 02-postgres.yaml
kubectl apply -f 03-redis.yaml
kubectl apply -f 04-app.yaml
kubectl apply -f 05-ingress.yaml

# O aplica todo de una vez (respeta el orden por nombre de archivo; el Secret
# ya debe existir)
kubectl apply -f .
```

## Imágenes

| Componente | Imagen |
|---|---|
| App | `ghcr.io/beonit-la/opsguar-notifier-business-app:2.0.0` |
| BD (postgres + migraciones 001–011) | `ghcr.io/beonit-la/opsguar-notifier-business-db:2.0.0` |
| Redis | `redis:7-alpine` (pública) |

Se construyen y publican con `../build.sh 2.0.0` (requiere `docker login ghcr.io`).
Para una versión nueva: publicar con `build.sh`, actualizar el tag en
`02-postgres.yaml` / `04-app.yaml` y `kubectl apply`.

## Verificar estado

```bash
kubectl get pods -n opsguard
kubectl get services -n opsguard
kubectl get ingress -n opsguard
kubectl logs -n opsguard deployment/app -f
```

## Notas importantes

- **Primer superadmin**: si la BD no tiene ninguno, la app lo crea al arrancar
  (`ADMIN_USER`, default `admin`). Sin `ADMIN_PASS` genera una clave aleatoria
  y la muestra UNA vez: `kubectl logs -n opsguard deployment/app | grep Bootstrap`.

- `replicas: 1` en el app es obligatorio — las sesiones WhatsApp
  no soportan múltiples instancias del mismo número.
- El Ingress requiere un Ingress Controller instalado en el cluster.
- Para SSL automático instala cert-manager y descomenta las líneas
  del Ingress marcadas como "opcional".
