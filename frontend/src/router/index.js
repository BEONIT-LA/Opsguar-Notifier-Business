import { createRouter, createWebHistory } from 'vue-router'
import LoginView    from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    // Si ya está autenticado, redirige al dashboard
    beforeEnter: () => {
      if (localStorage.getItem('token')) return '/'
    },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardView,
    // Navigation Guard: protege la ruta.
    // Si no hay token → redirige al login automáticamente.
    beforeEnter: () => {
      if (!localStorage.getItem('token')) return '/login'
    },
  },
  // Cualquier ruta no definida → home
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  // createWebHistory → URLs limpias sin el # (ej: /login en vez de /#/login)
  history: createWebHistory(),
  routes,
})

export default router
