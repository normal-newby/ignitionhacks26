import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Third arg '' loads every var, not just the VITE_-prefixed ones — this is a dev-server
  // setting, not something the client bundle ever sees.
  const env = loadEnv(mode, path.dirname(src), '')

  return {
    plugins: [react()],
    resolve: {
      // "@/..." -> src/..., matching the paths entry in jsconfig.json. This used to come
      // from the base44 vite plugin; it's declared here now that the plugin is gone.
      alias: { '@': src },
    },
    server: {
      // Vite defaults to 5173 and ignores PORT; honouring it lets a second dev server come
      // up on a free port instead of failing.
      port: env.PORT ? Number(env.PORT) : 5173,
      // In dev the API lives on the Spring Boot app; in prod Spring serves this build itself,
      // so the frontend only ever talks to same-origin /api either way. Override the target
      // with API_PROXY_TARGET in frontend/.env.local when the backend isn't on 8080.
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8080',
          // Room-scan videos are large and slow; don't time the upload out mid-stream.
          timeout: 0,
          proxyTimeout: 0,
        },
      },
    },
  }
})
