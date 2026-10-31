// Test script for RAG Stage 1: Embedding Service with nomic-embed-text
// Run with: npx vite-node scripts/test_embedding_service.mjs

import {
  generateEmbedding,
  generateBatchEmbeddings,
  isEmbeddingModelAvailable,
  cosineSimilarity,
  DEFAULT_EMBEDDING_MODEL,
} from '../src/services/embeddingService.ts';

const OLLAMA_DIRECT_URL = 'http://127.0.0.1:11434';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 1: OLLAMA EMBEDDING SERVICE TEST (nomic-embed-text)');
console.log('=============================================================\n');

async function runEmbeddingTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- Step 1: Verify model installation ---
  console.log('--- 1. Checking Model Availability ---');
  const isAvailable = await isEmbeddingModelAvailable(DEFAULT_EMBEDDING_MODEL, OLLAMA_DIRECT_URL);
  assert(isAvailable, `Model "${DEFAULT_EMBEDDING_MODEL}" is installed and verified in Ollama`);

  // --- Step 2: Test Example 1 ---
  console.log('\n--- 2. Generating Embedding for Example 1 ---');
  const text1 = 'What is a computer network?';
  console.log(`Prompt: "${text1}"`);
  
  const result1 = await generateEmbedding(text1, {
    model: DEFAULT_EMBEDDING_MODEL,
    customBaseUrl: OLLAMA_DIRECT_URL,
  });

  assert(result1 !== null && typeof result1 === 'object', 'Example 1 request succeeded');
  assert(Array.isArray(result1.vector), 'Example 1 produced an array vector');
  assert(result1.vector.length > 0, `Example 1 vector is non-empty (dim = ${result1.vector.length})`);
  assert(
    result1.vector.every((val) => typeof val === 'number' && Number.isFinite(val)),
    'All elements in Example 1 vector are valid finite floating-point numbers'
  );
  assert(result1.dimensions === 768, `Example 1 dimensions match nomic-embed-text standard (768)`);
  assert(result1.model.includes('nomic-embed-text'), `Result model matches nomic-embed-text: ${result1.model}`);
  console.log(`Vector 1 Sample (first 5 dims): [${result1.vector.slice(0, 5).map(n => n.toFixed(6)).join(', ')}, ...]`);
  console.log(`Generation duration: ${result1.durationMs}ms`);

  // --- Step 3: Test Example 2 ---
  console.log('\n--- 3. Generating Embedding for Example 2 ---');
  const text2 = 'A computer network connects multiple devices.';
  console.log(`Prompt: "${text2}"`);

  const result2 = await generateEmbedding(text2, {
    model: DEFAULT_EMBEDDING_MODEL,
    customBaseUrl: OLLAMA_DIRECT_URL,
  });

  assert(result2 !== null && typeof result2 === 'object', 'Example 2 request succeeded');
  assert(Array.isArray(result2.vector), 'Example 2 produced an array vector');
  assert(result2.vector.length > 0, `Example 2 vector is non-empty (dim = ${result2.vector.length})`);
  assert(
    result2.vector.every((val) => typeof val === 'number' && Number.isFinite(val)),
    'All elements in Example 2 vector are valid finite floating-point numbers'
  );
  assert(result2.dimensions === 768, `Example 2 dimensions match nomic-embed-text standard (768)`);
  console.log(`Vector 2 Sample (first 5 dims): [${result2.vector.slice(0, 5).map(n => n.toFixed(6)).join(', ')}, ...]`);
  console.log(`Generation duration: ${result2.durationMs}ms`);

  // --- Step 4: Compare Vectors (Same Dimensions & Cosine Similarity) ---
  console.log('\n--- 4. Comparing Embeddings Dimensions & Semantic Similarity ---');
  assert(
    result1.dimensions === result2.dimensions,
    `Both vectors have identical dimensions (${result1.dimensions} == ${result2.dimensions})`
  );

  const similarity = cosineSimilarity(result1.vector, result2.vector);
  assert(
    typeof similarity === 'number' && !isNaN(similarity),
    `Computed valid cosine similarity: ${similarity.toFixed(4)}`
  );
  assert(
    similarity > 0.5,
    `High semantic similarity between related computer network sentences (${similarity.toFixed(4)} > 0.50)`
  );
  console.log(`Semantic Cosine Similarity: ${(similarity * 100).toFixed(2)}%`);

  // --- Step 5: Test Batch Embedding Generation ---
  console.log('\n--- 5. Testing Batch Embeddings Endpoint ---');
  const batchResult = await generateBatchEmbeddings([text1, text2], {
    model: DEFAULT_EMBEDDING_MODEL,
    customBaseUrl: OLLAMA_DIRECT_URL,
  });

  assert(batchResult.count === 2, `Batch result returned 2 vectors for 2 inputs`);
  assert(batchResult.vectors.length === 2, `Vectors array length is 2`);
  assert(
    batchResult.vectors[0].length === 768 && batchResult.vectors[1].length === 768,
    `Both batch vectors have 768 dimensions`
  );

  // --- Step 6: Test Error Handling ---
  console.log('\n--- 6. Testing Error Handling & Input Validation ---');

  // Test 6.1: Empty text validation
  try {
    await generateEmbedding('   ', { customBaseUrl: OLLAMA_DIRECT_URL });
    assert(false, 'Should have thrown error on empty text');
  } catch (err) {
    assert(
      err.message.includes('non-empty text'),
      `Correctly rejected empty text: "${err.message}"`
    );
  }

  // Test 6.2: Missing model diagnostic
  try {
    await generateEmbedding('Test sentence', {
      model: 'non-existent-embedding-model-xyz',
      customBaseUrl: OLLAMA_DIRECT_URL,
    });
    assert(false, 'Should have thrown error on non-existent model');
  } catch (err) {
    assert(
      err.message.includes('not installed') || err.message.includes('404') || err.info?.code === 'MODEL_NOT_FOUND',
      `Correctly diagnosed missing model error: "${err.message}"`
    );
  }

  // Test 6.3: Unreachable endpoint diagnostic
  try {
    await generateEmbedding('Test sentence', {
      customBaseUrl: 'http://127.0.0.1:59999',
    });
    assert(false, 'Should have thrown error on unreachable port');
  } catch (err) {
    assert(
      err.info?.code === 'NOT_INSTALLED_OR_RUNNING' || err.message.includes('not running') || err.message.includes('ECONNREFUSED'),
      `Correctly diagnosed offline Ollama error: "${err.message}"`
    );
  }

  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 STAGE 1 VERIFICATION COMPLETE: ALL EMBEDDING TESTS PASSED!');
  }
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmbeddingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
