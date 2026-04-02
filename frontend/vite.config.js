import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  // Al compilar (npm run build), los archivos van directo a /public
  // Express ya sirve esa carpeta con express.static()
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },

  // En desarrollo (npm run dev), Vite corre en :5173
  // y hace proxy a Express en :3000 para que /api y socket.io funcionen
  server: {
    port: 5173,
    proxy: {
      '/api':       'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },

  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
