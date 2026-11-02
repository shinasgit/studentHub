// scripts/build.mjs
// Smart Build Orchestrator for AI Student Hub
// - On Render (process.env.RENDER === 'true'): Prepares the standalone backend without frontend Vite dependencies.
// - On Local / CI: Builds the full client frontend bundle (tsc -b && vite build) for Firebase Hosting.

import { execSync } from 'child_process';

const isRenderBackend = process.env.RENDER === 'true' || process.env.RENDER === '1';

if (isRenderBackend) {
  console.log('\n================================================================');
  console.log('⚡ RENDER CLOUD BACKEND DETECTED');
  console.log('================================================================');
  console.log('📦 Skipping frontend Vite build (Frontend is deployed to Firebase Hosting).');
  console.log('🚀 Standalone Node.js API server is ready for production execution.');
  console.log('================================================================\n');
  process.exit(0);
}

console.log('\n🚀 Building AI Student Hub frontend production bundle...');
try {
  execSync('npx tsc -b && npx vite build', { stdio: 'inherit' });
  console.log('✅ Client production build complete.');
} catch (err) {
  console.error('❌ Frontend build failed.');
  process.exit(1);
}
