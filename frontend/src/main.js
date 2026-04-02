import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// createApp() → crea la instancia principal de Vue
// Es como el punto de entrada de toda la aplicación
const app = createApp(App)

// use() → instala plugins globales (como app.use() en Express)
app.use(createPinia()) // Pinia: manejo de estado global (sesiones, auth, cola)
app.use(router)        // Vue Router: navegación entre páginas

// mount() → conecta Vue al <div id="app"> del index.html
app.mount('#app')
