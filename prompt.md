Revisa todo el proyecto. Actualmente usa Baileys para 
WhatsApp pero tiene estos problemas que necesito resolver:

1. MULTI-SESIÓN: Refactorizar para soportar múltiples 
números de WhatsApp simultáneos. Cada sesión debe tener 
su propia carpeta de autenticación separada en 
auth_sessions/numero_1/, auth_sessions/numero_2/, etc. 
Si una sesión falla, solo se reinicia esa sesión sin 
afectar las demás.

2. SESSION MANAGER: Crear un manejador que detecte 
automáticamente cuando una sesión se desconecta y la 
reconecte. Si falla 3 veces seguidas, marcarla como 
caída y emitir un evento para que el frontend pida 
re-escanear el QR. Nunca borrar carpetas de otras 
sesiones activas.

3. REDIS QUEUE: Integrar Redis con Bull o BullMQ para 
encolar los mensajes salientes. El worker debe elegir 
el número disponible usando round-robin. Si un número 
está caído, usar los disponibles. Redis corre en 
localhost:6379.

4. API REST: Exponer endpoints para:
   - POST /sessions → agregar nueva sesión/número
   - GET /sessions → listar sesiones y su estado
   - DELETE /sessions/:id → eliminar sesión
   - GET /sessions/:id/qr → obtener QR para escanear
   - POST /send → encolar mensaje (elige número automático)

5. WEBSOCKET: Emitir eventos en tiempo real de:
   - Estado de cada sesión (conectado/desconectado/qr)
   - El QR como base64 para mostrarlo en el frontend

Usa las mismas dependencias que ya tiene el proyecto 
si es posible. Muéstrame el plan completo antes de 
hacer cambios.