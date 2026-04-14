# OpsGuard — Despliegue en Kubernetes

## Orden de aplicación

```bash
# 1. Configura tus secrets primero (edita 01-secrets.yaml con tus valores en base64)
echo -n "tu-password" | base64
echo -n "tu-jwt-secret" | base64

# 2. Aplica todos los manifiestos en orden
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secrets.yaml
kubectl apply -f 02-postgres.yaml
kubectl apply -f 03-redis.yaml
kubectl apply -f 04-app.yaml
kubectl apply -f 05-ingress.yaml

# O aplica todo de una vez (respeta el orden por nombre de archivo)
kubectl apply -f .
```

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
