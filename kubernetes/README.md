# OpsGuard — Despliegue en Kubernetes

## Orden de aplicación

```bash
# 1. Configura tus secrets primero (edita 01-secrets.yaml con tus valores en base64)
echo -n "tu-password" | base64
echo -n "tu-jwt-secret" | base64

# 2. Aplica el namespace y los secrets
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets.yaml

# 3. Credencial para bajar las imágenes privadas de GHCR (ghcr.io/beonit-la).
#    Token de GitHub con scope read:packages, guardado en Gravity Ops (módulo Vault).
#    No lo escribas en archivos: pásalo por variable de entorno.
kubectl create secret docker-registry ghcr-pull -n opsguard   --docker-server=ghcr.io   --docker-username=<usuario-github>   --docker-password="$GHCR_TOKEN"

# 4. Aplica el resto de manifiestos en orden
kubectl apply -f 02-postgres.yaml
kubectl apply -f 03-redis.yaml
kubectl apply -f 04-app.yaml
kubectl apply -f 05-ingress.yaml

# O aplica todo de una vez (respeta el orden por nombre de archivo)
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

- `replicas: 1` en el app es obligatorio — las sesiones WhatsApp
  no soportan múltiples instancias del mismo número.
- El Ingress requiere un Ingress Controller instalado en el cluster.
- Para SSL automático instala cert-manager y descomenta las líneas
  del Ingress marcadas como "opcional".
