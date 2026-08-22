import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@/..." -> src/..., matching the paths entry in jsconfig.json. This used to come
    // from the base44 vite plugin; it's declared here now that the plugin is gone.
    alias: { '@': src },
  },
  server: {
    // In dev the API lives on the Spring Boot app; in prod Spring serves this build itself,
    // so the frontend only ever talks to same-origin /api either way.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        // Room-scan videos are large and slow; don't time the upload out mid-stream.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
