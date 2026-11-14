import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Calls to /api go to the NestJS server during development
    proxy: { '/api': 'http://localhost:3000' },
  },
})
