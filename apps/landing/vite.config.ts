/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** The NestJS server the dev proxy talks to; override with API_TARGET. */
const api = process.env.API_TARGET ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // The landing page only reads public endpoints (today's rates and categories).
    proxy: { '/api': api },
  },
  preview: { port: 4174 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
