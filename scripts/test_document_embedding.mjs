// Test Suite for RAG Stage 3: Document Embedding Pipeline
// Run with: npx vite-node scripts/test_document_embedding.mjs

import { chunkDocument } from '../src/services/chunkingService.ts';
import {
  embedChunks,
  embedSingleChunk,
  embedMultipleDocuments,
  validateEmbeddedChunks,
  DEFAULT_DOCUMENT_EMBEDDING_BATCH_SIZE,
} from '../src/services/documentEmbeddingService.ts';
import { NOMIC_EMBED_DIMENSIONS } from '../src/types/embedding.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 3: DOCUMENT EMBEDDING GENERATION TEST SUITE');
console.log('=============================================================\n');

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

async function runTestSuite() {
  // =================================================================
  // 1. GENERATE AN EMBEDDING FOR ONE CHUNK
  // =================================================================
  console.log('--- 1. Testing Single Chunk Embedding ---');
  const singleChunk = {
    chunkId: 'res_net_chunk_0',
    chunkIndex: 0,
    text: 'A computer network is a system of interconnected computing devices that can exchange data and share resources.',
    subjectId: 'cs-101',
    moduleId: 'mod-1',
    resourceId: 'res_net',
    resourceName: 'ComputerNetworks.pdf',
    pageNumber: 1,
    totalChunks: 1,
    tokenCount: 22,
    characterCount: 110,
    metadata: {
      chunkId: 'res_net_chunk_0',
      chunkIndex: 0,
      totalChunks: 1,
      subjectId: 'cs-101',
      moduleId: 'mod-1',
      resourceId: 'res_net',
      resourceName: 'ComputerNetworks.pdf',
      pageNumber: 1,
      tokenCount: 22,
      characterCount: 110,
      extractionMethod: 'text',
    },
  };

  const embeddedSingle = await embedSingleChunk(singleChunk);
  assert(embeddedSingle.chunkId === 'res_net_chunk_0', 'Single chunk ID preserved');
  assert(Array.isArray(embeddedSingle.embedding), 'Embedding vector is an array');
  assert(embeddedSingle.embedding.length === NOMIC_EMBED_DIMENSIONS, `Embedding has exactly ${NOMIC_EMBED_DIMENSIONS} dimensions (got ${embeddedSingle.embedding.length})`);
  assert(embeddedSingle.dimensions === 768, 'dimensions property is 768');
  assert(typeof embeddedSingle.model === 'string' && embeddedSingle.model.includes('nomic-embed-text'), `model is recorded as "${embeddedSingle.model}"`);
  console.log(`Sample vector (first 5 dims): [${embeddedSingle.embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}, ...]`);

  // =================================================================
  // 2. GENERATE EMBEDDINGS FOR MULTIPLE CHUNKS
  // =================================================================
  console.log('\n--- 2. Testing Multiple Chunks Embedding ---');
  const sampleChunks = [
    {
      chunkId: 'res_os_chunk_0',
      chunkIndex: 0,
      text: 'Process management: The operating system allocates processor time and manages execution threads.',
      subjectId: 'cs-os-201',
      moduleId: 'mod-os-proc',
      resourceId: 'res_os',
      resourceName: 'OperatingSystems.pdf',
      pageNumber: 10,
      totalChunks: 4,
      tokenCount: 20,
      characterCount: 96,
      metadata: {
        chunkId: 'res_os_chunk_0',
        chunkIndex: 0,
        totalChunks: 4,
        subjectId: 'cs-os-201',
        moduleId: 'mod-os-proc',
        resourceId: 'res_os',
        resourceName: 'OperatingSystems.pdf',
        pageNumber: 10,
        tokenCount: 20,
        characterCount: 96,
      },
    },
    {
      chunkId: 'res_os_chunk_1',
      chunkIndex: 1,
      text: 'CPU scheduling algorithms include First-Come-First-Served, Shortest Job First, and Round Robin.',
      subjectId: 'cs-os-201',
      moduleId: 'mod-os-proc',
      resourceId: 'res_os',
      resourceName: 'OperatingSystems.pdf',
      pageNumber: 11,
      totalChunks: 4,
      tokenCount: 24,
      characterCount: 96,
      metadata: {
        chunkId: 'res_os_chunk_1',
        chunkIndex: 1,
        totalChunks: 4,
        subjectId: 'cs-os-201',
        moduleId: 'mod-os-proc',
        resourceId: 'res_os',
        resourceName: 'OperatingSystems.pdf',
        pageNumber: 11,
        tokenCount: 24,
        characterCount: 96,
      },
    },
    {
      chunkId: 'res_os_chunk_2',
      chunkIndex: 2,
      text: 'Virtual memory separates user logical address space from physical memory using page tables and TLBs.',
      subjectId: 'cs-os-201',
      moduleId: 'mod-os-proc',
      resourceId: 'res_os',
      resourceName: 'OperatingSystems.pdf',
      pageNumber: 12,
      totalChunks: 4,
      tokenCount: 22,
      characterCount: 101,
      metadata: {
        chunkId: 'res_os_chunk_2',
        chunkIndex: 2,
        totalChunks: 4,
        subjectId: 'cs-os-201',
        moduleId: 'mod-os-proc',
        resourceId: 'res_os',
        resourceName: 'OperatingSystems.pdf',
        pageNumber: 12,
        tokenCount: 22,
        characterCount: 101,
      },
    },
    {
      chunkId: 'res_os_chunk_3',
      chunkIndex: 3,
      text: 'Deadlock characterization requires four conditions: mutual exclusion, hold and wait, no preemption, circular wait.',
      subjectId: 'cs-os-201',
      moduleId: 'mod-os-proc',
      resourceId: 'res_os',
      resourceName: 'OperatingSystems.pdf',
      pageNumber: 13,
      totalChunks: 4,
      tokenCount: 25,
      characterCount: 115,
      metadata: {
        chunkId: 'res_os_chunk_3',
        chunkIndex: 3,
        totalChunks: 4,
        subjectId: 'cs-os-201',
        moduleId: 'mod-os-proc',
        resourceId: 'res_os',
        resourceName: 'OperatingSystems.pdf',
        pageNumber: 13,
        tokenCount: 25,
        characterCount: 115,
      },
    },
  ];

  const multiResult = await embedChunks(sampleChunks);
  assert(multiResult.totalChunks === 4, `Total chunks is 4 (got ${multiResult.totalChunks})`);
  assert(multiResult.successfulChunks === 4, `All 4 chunks successfully embedded`);
  assert(multiResult.failedChunks === 0, 'No failed chunks');
  assert(multiResult.embeddedChunks.length === 4, 'Returned 4 embedded chunks');

  // =================================================================
  // 3. VERIFY 768 DIMENSIONS
  // =================================================================
  console.log('\n--- 3. Verifying 768 Vector Dimensions & Finite Numbers ---');
  let allDimensionsMatch = true;
  let allNumbersFinite = true;

  for (let i = 0; i < multiResult.embeddedChunks.length; i++) {
    const ec = multiResult.embeddedChunks[i];
    if (ec.dimensions !== 768 || ec.embedding.length !== 768) {
      allDimensionsMatch = false;
    }
    for (const val of ec.embedding) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        allNumbersFinite = false;
        break;
      }
    }
  }

  assert(allDimensionsMatch, 'Every embedded chunk has exactly 768 dimensions');
  assert(allNumbersFinite, 'Every vector element is a valid finite floating-point number');

  // =================================================================
  // 4. VERIFY METADATA PRESERVATION
  // =================================================================
  console.log('\n--- 4. Verifying Metadata Preservation ---');
  const chunk0 = multiResult.embeddedChunks[0];
  assert(chunk0.chunkId === 'res_os_chunk_0', 'chunkId preserved');
  assert(chunk0.subjectId === 'cs-os-201', 'subjectId preserved');
  assert(chunk0.moduleId === 'mod-os-proc', 'moduleId preserved');
  assert(chunk0.resourceId === 'res_os', 'resourceId preserved');
  assert(chunk0.resourceName === 'OperatingSystems.pdf', 'resourceName preserved');
  assert(chunk0.pageNumber === 10, 'pageNumber preserved (10)');
  assert(chunk0.totalChunks === 4, 'totalChunks preserved (4)');
  assert(chunk0.metadata.subjectId === 'cs-os-201', 'metadata.subjectId intact');
  assert(chunk0.metadata.pageNumber === 10, 'metadata.pageNumber intact');

  // =================================================================
  // 5. VERIFY CHUNK ORDERING
  // =================================================================
  console.log('\n--- 5. Verifying Strict Sequential Chunk Ordering ---');
  let orderCorrect = true;
  for (let i = 0; i < multiResult.embeddedChunks.length; i++) {
    const ec = multiResult.embeddedChunks[i];
    if (ec.chunkIndex !== i || ec.chunkId !== sampleChunks[i].chunkId) {
      orderCorrect = false;
    }
  }
  assert(orderCorrect, 'All chunks maintained strict sequential order (0 to 3)');

  // =================================================================
  // 6. VERIFY BATCH PROCESSING
  // =================================================================
  console.log('\n--- 6. Verifying Configurable Batch Processing ---');
  // Pass 4 chunks with batchSize: 2 -> Expected: ceil(4/2) = 2 batches
  let progressUpdates = 0;
  const batchedResult = await embedChunks(sampleChunks, {
    batchSize: 2,
    onProgress: (p) => {
      progressUpdates++;
    },
  });

  assert(batchedResult.batchCount === 2, `Dispatched 4 chunks in 2 batches (batchCount = ${batchedResult.batchCount})`);
  assert(batchedResult.embeddedChunks.length === 4, 'All 4 chunks returned from batched execution');
  assert(progressUpdates === 2, `Progress callback triggered for each batch (${progressUpdates} updates)`);

  // =================================================================
  // 7. VERIFY EMPTY INPUT HANDLING
  // =================================================================
  console.log('\n--- 7. Verifying Empty Input Handling ---');
  const emptyRes = await embedChunks([]);
  assert(emptyRes.totalChunks === 0, 'Empty chunk array returns 0 total chunks');
  assert(emptyRes.successfulChunks === 0, 'Empty chunk array returns 0 successful chunks');
  assert(emptyRes.embeddedChunks.length === 0, 'Empty chunk array returns empty embeddedChunks array');
  assert(emptyRes.batchCount === 0, 'Batch count is 0 for empty array');

  // =================================================================
  // 8. VERIFY INVALID VECTOR VALIDATION
  // =================================================================
  console.log('\n--- 8. Verifying Embedded Chunk Validation Utility ---');
  // Test valid chunks validation
  const validCheck = validateEmbeddedChunks(multiResult.embeddedChunks);
  assert(validCheck.isValid && validCheck.errors.length === 0, 'Generated chunks pass validation cleanly');

  // Test vector with wrong dimension
  const badDimChunk = [{
    ...multiResult.embeddedChunks[0],
    embedding: [0.1, 0.2, 0.3], // only 3 dimensions instead of 768
    dimensions: 3,
  }];
  const badDimCheck = validateEmbeddedChunks(badDimChunk);
  assert(!badDimCheck.isValid, 'Validator catches vector with wrong dimension count (3 vs 768)');

  // Test vector with NaN/Infinity
  const badNumChunk = [{
    ...multiResult.embeddedChunks[0],
    embedding: new Array(768).fill(NaN),
  }];
  const badNumCheck = validateEmbeddedChunks(badNumChunk);
  assert(!badNumCheck.isValid, 'Validator catches vector containing NaN values');

  // Test chunk with missing text
  const badTextChunk = [{
    ...multiResult.embeddedChunks[0],
    text: '',
  }];
  const badTextCheck = validateEmbeddedChunks(badTextChunk);
  assert(!badTextCheck.isValid, 'Validator catches chunk with missing/empty text');

  // =================================================================
  // 9. VERIFY OLLAMA UNAVAILABLE HANDLING
  // =================================================================
  console.log('\n--- 9. Verifying Ollama Unavailable Error Handling ---');
  let caughtOfflineError = false;
  try {
    // Attempt connecting to unreachable port 59999
    await embedChunks([sampleChunks[0]], {
      customBaseUrl: 'http://127.0.0.1:59999',
      stopOnError: true,
    });
  } catch (err) {
    caughtOfflineError = true;
    assert(
      err.message.toLowerCase().includes('ollama is not running') ||
      err.message.toLowerCase().includes('fetch failed') ||
      err.message.toLowerCase().includes('econnrefused') ||
      err.message.toLowerCase().includes('document embedding failed'),
      `Offline Ollama properly diagnosed: "${err.message.slice(0, 100)}..."`
    );
  }
  assert(caughtOfflineError, 'Caught error when Ollama endpoint is unreachable');

  // =================================================================
  // 10. VERIFY FAILED BATCH HANDLING (stopOnError: false vs true)
  // =================================================================
  console.log('\n--- 10. Verifying Partial Batch Failure Handling ---');
  // With stopOnError: false, error is recorded rather than thrown
  const nonExistentModelRes = await embedChunks([sampleChunks[0]], {
    model: 'non-existent-embedding-model-xyz-123',
    stopOnError: false,
  });

  assert(nonExistentModelRes.failedChunks === 1, `Failed chunk recorded: ${nonExistentModelRes.failedChunks}`);
  assert(nonExistentModelRes.successfulChunks === 0, '0 successful chunks recorded');
  assert(Array.isArray(nonExistentModelRes.errors) && nonExistentModelRes.errors.length === 1, 'Errors array populated with failed chunk details');
  assert(nonExistentModelRes.errors[0].chunkId === 'res_os_chunk_0', 'Error record links correct chunkId');

  // With stopOnError: true, throws immediately
  let threwStrictError = false;
  try {
    await embedChunks([sampleChunks[0]], {
      model: 'non-existent-embedding-model-xyz-123',
      stopOnError: true,
    });
  } catch (err) {
    threwStrictError = true;
    assert(err.message.includes('Document embedding failed'), `Descriptive transactional error thrown: "${err.message.slice(0, 100)}..."`);
  }
  assert(threwStrictError, 'stopOnError: true correctly halts and throws descriptive error');

  // =================================================================
  // 11. END-TO-END INTEGRATION: STAGE 2 CHUNKER -> STAGE 3 EMBEDDING
  // =================================================================
  console.log('\n--- 11. Testing End-to-End Pipeline: Stage 2 -> Stage 3 ---');
  const rawDocument = {
    text: `
# Database Transaction Management

A transaction in a database system is a sequence of read and write operations treated as a single logical unit of work.

## ACID Properties

Atomicity guarantees that all operations within a transaction complete successfully, or all are rolled back.
Consistency ensures the database transitions from one valid state to another valid state adhering to constraints.
Isolation prevents concurrent transactions from interfering with each other's intermediate state.
Durability guarantees that once a transaction commits, its changes survive system crashes and power failures.
`.trim(),
    subjectId: 'cs-dbms-301',
    moduleId: 'mod-acid',
    resourceId: 'res-dbms-acid',
    resourceName: 'Transactions.pdf',
    pageNumber: 5,
  };

  // Step A: Stage 2 Chunking
  const chunkingResult = chunkDocument(rawDocument, {
    chunkSizeTokens: 80,
    chunkOverlapTokens: 20,
  });
  assert(chunkingResult.totalChunks >= 2, `Stage 2 produced ${chunkingResult.totalChunks} chunks`);

  // Step B: Stage 3 Embedding (accepting ChunkingResult directly)
  const e2eEmbeddedResult = await embedChunks(chunkingResult, { batchSize: 2 });
  assert(e2eEmbeddedResult.totalChunks === chunkingResult.totalChunks, 'Embedded chunk count matches chunked count');
  assert(e2eEmbeddedResult.successfulChunks === chunkingResult.totalChunks, 'All chunks successfully embedded');
  assert(e2eEmbeddedResult.embeddedChunks.every(c => c.embedding.length === 768), 'All pipeline chunks have 768 dimensions');
  assert(e2eEmbeddedResult.embeddedChunks[0].subjectId === 'cs-dbms-301', 'Pipeline preserves subjectId ("cs-dbms-301")');
  assert(e2eEmbeddedResult.embeddedChunks[0].pageNumber === 5, 'Pipeline preserves pageNumber (5)');

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 STAGE 3 VERIFICATION COMPLETE: ALL EMBEDDING TESTS PASSED!');
  }
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
