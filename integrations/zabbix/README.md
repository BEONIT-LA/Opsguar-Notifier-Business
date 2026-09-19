# Integración Zabbix → Opsguar-Notifier Business (WhatsApp)

Media Type (webhook) para que **Zabbix** envíe sus alertas a un grupo de WhatsApp
a través de **Opsguar-Notifier Business** (`POST /api/send`).

- Compatible con **Zabbix 6.0 / 7.x / 8.x** (motor Duktape, JavaScript ES5).
- Archivos:
  - `mediatype-opsguar-notifier-business.yaml` — Media Type importable (formato 7.0;
    Zabbix 7.x y 8.x lo importan tal cual).
  - `webhook.js` — el script, **fuente única**. El YAML lleva exactamente el mismo
    código; `tests/zabbixWebhook.test.js` falla si divergen, si deja de ser ES5 o si
    cambia el comportamiento ante las respuestas de la API.

---

## Cómo funciona

```
Trigger → Acción → Media Type (webhook)
   → POST https://notificaciones.beonit.la/api/send
     Authorization: Bearer {$OPSGUARD.TOKEN}
     { "groupId": "{ALERT.SENDTO}", "text": "{ALERT.SUBJECT}\n\n{ALERT.MESSAGE}" }
   → 202 Accepted { data: { jobId } }  → el notifier encola y entrega al grupo
```

- El destino sale del **"Send to"** del medio del usuario: cada usuario o escalado
  puede ir a un grupo distinto.
- El webhook devuelve `OK (job N)`: el `jobId` queda en *Reports → Action log* y se
  puede cruzar con la auditoría del notifier.
- El token **no** se escribe en el log de Zabbix; el texto sólo con `DebugLevel=4`.

---

## Requisitos previos (en Opsguar-Notifier Business)

1. **Sesión de WhatsApp lista** (workspace del responsable → *Sesiones*): el número
   debe ser **miembro del grupo** destino.
2. **JID del grupo** (*Grupos* → `id`, formato `120363xxxxxxxxx@g.us`): va en "Send to".
3. **Token de API** (*API → Generar token*, `ogt_...`, se muestra una vez).
   Guárdalo en **Gravity Ops**.

---

## Instalación en Zabbix

1. **Macro global secreta con el token** — *Administración → General → Macros*:
   - Macro: `{$OPSGUARD.TOKEN}` · Valor: `ogt_...` · Tipo: **Secret text**.
   - Así el token no queda visible en la Media Type ni en exportaciones.
2. **Importar la Media Type** — *Alertas → Tipos de medios → Importar* →
   `mediatype-opsguar-notifier-business.yaml` (marca *Create new* y *Update existing*).
   - Si tu instancia usa otra URL, cambia el parámetro `URL`.
   - Zabbix **6.0**: cambia `version: '7.0'` por `version: '6.0'` antes de importar.
3. **Medio del usuario** — *Usuarios → (usuario) → Medios → Agregar*:
   tipo **Opsguar-Notifier Business (WhatsApp)**, **Send to** = JID del grupo,
   severidades y horario deseados.
4. **Acción** — *Alertas → Acciones → Acciones de triggers*: condiciones (p. ej.
   severidad ≥ Average) y operación *Enviar mensaje* a ese usuario/grupo vía la Media Type.
   Añade también operaciones de **recuperación** y **actualización** si quieres esos avisos.

### Crear a mano (sin importar)

Media Type tipo **Webhook**, script = contenido de `webhook.js`, parámetros:

| Parámetro   | Valor |
|-------------|-------|
| `URL`       | `https://notificaciones.beonit.la/api/send` |
| `Token`     | `{$OPSGUARD.TOKEN}` |
| `GroupId`   | `{ALERT.SENDTO}` |
| `Subject`   | `{ALERT.SUBJECT}` |
| `Message`   | `{ALERT.MESSAGE}` |
| `HTTPProxy` | *(vacío o tu proxy)* |

Reintentos: 3 cada 10 s. `max_sessions: 1` es suficiente: la API sólo encola y responde al instante.

---

## Probar

- Media Type → **Test**: `Send to` = JID del grupo, un `Subject`/`Message` de prueba.
  Si el diálogo no resuelve la macro, pega el token directamente en el campo `Token`
  **sólo en el diálogo de prueba**. Esperado: `OK (job N)` y el mensaje en el grupo.
- Por consola (el token desde una variable, no escrito en el comando):

```bash
curl -sS -X POST https://notificaciones.beonit.la/api/send \
  -H "Authorization: Bearer $OPSGUARD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"120363xxxxxxxxx@g.us","text":"Prueba desde Zabbix"}'
# Esperado: HTTP 202 {"success":true,"data":{"jobId":"..."}}
```

---

## Tiempos: modo humano

El notifier no envía al instante: cada mensaje pasa por pausa de reacción +
"escribiendo…" (≈ 3–14 s) y después el número descansa 4–12 s antes del siguiente.
Medido en producción: **13–15 s** de la cola al envío.

- En una **tormenta de alertas** con un solo número, los mensajes salen en fila
  (~20 s cada uno). Para más caudal: varios números en un **Pool** del grupo
  (pestaña *Pools*) o bajar `HUMAN_THINK_MAX_MS` / `HUMAN_TYPING_MAX_MS` /
  `HUMAN_COOLDOWN_*` en el notifier. `HUMAN_MODE=false` lo desactiva.
- Reduce el volumen en Zabbix: severidad mínima en la acción, *pausa de
  operaciones* para supresiones y dependencias entre triggers.

---

## Solución de problemas

| Síntoma (Action log) | Causa |
|---|---|
| `Token sin configurar ... {$OPSGUARD.TOKEN}` | Falta la macro global o está mal escrita |
| `HTTP 401` | Token inválido o revocado → genera otro y actualiza la macro |
| `HTTP 402` | Cuota del tenant agotada |
| `HTTP 403` | Tenant suspendido o fuera de vigencia |
| `HTTP 0 - Sin respuesta` | DNS, TLS, proxy o firewall desde el server/proxy de Zabbix |
| `... no es un JID de grupo` | El "Send to" no termina en `@g.us` |
| `OK (job N)` pero no llega | Sin sesión lista o el número no es miembro del grupo: revisa *Sesiones*, *Grupos*, *Pools* y *Auditoría* (job N) |

Logs detallados: `zabbix_server.log` con `DebugLevel=4` (líneas `[Opsguar-Notifier]`).
