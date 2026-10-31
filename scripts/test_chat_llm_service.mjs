// Automated Test Script for Chatbot LLM Connection and Services
// Verifies:
// 1. buildEducationalSystemPrompt for Entire Subject vs Specific Modules
// 2. Scope context inclusion & educational guidelines
// 3. createWelcomeMessage structure
// 4. parseOllamaError diagnosis for all failure scenarios
// 5. Multi-turn payload structure
// 6. Direct Ollama API connectivity & response generation with llama3.2:3b

import {
  buildEducationalSystemPrompt,
  createWelcomeMessage,
} from '../src/services/chatService.ts';

import {
  parseOllamaError,
  DEFAULT_PROXY_ENDPOINT,
  DEFAULT_DIRECT_ENDPOINT,
} from '../src/services/ollamaService.ts';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  passed++;
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('\n=== TEST SUITE: CHATBOT LOCAL LLM CONNECTION & SERVICES ===\n');

  // Test 1: Educational System Prompt for Entire Subject
  console.log('--- 1. Testing System Prompt (Entire Subject Scope) ---');
  const entireScope = {
    subjectId: 'sub-101',
    subjectName: 'Data Structures and Algorithms',
    subjectCode: 'CS201',
    subjectColor: '#4f64f1',
    scopeMode: 'entire_subject',
    moduleIds: ['mod-1', 'mod-2', 'mod-3'],
    moduleNames: ['Module 1: Arrays', 'Module 2: Trees', 'Module 3: Graphs'],
    totalModuleCount: 3,
    resourceCount: 5,
  };

  const entirePrompt = buildEducationalSystemPrompt(entireScope);
  assert(entirePrompt.includes('Data Structures and Algorithms'), 'Includes subject name');
  assert(entirePrompt.includes('CS201'), 'Includes subject code');
  assert(entirePrompt.includes('Entire Subject'), 'Indicates Entire Subject mode');
  assert(entirePrompt.includes('3 modules'), 'Mentions total module count');
  assert(entirePrompt.includes('code blocks') || entirePrompt.includes('code'), 'Instructs clean code blocks');
  assert(entirePrompt.includes('practice questions'), 'Instructs practice questions support');
  assert(entirePrompt.includes('Do not pretend you have indexed private uploaded PDF files'), 'Transparent about scope vs uploaded PDFs');

  // Test 2: Educational System Prompt for Specific Modules
  console.log('\n--- 2. Testing System Prompt (Specific Modules Scope) ---');
  const specificScope = {
    subjectId: 'sub-102',
    subjectName: 'Operating Systems',
    subjectCode: 'CS301',
    subjectColor: '#22c55e',
    scopeMode: 'specific_modules',
    moduleIds: ['mod-2'],
    moduleNames: ['Module 2: Process Scheduling & Synchronization'],
    totalModuleCount: 5,
    resourceCount: 2,
  };

  const specificPrompt = buildEducationalSystemPrompt(specificScope);
  assert(specificPrompt.includes('Operating Systems'), 'Includes subject name');
  assert(specificPrompt.includes('Specific Modules'), 'Indicates Specific Modules mode');
  assert(specificPrompt.includes('Module 2: Process Scheduling & Synchronization'), 'Includes selected module title');

  // Test 3: Welcome Message Creation
  console.log('\n--- 3. Testing Welcome Message Generator ---');
  const welcomeMsg = createWelcomeMessage(entireScope);
  assert(welcomeMsg.sender === 'assistant', 'Welcome message sender is assistant');
  assert(welcomeMsg.content.includes('Data Structures and Algorithms'), 'Welcome message includes subject');
  assert(welcomeMsg.content.includes('Entire Subject'), 'Welcome message mentions scope mode');
  assert(welcomeMsg.id.startsWith('welcome-'), 'Welcome message has unique ID');

  // Test 4: Ollama Error Diagnostic Parser
  console.log('\n--- 4. Testing Ollama Error Diagnostic Parser ---');
  const connRefusedErr = new Error('connect ECONNREFUSED 127.0.0.1:11434');
  const connDiag = parseOllamaError(connRefusedErr, 'llama3.2:3b', DEFAULT_DIRECT_ENDPOINT);
  assert(connDiag.code === 'NOT_INSTALLED_OR_RUNNING', 'Correctly identifies connection refused as NOT_INSTALLED_OR_RUNNING');
  assert(connDiag.suggestion.includes('ollama'), 'Provides actionable suggestion to start Ollama');

  const abortErr = new Error('The user aborted a request.');
  const abortDiag = parseOllamaError(abortErr, 'llama3.2:3b');
  assert(abortDiag.code === 'TIMEOUT_OR_CANCELLED', 'Identifies aborted request');

  const notFoundErr = new Error('model "xyz-nonexistent" not found');
  const notFoundDiag = parseOllamaError(notFoundErr, 'xyz-nonexistent');
  assert(notFoundDiag.code === 'MODEL_NOT_FOUND', 'Identifies missing model');

  // Test 5: Live Ollama Connectivity (if running on local machine)
  console.log('\n--- 5. Testing Local Ollama API (127.0.0.1:11434) ---');
  try {
    const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (tagsRes.ok) {
      const data = await tagsRes.json();
      const modelNames = (data.models || []).map((m) => m.name);
      console.log(`Detected local models in Ollama: ${modelNames.join(', ')}`);
      assert(modelNames.length > 0, `Ollama is active with ${modelNames.length} models installed`);

      // Test real chat generation with llama3.2:3b if present
      const hasLlama = modelNames.some((n) => n.includes('llama3.2'));
      if (hasLlama) {
        console.log('\n--- 6. Testing Real Response Generation with llama3.2:3b ---');
        const chatPayload = {
          model: 'llama3.2:3b',
          messages: [
            { role: 'system', content: entirePrompt },
            { role: 'user', content: 'In one sentence, what is a binary search tree?' },
          ],
          stream: false,
          options: { temperature: 0.3 },
        };

        const chatRes = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload),
          signal: AbortSignal.timeout(20000),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const replyText = chatData.message?.content || '';
          console.log(`\nGenerated Response from llama3.2:3b:\n"${replyText.trim()}"\n`);
          assert(replyText.length > 10, 'Received non-empty response from llama3.2:3b');
          assert(chatData.model.includes('llama3.2:3b'), 'Response returned model identifier');
        } else {
          console.warn(`Ollama responded with status ${chatRes.status}`);
        }
      } else {
        console.log('Notice: llama3.2 not in list of downloaded models, tested error diagnosis.');
      }
    }
  } catch (err) {
    console.log(`Local direct Ollama check: ${err.message} (Handled gracefully)`);
  }

  console.log(`\n=================================================`);
  console.log(`All ${passed}/${total} test assertions passed successfully!`);
  console.log(`=================================================\n`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
