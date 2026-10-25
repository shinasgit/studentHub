// scripts/test_ollama_service.mjs
import http from 'http';

console.log('================================================================');
console.log('       AI STUDENT HUB - OLLAMA SERVICE INTEGRATION TEST         ');
console.log('================================================================\n');

const testResults = [];

function recordResult(testName, passed, details) {
  testResults.push({ testName, passed, details });
  const icon = passed ? 'PASS [✓]' : 'FAIL [✗]';
  console.log(`${icon} - ${testName}`);
  if (details) console.log(`       Details: ${details}`);
}

// 1. Emulate Ollama Service functions matching src/services/ollamaService.ts
async function checkConnection(baseUrl) {
  const startTime = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama returned status ${res.status}`);
    const data = await res.json();
    return {
      connected: true,
      models: data.models || [],
      latencyMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    const msg = err.message || String(err);
    return {
      connected: false,
      models: [],
      error: {
        code: msg.includes('404') ? 'MODEL_NOT_FOUND' : 'NOT_INSTALLED_OR_RUNNING',
        message: msg,
      },
    };
  }
}

async function generateCompletion({ model, prompt, customBaseUrl, abortSignal }) {
  const res = await fetch(`${customBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: abortSignal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }

  return await res.json();
}

async function runTests() {
  // Test 1: Disconnected server handling
  try {
    // Port 11434 is currently closed as verified
    const res = await checkConnection('http://127.0.0.1:11434');
    const passed = res.connected === false && res.models.length === 0;
    recordResult(
      'Test 1: Disconnected Ollama Graceful Handling',
      passed,
      `Reported connected: ${res.connected}, error caught gracefully without crash.`
    );
  } catch (err) {
    recordResult('Test 1: Disconnected Ollama Graceful Handling', false, err.message);
  }

  // Set up a mock local Ollama HTTP server on port 11499 to test API protocol compliance
  const mockServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          models: [
            {
              name: 'llama3.2:3b',
              model: 'llama3.2:3b',
              modified_at: new Date().toISOString(),
              size: 2019393189,
              digest: 'a1b2c3d4e5',
              details: { parameter_size: '3.2B', family: 'llama' },
            },
            {
              name: 'qwen2.5:3b',
              model: 'qwen2.5:3b',
              modified_at: new Date().toISOString(),
              size: 1920000000,
              digest: 'f6g7h8i9j0',
              details: { parameter_size: '3.1B', family: 'qwen2' },
            },
          ],
        })
      );
      return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.model === 'non_existent_model') {
            res.writeHead(404);
            res.end(JSON.stringify({ error: "model 'non_existent_model' not found" }));
            return;
          }
          if (parsed.model === 'oom_model') {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'CUDA out of memory: requires 24GB VRAM' }));
            return;
          }

          res.writeHead(200);
          res.end(
            JSON.stringify({
              model: parsed.model,
              created_at: new Date().toISOString(),
              response: 'TCP is connection-oriented and reliable, while UDP is connectionless and low-latency.',
              done: true,
              total_duration: 850000000,
              eval_count: 18,
            })
          );
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'invalid json' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => mockServer.listen(11499, '127.0.0.1', resolve));

  try {
    // Test 2: Connected server model listing
    const conn = await checkConnection('http://127.0.0.1:11499');
    const passed2 =
      conn.connected === true &&
      conn.models.length === 2 &&
      conn.models[0].name === 'llama3.2:3b';
    recordResult(
      'Test 2: Model Listing via /api/tags',
      passed2,
      `Found ${conn.models.length} models: [${conn.models.map((m) => m.name).join(', ')}]`
    );

    // Test 3: Prompt Generation via /api/generate
    const gen = await generateCompletion({
      model: 'llama3.2:3b',
      prompt: 'Explain TCP vs UDP',
      customBaseUrl: 'http://127.0.0.1:11499',
    });
    const passed3 =
      gen.done === true &&
      gen.response.includes('TCP') &&
      gen.eval_count === 18;
    recordResult(
      'Test 3: Prompt Completion Generation',
      passed3,
      `Response: "${gen.response}" (Tokens: ${gen.eval_count})`
    );

    // Test 4: Missing Model 404 Error State
    let missingModelCaught = false;
    try {
      await generateCompletion({
        model: 'non_existent_model',
        prompt: 'test',
        customBaseUrl: 'http://127.0.0.1:11499',
      });
    } catch (err) {
      missingModelCaught = err.message.includes('404') || err.message.includes('not found');
    }
    recordResult(
      'Test 4: Missing Model Error Handling',
      missingModelCaught,
      'Caught 404 model not found error gracefully.'
    );

    // Test 5: Out of Memory (OOM) Error State
    let oomCaught = false;
    try {
      await generateCompletion({
        model: 'oom_model',
        prompt: 'test',
        customBaseUrl: 'http://127.0.0.1:11499',
      });
    } catch (err) {
      oomCaught = err.message.includes('out of memory');
    }
    recordResult(
      'Test 5: Out of Memory (OOM) Error Handling',
      oomCaught,
      'Caught simulated VRAM memory limit gracefully.'
    );

    // Test 6: Request Cancellation via AbortSignal
    const controller = new AbortController();
    controller.abort();
    let cancelled = false;
    try {
      await generateCompletion({
        model: 'llama3.2:3b',
        prompt: 'test',
        customBaseUrl: 'http://127.0.0.1:11499',
        abortSignal: controller.signal,
      });
    } catch (err) {
      cancelled = err.name === 'AbortError' || err.message.includes('aborted');
    }
    recordResult(
      'Test 6: Request Cancellation via AbortSignal',
      cancelled,
      'Prompt generation halted immediately upon abort signal.'
    );
  } finally {
    await new Promise((resolve) => mockServer.close(resolve));
  }

  console.log('\n================================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`SUMMARY: ${testResults.filter((t) => t.passed).length}/${testResults.length} tests passed.`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) process.exit(1);
}

runTests();
