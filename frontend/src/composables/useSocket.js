import { io } from 'socket.io-client'
import { useSessionsStore } from '@/stores/sessions'
import { useQueueStore }    from '@/stores/queue'
import { useLiveFeedStore } from '@/stores/liveFeed'

// Singleton: una sola conexión socket para toda la app
let socket = null

export function useSocket() {
  if (!socket) {
    // El backend autentica el handshake con el JWT y une el socket a la
    // room "tenant:{id}" de la empresa — así solo recibe sus propios eventos.
    socket = io({
      transports: ['websocket'],
      auth: { token: localStorage.getItem('token') },
    })

    socket.on('connect', () => {
      console.log('[Socket] Conectado ✓', socket.id)
      useLiveFeedStore().add('system', '🔌 WebSocket conectado')
    })

    socket.on('disconnect', () => {
      console.log('[Socket] Desconectado')
      useLiveFeedStore().add('warn', '⚠ WebSocket desconectado')
    })

    // ── Sesiones ─────────────────────────────────────────────
    // El servidor emite 'sessions:state' con el mapa completo de sesiones
    socket.on('sessions:state', (data) => {
      useSessionsStore().updateFromSocket(data)
    })

    socket.on('session:ready', ({ sessionId }) => {
      useSessionsStore().fetchSessions()
      useLiveFeedStore().add('success', `✅ Sesión <b>${sessionId}</b> conectada y lista`)
    })

    socket.on('session:qr', ({ sessionId }) => {
      useSessionsStore().fetchSessions()
      useLiveFeedStore().add('info', `📱 QR generado para <b>${sessionId}</b> — escanea con WhatsApp`)
    })

    socket.on('session:disconnected', ({ sessionId, statusCode }) => {
      useSessionsStore().fetchSessions()
      useLiveFeedStore().add('warn', `⚡ Sesión <b>${sessionId}</b> desconectada (código: ${statusCode ?? '–'})`)
    })

    socket.on('session:failed', ({ sessionId, reason }) => {
      useSessionsStore().fetchSessions()
      useLiveFeedStore().add('error', `❌ Sesión <b>${sessionId}</b> falló: ${reason ?? ''}`)
    })

    socket.on('session:removed', ({ sessionId }) => {
      useSessionsStore().fetchSessions()
      useLiveFeedStore().add('warn', `🗑 Sesión <b>${sessionId}</b> eliminada`)
    })

    // ── Jobs / Cola ───────────────────────────────────────────
    socket.on('job:warn', ({ sessionId, groupId, message }) => {
      useLiveFeedStore().add('warn', `⚠ ${message}`)
      useQueueStore().fetchStats()
    })

    socket.on('queue:update', () => {
      useQueueStore().fetchStats()
    })
  }

  return { socket }
}
