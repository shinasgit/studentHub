// server/index.ts
// Standalone Node.js Backend Server for AI Student Hub
// Production-Ready Deployment Target: Render (Free Web Service)
// 100% Free, Zero External Dependencies, SSRF Protected, CORS-Safe

import http from 'http';
import { handleSecureApiRequest } from './secureApiRouter.ts';
import { getAllowedOrigins } from './securityMiddleware.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = http.createServer((req, res) => {
  handleSecureApiRequest(req, res).catch((err) => {
    console.error('[SERVER_ERROR] Unhandled request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
});

server.listen(PORT, HOST, () => {
  const allowed = getAllowedOrigins();
  console.log('\n================================================================');
  console.log('🚀 AI STUDENT HUB - STANDALONE BACKEND SERVER');
  console.log('================================================================');
  console.log(`📡 Status:      Listening on http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔒 Cloud Endpoints:`);
  console.log(`   - GET  /health (Render Health Check)`);
  console.log(`   - GET  /api/health`);
  console.log(`   - POST /api/extract-web (SSRF-Protected Web/YouTube Extraction)`);
  console.log(`🛡️  Allowed CORS Origins (${allowed.length}):`);
  allowed.forEach((origin) => console.log(`   - ${origin}`));
  console.log(`💻 Local AI Companion Mode:`);
  console.log(`   - ChromaDB/Ollama proxies disabled on cloud (Local Privacy Enforced)`);
  console.log('================================================================\n');
});

// Graceful shutdown handling for Render & container lifecycles
function handleShutdown(signal: string) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed cleanly. Process exit.');
    process.exit(0);
  });

  // Force close if connections hang past 10 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Force terminating hanging connections.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
