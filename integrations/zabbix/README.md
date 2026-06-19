# Integración Zabbix → Opsguar-Notifier Business (WhatsApp)

Media Type (webhook) para que **Zabbix** envíe sus alertas a un grupo de WhatsApp
a través de **Opsguar-Notifier Business** (`POST /api/send`).

- Compatible con **Zabbix 6.0 / 7.x / 8.x** (motor Duktape, JS ES5).
- Archivos:
  - `mediatype-opsguar-notifier-business.yaml` — Media Type importable (formato 7.0).
  - `webhook.js` — el script del webhook (referencia / por si lo creas a mano).

---

## Cómo funciona

```
Trigger en Zabbix  →  Acción  →  Media Type (webhook)
        →  POST https://notificaciones.beonit.la/api/send
           Authorization: Bearer ogt_xxxxx
           { "groupId": "<JID del grupo>", "text": "<asunto + mensaje>" }
        →  Opsguar-Notifier encola y entrega el mensaje al grupo de WhatsApp
```

El webhook envía **JSON** (verificado: la API responde `202 Accepted`). El destino
(grupo de WhatsApp) se toma del campo **"Send to"** del medio del usuario, así que
distintos usuarios/escalados pueden ir a distintos grupos.

---

## Requisitos previos (en Opsguar-Notifier Business)

1. **Sesión de WhatsApp conectada**: entra al workspace del responsable
   (https://notificaciones.beonit.la), pestaña **Sesiones → + Nueva sesión**,
   y **escanea el QR** con el número que enviará las alertas.
   > El número debe ser **miembro del grupo** de WhatsApp destino.
2. **JID del grupo destino**: pestaña **Grupos** → copia el `id` del grupo
   (formato `120363xxxxxxxxx@g.us`). Ese es el valor de "Send to".
3. **Token de API**: pestaña **API → Generar token** → copia el `ogt_...`
   (se muestra una sola vez). Es lo que va en el parámetro `Token`.

---

## Instalación en Zabbix

### Opción A — Importar la Media Type (recomendado)

1. **Administración → Tipos de medios (Media types) → Importar**.
2. Sube `mediatype-opsguar-notifier-business.yaml`. Marca *Create new* / *Update*.
3. Abre la Media Type recién creada **“Opsguar-Notifier Business (WhatsApp)”** y en
   **Parámetros** reemplaza `Token` por tu token `ogt_...`. Guarda.

### Opción B — Crear a mano

Crea una Media Type tipo **Webhook** con estos parámetros y pega el contenido de
`webhook.js` en el campo *Script*:

| Parámetro  | Valor |
|------------|-------|
| `URL`      | `https://notificaciones.beonit.la/api/send` |
| `Token`    | `ogt_...` (tu token de API) |
| `GroupId`  | `{ALERT.SENDTO}` |
| `Subject`  | `{ALERT.SUBJECT}` |
| `Message`  | `{ALERT.MESSAGE}` |
| `HTTPProxy`| *(vacío, o tu proxy)* |

> En *Message templates* deja los de Problema / Recuperación / Actualización
> (ya vienen en el YAML).

---

## Asignar el medio a un usuario y disparar alertas

1. **Usuarios → (tu usuario) → Medios → Agregar**:
   - Tipo: **Opsguar-Notifier Business (WhatsApp)**
   - **Send to**: el **JID del grupo** (`120363xxxxxxxxx@g.us`)
   - Activo, con la franja horaria y severidades que quieras.
2. **Alertas → Acciones → Acciones de triggers → Crear acción**:
   - Condiciones (por ejemplo severidad ≥ Advertencia).
   - **Operaciones → Enviar mensaje** → al usuario/grupo de usuarios, vía la Media Type.

---

## Probar

- En la Media Type, botón **Test**: pon `Send to` = el JID del grupo, un `Subject`
  y `Message` de prueba, y envía. Debe responder **OK** y llegar el mensaje al grupo.
- Prueba rápida por consola (reemplaza el token):

```bash
curl -X POST https://notificaciones.beonit.la/api/send \
  -H "Authorization: Bearer ogt_TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"120363xxxxxxxxx@g.us","text":"Prueba desde Zabbix ✅"}'
# Esperado: HTTP 202 { "success": true, "data": { "jobId": "..." } }
```

---

## Notas y solución de problemas

- **HTTP 401** → token inválido/revocado: genera otro en la pestaña API.
- **HTTP 402** → cuota de mensajes agotada (no aplica si el tenant es ilimitado).
- **HTTP 403** → empresa suspendida o fuera de vigencia.
- **202 pero no llega el mensaje** → no hay sesión de WhatsApp lista, o el número
  **no es miembro** del grupo destino. Revisa Sesiones/Grupos y los **Pools**
  (en la pestaña Pools puedes fijar qué número envía a qué grupo).
- **Logs del webhook**: *Reports → Action log*, y `Zabbix.log(...)` aparece en
  `zabbix_server.log` con `DebugLevel` alto.
- Para **6.0**, cambia `version: '7.0'` por `version: '6.0'` en el YAML (la estructura
  es la misma).
