/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** The NestJS server the dev proxy talks to; override with API_TARGET (e.g. a second API on another port). */
const api = process.env.API_TARGET ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // API calls and live events go to the NestJS server during development.
    proxy: {
      '/api': api,
      '/socket.io': { target: api, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
