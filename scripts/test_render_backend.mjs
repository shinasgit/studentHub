// scripts/test_render_backend.mjs
// Verification suite for independent Render backend deployment
// Tests: Standalone server startup, /health, CORS headers, SSRF defense, Cloud Local-AI Guards

import http from 'http';

// Configure environment before importing server
process.env.PORT = '3847';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'production';
process.env.RENDER = 'true';
process.env.ENABLE_LOCAL_AI_PROXIES = 'false';
process.env.ALLOWED_ORIGINS = 'https://studenthub-36f7a.web.app,https://studenthub-36f7a.firebaseapp.com';

const { default: server } = await import('../server/index.ts');

const TEST_PORT = 3847;
let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        ...options,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            json,
          });
        });
      }
    );

    req.on('error', reject);

    if (bodyData) {
      const payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n=============================================================================');
  console.log('🧪 VERIFYING STANDALONE RENDER BACKEND SERVER');
  console.log('=============================================================================\n');

  try {
    // 1. Health check endpoint
    console.log('\n--- 1. Testing Health Check & Status Endpoints ---');
    const healthRes = await request({ path: '/health', method: 'GET' });
    assert(healthRes.statusCode === 200, '1.1 GET /health returns HTTP 200');
    assert(healthRes.json?.status === 'ok', '1.2 Status is "ok"');
    assert(healthRes.json?.service === 'ai-student-hub-backend', '1.3 Identifies as ai-student-hub-backend');

    const apiHealthRes = await request({ path: '/api/health', method: 'GET' });
    assert(apiHealthRes.statusCode === 200, '1.4 GET /api/health returns HTTP 200');

    const rootRes = await request({ path: '/', method: 'GET' });
    assert(rootRes.statusCode === 200, '1.5 GET / returns HTTP 200 with service info');

    // 2. CORS Preflight & Headers
    console.log('\n--- 2. Testing Production CORS Configuration ---');
    const corsPreflight = await request({
      path: '/api/extract-web',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://studenthub-36f7a.web.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert(corsPreflight.statusCode === 204, '2.1 OPTIONS preflight returns HTTP 204');
    assert(
      corsPreflight.headers['access-control-allow-origin'] === 'https://studenthub-36f7a.web.app',
      '2.2 Origin header matches studenthub-36f7a.web.app'
    );

    const firebaseAppCors = await request({
      path: '/api/extract-web',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://studenthub-36f7a.firebaseapp.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert(
      firebaseAppCors.headers['access-control-allow-origin'] === 'https://studenthub-36f7a.firebaseapp.com',
      '2.3 Origin header matches studenthub-36f7a.firebaseapp.com'
    );

    // 3. SSRF Defense on Web Extraction
    console.log('\n--- 3. Testing SSRF & Security Defense ---');
    const ssrfRes = await request(
      { path: '/api/extract-web', method: 'POST' },
      { url: 'http://127.0.0.1:8000/api/v1/collections' }
    );
    assert(
      ssrfRes.json?.success === false || ssrfRes.statusCode >= 400,
      '3.1 SSRF attack targeting 127.0.0.1 is safely blocked'
    );
    assert(
      (ssrfRes.json?.error || '').toLowerCase().includes('blocked') ||
        (ssrfRes.json?.error || '').toLowerCase().includes('internal') ||
        ssrfRes.statusCode === 400,
      '3.2 Descriptive security error reported for internal host targets'
    );

    // 4. Cloud Guard: Local AI operations blocked on Render
    console.log('\n--- 4. Testing Local AI Cloud Guards (ChromaDB & Ollama Protection) ---');
    const chromaCloudRes = await request(
      { path: '/api/secure/chroma/api/v1/collections', method: 'GET' },
      null
    );
    assert(chromaCloudRes.statusCode === 403, '4.1 Cloud access to /api/secure/chroma is blocked with HTTP 403');
    assert(
      chromaCloudRes.json?.status === 'local_companion_required',
      '4.2 Identifies that local companion is required for vector/LLM operations'
    );

    const ollamaCloudRes = await request(
      { path: '/api/secure/ollama/api/tags', method: 'GET' },
      null
    );
    assert(ollamaCloudRes.statusCode === 403, '4.3 Cloud access to /api/secure/ollama is blocked with HTTP 403');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n🧹 Closing test server...');
    server.close();
  }

  console.log('\n=============================================================================');
  console.log(`📊 RENDER BACKEND TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
