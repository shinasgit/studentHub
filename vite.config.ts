import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleExtractWebRequest } from './server/webExtractorMiddleware.ts'

function webExtractorPlugin(): Plugin {
  return {
    name: 'web-extractor-plugin',
    configureServer(server) {
      server.middlewares.use('/api/extract-web', (req, res) => {
        handleExtractWebRequest(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/extract-web', (req, res) => {
        handleExtractWebRequest(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), webExtractorPlugin()],
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
