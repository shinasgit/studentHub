import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleSecureApiRequest } from './server/secureApiRouter.ts'

function secureBackendPlugin(): Plugin {
  return {
    name: 'secure-backend-plugin',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        handleSecureApiRequest(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', (req, res) => {
        handleSecureApiRequest(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), secureBackendPlugin()],
  server: {
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
      '/api/chroma': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chroma/, ''),
      },
    },
  },
})
