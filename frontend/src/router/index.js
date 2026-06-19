import { createRouter, createWebHistory } from 'vue-router'
import LoginView     from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import AdminView     from '@/views/AdminView.vue'

function authed()  { return !!localStorage.getItem('token') }
function isSuper()  { return localStorage.getItem('role') === 'superadmin' }

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    beforeEnter: () => {
      if (authed()) return isSuper() ? '/admin' : '/'
    },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardView,
    // Workspace del responsable. El superadmin se redirige a su consola.
    beforeEnter: () => {
      if (!authed()) return '/login'
      if (isSuper()) return '/admin'
    },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminView,
    // Consola de plataforma — solo superadmin.
    beforeEnter: () => {
      if (!authed()) return '/login'
      if (!isSuper()) return '/'
    },
  },
  // Cualquier ruta no definida → home
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
