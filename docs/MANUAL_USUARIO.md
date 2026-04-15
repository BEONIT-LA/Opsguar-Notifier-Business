# OpsGuard — Manual de Usuario

> Sistema de Notificaciones WhatsApp
> Versión 1.0 · Última actualización: 2026

---

## Tabla de Contenido

1. [¿Qué es OpsGuard?](#1-qué-es-opsguard)
2. [Acceder al Panel](#2-acceder-al-panel)
3. [Conectar un Número WhatsApp](#3-conectar-un-número-whatsapp)
4. [Gestionar Grupos](#4-gestionar-grupos)
5. [Pools de Sesiones](#5-pools-de-sesiones)
6. [Enviar Mensajes](#6-enviar-mensajes)
7. [Historial de Envíos](#7-historial-de-envíos)
8. [Cambiar Contraseña](#8-cambiar-contraseña)
9. [Preguntas Frecuentes](#9-preguntas-frecuentes)

---

## 1. ¿Qué es OpsGuard?

OpsGuard es un sistema que permite enviar notificaciones automáticas a grupos de WhatsApp. Funciona conectando números de WhatsApp al sistema y enviando mensajes de texto, imágenes y documentos a través de una cola inteligente.

**Casos de uso:**
- Alertas automáticas desde Jira, n8n u otros sistemas
- Notificaciones de incidentes a equipos de trabajo
- Envío de reportes y documentos a grupos internos

---

## 2. Acceder al Panel

Abre tu navegador y entra a la URL que te proporcionó tu administrador:

```
https://tu-dominio.com:8443
```

Ingresa tus credenciales:

| Campo | Valor inicial |
|-------|--------------|
| Usuario | `admin` |
| Contraseña | `admin123` |

> ⚠️ **Cambia la contraseña inmediatamente** después del primer ingreso.

---

## 3. Conectar un Número WhatsApp

Para enviar mensajes necesitas al menos un número de WhatsApp conectado al sistema. Cada número conectado se llama **sesión**.

### 3.1 Crear una sesión

1. Ve a la pestaña **Sesiones**
2. Escribe un nombre para identificar el número (ej: `ventas`, `soporte`)
3. Clic en **Crear Sesión**
4. Aparece un código QR en pantalla

### 3.2 Escanear el QR

1. Abre WhatsApp en tu teléfono
2. Ve a **Dispositivos vinculados → Vincular dispositivo**
3. Escanea el código QR que aparece en el panel
4. El estado cambia a ✅ **Conectado**

> ⚠️ **Importante:** Un número de WhatsApp solo puede estar conectado en un lugar a la vez. Si lo conectas aquí, se desconectará de WhatsApp Web si estaba abierto ahí.

### 3.3 Estados de una sesión

| Estado | Significado |
|--------|-------------|
| 🟡 Esperando QR | Listo para escanear |
| ✅ Conectado | Activo y enviando mensajes |
| 🔴 Desconectado | Perdió conexión, reconecta manualmente |

### 3.4 Eliminar una sesión

1. Ve a **Sesiones**
2. Clic en el botón eliminar junto a la sesión
3. El número se desconecta del sistema

---

## 4. Gestionar Grupos

Los grupos son los destinos donde se envían los mensajes.

### 4.1 Ver grupos disponibles

1. Ve a la pestaña **Grupos**
2. Selecciona una sesión conectada
3. El sistema carga todos los grupos donde ese número es miembro

### 4.2 ID del grupo

Cada grupo tiene un identificador único con formato:

```
120363XXXXXXXXXX@g.us
```

Este ID es el que se usa al enviar mensajes desde la API o desde integraciones como n8n.

---

## 5. Pools de Sesiones

Un **pool** asocia un grupo con una o varias sesiones. Sirve para organizar qué números envían a qué grupos.

### 5.1 ¿Para qué sirve un pool?

- **1 sesión en el pool** → mensajes en orden estricto (secuencial)
- **Varias sesiones en el pool** → mensajes en paralelo (más velocidad)

### 5.2 Crear un pool

1. Ve a la pestaña **Pools**
2. Clic en **Nuevo Pool**
3. Completa:
   - **Nombre:** identificador del pool (ej: `equipo-soporte`)
   - **Group ID:** el ID del grupo de WhatsApp
   - **Sesiones:** selecciona qué números participan
4. Clic en **Guardar**

---

## 6. Enviar Mensajes

### 6.1 Desde el panel

1. Ve a la pestaña **Enviar**
2. Completa el formulario:
   - **Group ID:** ID del grupo destino
   - **Texto:** mensaje (opcional)
   - **Imagen:** archivo PNG, JPG, WEBP (opcional)
   - **Documento:** PDF, DOCX, XLSX (opcional)
3. Clic en **Enviar**
4. El sistema devuelve un **Job ID** — el mensaje está en cola

### 6.2 Combinaciones de mensajes

| Combinación | Resultado |
|-------------|-----------|
| Solo texto | 1 mensaje de texto |
| Solo imagen | 1 mensaje con imagen |
| Solo documento | 1 mensaje con documento |
| Texto + imagen | 1 mensaje: imagen con texto como pie de foto |
| Texto + documento | 1 mensaje: documento con texto como descripción |
| Texto + imagen + documento | 2 mensajes: imagen con texto + documento |
| Imagen + documento | 2 mensajes separados |

### 6.3 ¿Qué pasa después de enviar?

El mensaje entra a una **cola de envío**. El sistema lo procesa automáticamente:

1. Toma el siguiente número disponible (sesión lista)
2. Envía el mensaje
3. Espera 3-6 segundos antes del siguiente envío (evita bloqueos de WhatsApp)
4. Si falla → reintenta hasta 5 veces automáticamente

---

## 7. Historial de Envíos

El panel guarda un registro de todos los mensajes enviados.

### 7.1 Ver el historial

1. Ve a la pestaña **Auditoría** o **Historial**
2. Filtra por:
   - **Fecha**
   - **Sesión**
   - **Estado** (completado / fallido)

### 7.2 Estados de un mensaje

| Estado | Significado |
|--------|-------------|
| ✅ Completado | Mensaje enviado correctamente |
| ❌ Fallido | No se pudo enviar después de 5 intentos |
| ⏳ En cola | Esperando ser procesado |

---

## 8. Cambiar Contraseña

1. Clic en tu nombre de usuario (esquina superior derecha)
2. Selecciona **Cambiar contraseña**
3. Ingresa tu contraseña actual
4. Ingresa la nueva contraseña (mínimo 6 caracteres)
5. Clic en **Guardar**

---

## 9. Preguntas Frecuentes

**¿Por qué el QR expiró?**
El QR tiene una duración limitada. Elimina la sesión y créala de nuevo para obtener un QR nuevo.

**¿Por qué mi mensaje dice "fallido"?**
WhatsApp puede rechazar mensajes si el número envía demasiado rápido o si el grupo ya no existe. Revisa el historial para ver el detalle del error.

**¿Puedo conectar varios números?**
Sí, puedes conectar tantos números como necesites. Cada uno es una sesión independiente.

**¿Los mensajes se envían en orden?**
Con una sola sesión, sí. Con múltiples sesiones el orden puede variar levemente ya que se procesan en paralelo.

**¿Qué pasa si el número se desconecta?**
El sistema detecta la desconexión. Los mensajes en cola esperan hasta que el número vuelva a conectarse o hasta que otro número del pool tome el trabajo.
