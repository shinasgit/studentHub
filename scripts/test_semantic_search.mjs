// Test Suite for RAG Stage 6: Semantic Search & Retrieval
// Run with: npx vite-node scripts/test_semantic_search.mjs

import {
  searchSimilarChunks,
  searchBySubject,
  searchByModule,
  searchByResource,
  searchAcrossStudentDocuments,
  validateQueryEmbeddingVector,
  validateSearchFilters,
} from '../src/services/semanticSearchService.ts';
import {
  getOrCreateCollection,
  addEmbeddedChunks,
  deleteCollection,
  getCollectionStats,
} from '../src/services/chromaService.ts';
import { generateEmbedding } from '../src/services/embeddingService.ts';
import { NOMIC_EMBED_DIMENSIONS } from '../src/types/embedding.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 6: SEMANTIC SEARCH & RETRIEVAL TEST SUITE');
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
  const testCollection = `test_search_${Date.now()}`;
  const studentAlice = 'student_alice_uid_101';
  const studentBob = 'student_bob_uid_202';

  console.log(`Setting up isolated test collection: "${testCollection}"...`);
  await getOrCreateCollection(testCollection);

  // -----------------------------------------------------------------
  // PREPARATION: Populate realistic test knowledge chunks
  // -----------------------------------------------------------------
  console.log('Generating embeddings and indexing test chunks via Ollama nomic-embed-text...');

  const aliceChunks = [
    {
      chunkId: 'res-tcp-udp-001_chunk_0',
      chunkIndex: 0,
      totalChunks: 2,
      pageNumber: 14,
      tokenCount: 45,
      characterCount: 220,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-tcp-udp-001',
      resourceName: 'ComputerNetworks_Transport.pdf',
      studentId: studentAlice,
      text: 'Transmission Control Protocol (TCP) provides reliable, connection-oriented data transfer with sequence numbers, acknowledgments, and flow control. In contrast, User Datagram Protocol (UDP) is connectionless and lightweight without retransmission guarantees.',
    },
    {
      chunkId: 'res-tcp-udp-001_chunk_1',
      chunkIndex: 1,
      totalChunks: 2,
      pageNumber: 15,
      tokenCount: 38,
      characterCount: 190,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-tcp-udp-001',
      resourceName: 'ComputerNetworks_Transport.pdf',
      studentId: studentAlice,
      text: 'TCP utilizes a three-way handshake (SYN, SYN-ACK, ACK) to establish a virtual connection before transmitting payload data, making it ideal for HTTP and file transfer.',
    },
    {
      chunkId: 'res-routing-002_chunk_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 8,
      tokenCount: 35,
      characterCount: 175,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-network-layer',
      resourceId: 'res-routing-002',
      resourceName: 'RoutingProtocols.pdf',
      studentId: studentAlice,
      text: 'Routing Information Protocol (RIP) utilizes the Bellman-Ford algorithm with hop counts as metric, capped at a maximum of 15 hops to prevent routing loops.',
    },
    {
      chunkId: 'res-acid-003_chunk_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 22,
      tokenCount: 36,
      characterCount: 180,
      subjectId: 'cs-dbms-202',
      moduleId: 'mod-transactions',
      resourceId: 'res-acid-003',
      resourceName: 'DatabaseTransactions.pdf',
      studentId: studentAlice,
      text: 'ACID properties ensure database transaction reliability: Atomicity, Consistency, Isolation, and Durability. Two-Phase Locking (2PL) guarantees serializability.',
    },
  ];

  const bobChunks = [
    {
      chunkId: 'res-bob-transport-999_chunk_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 3,
      tokenCount: 32,
      characterCount: 160,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-bob-transport-999',
      resourceName: 'BobNetworksNotes.pdf',
      studentId: studentBob,
      text: 'TCP connection establishment requires three-way handshaking. Bob private study notes for Computer Networks transport layer.',
    },
  ];

  const allRawChunks = [...aliceChunks, ...bobChunks];
  const embeddedChunks = [];

  for (const c of allRawChunks) {
    const embedRes = await generateEmbedding(c.text);
    embeddedChunks.push({
      ...c,
      embedding: embedRes.vector,
      metadata: {
        chunkId: c.chunkId,
        chunkIndex: c.chunkIndex,
        totalChunks: c.totalChunks,
        pageNumber: c.pageNumber,
        tokenCount: c.tokenCount,
        characterCount: c.characterCount,
        subjectId: c.subjectId,
        moduleId: c.moduleId,
        resourceId: c.resourceId,
        resourceName: c.resourceName,
        studentId: c.studentId,
      },
    });
  }

  await addEmbeddedChunks(embeddedChunks, { collectionName: testCollection });
  const stats = await getCollectionStats(testCollection);
  console.log(`Indexed ${stats.totalVectors} chunks into "${testCollection}".\n`);

  // =================================================================
  // 1. SUCCESSFUL SEMANTIC SEARCH & 2. QUERY EMBEDDING GENERATION
  // =================================================================
  console.log('--- 1 & 2. Testing Semantic Search & Query Embedding Generation ---');
  const tcpQuery = 'What is the difference between TCP and UDP?';
  const tcpSearchRes = await searchSimilarChunks(tcpQuery, {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
  });

  assert(tcpSearchRes.status === 'success', `Semantic search returned status: 'success' (got ${tcpSearchRes.status})`);
  assert(tcpSearchRes.totalResults > 0, `Retrieved ${tcpSearchRes.totalResults} matching chunks`);
  assert(tcpSearchRes.query === tcpQuery, `Response preserves original query: "${tcpSearchRes.query}"`);
  assert(typeof tcpSearchRes.durationMs === 'number' && tcpSearchRes.durationMs > 0, `Recorded search duration (${tcpSearchRes.durationMs}ms)`);

  // =================================================================
  // 3. 768-DIMENSIONAL EMBEDDING VALIDATION
  // =================================================================
  console.log('\n--- 3. Verifying 768-Dimensional Embedding Vector Validation ---');
  const rawQueryEmbed = await generateEmbedding(tcpQuery);
  const validatedVec = validateQueryEmbeddingVector(rawQueryEmbed.vector);
  assert(validatedVec.length === NOMIC_EMBED_DIMENSIONS, `Query embedding has exactly 768 dimensions (got ${validatedVec.length})`);
  assert(validatedVec.every(v => typeof v === 'number' && Number.isFinite(v)), 'Query embedding consists purely of valid finite numbers');

  // =================================================================
  // 4. RETRIEVAL OF RELEVANT DOCUMENT CHUNKS & SIMILARITY SORTING
  // =================================================================
  console.log('\n--- 4. Verifying Most Relevant Chunk Retrieval & Ordering ---');
  const topResult = tcpSearchRes.results[0];
  assert(topResult.chunkId === 'res-tcp-udp-001_chunk_0', `Most relevant chunk is chunk 0 of TCP/UDP document (got ${topResult.chunkId})`);
  assert(topResult.text.includes('Transmission Control Protocol (TCP) provides reliable'), 'Top result contains verbatim TCP/UDP text');
  assert(topResult.similarity > 0.5, `Top result has high semantic similarity (${(topResult.similarity * 100).toFixed(2)}% > 50%)`);
  assert(topResult.distance < 0.5, `Top result has low cosine distance (${topResult.distance.toFixed(4)} < 0.5)`);
  assert(
    tcpSearchRes.results.every((r, i) => i === 0 || r.similarity <= tcpSearchRes.results[i - 1].similarity),
    'Results are strictly sorted in descending order of similarity score'
  );

  // =================================================================
  // 5. CORRECT RESOURCE METADATA & 6. PAGE NUMBER PRESERVATION
  // =================================================================
  console.log('\n--- 5 & 6. Verifying Metadata Attributes & Page Number Preservation ---');
  assert(topResult.resourceId === 'res-tcp-udp-001', `resourceId matches: "res-tcp-udp-001"`);
  assert(topResult.resourceName === 'ComputerNetworks_Transport.pdf', `resourceName matches: "ComputerNetworks_Transport.pdf"`);
  assert(topResult.subjectId === 'cs-networks-301', `subjectId matches: "cs-networks-301"`);
  assert(topResult.moduleId === 'mod-transport', `moduleId matches: "mod-transport"`);
  assert(topResult.pageNumber === 14, `Preserved exact page number: 14 (got ${topResult.pageNumber})`);
  assert(topResult.chunkIndex === 0, `Preserved chunkIndex: 0 (got ${topResult.chunkIndex})`);

  // =================================================================
  // 7. TOP-K RESULT CONFIGURATION
  // =================================================================
  console.log('\n--- 7. Verifying Configurable Top-K Results ---');
  const topK1Res = await searchSimilarChunks(tcpQuery, {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    topK: 1,
  });
  assert(topK1Res.results.length === 1, `topK: 1 returned exactly 1 result (got ${topK1Res.results.length})`);

  const topK2Res = await searchSimilarChunks(tcpQuery, {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    topK: 2,
  });
  assert(topK2Res.results.length === 2, `topK: 2 returned exactly 2 results (got ${topK2Res.results.length})`);

  // =================================================================
  // 8. SEARCH RESTRICTED TO A SUBJECT
  // =================================================================
  console.log('\n--- 8. Testing Search Restricted to a Subject (searchBySubject) ---');
  const dbmsSearch = await searchBySubject('transaction consistency guarantees', 'cs-dbms-202', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
  });
  assert(dbmsSearch.status === 'success', 'searchBySubject returned status: success');
  assert(dbmsSearch.results.length > 0, `Retrieved ${dbmsSearch.results.length} result(s)`);
  assert(dbmsSearch.results.every(r => r.subjectId === 'cs-dbms-202'), 'All retrieved chunks strictly belong to "cs-dbms-202"');
  assert(dbmsSearch.results[0].text.includes('ACID properties'), 'Retrieved ACID transaction chunk');

  // =================================================================
  // 9. SEARCH RESTRICTED TO A MODULE
  // =================================================================
  console.log('\n--- 9. Testing Search Restricted to a Module (searchByModule) ---');
  const moduleSearch = await searchByModule('network protocol algorithms', 'cs-networks-301', 'mod-network-layer', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
  });
  assert(moduleSearch.status === 'success', 'searchByModule returned status: success');
  assert(moduleSearch.results.length === 1, `searchByModule returned exactly 1 matching chunk (got ${moduleSearch.results.length})`);
  assert(moduleSearch.results[0].moduleId === 'mod-network-layer', 'Result is strictly from "mod-network-layer"');
  assert(moduleSearch.results[0].text.includes('Routing Information Protocol'), 'Retrieved Bellman-Ford routing chunk');

  // =================================================================
  // 10. SEARCH RESTRICTED TO A RESOURCE
  // =================================================================
  console.log('\n--- 10. Testing Search Restricted to a Resource (searchByResource) ---');
  const resourceSearch = await searchByResource('handshake establishment', 'res-tcp-udp-001', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
  });
  assert(resourceSearch.status === 'success', 'searchByResource returned status: success');
  assert(resourceSearch.results.every(r => r.resourceId === 'res-tcp-udp-001'), 'All results belong strictly to "res-tcp-udp-001"');

  // =================================================================
  // 11. SEARCH RESTRICTED TO AUTHENTICATED STUDENT (MULTI-TENANT ISOLATION)
  // =================================================================
  console.log('\n--- 11. Verifying Student-Level Isolation (Alice vs Bob) ---');
  // Alice searches for TCP - MUST NOT see Bob's chunks
  const aliceOnlySearch = await searchSimilarChunks('TCP connection three-way handshake', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    topK: 10,
  });
  assert(
    aliceOnlySearch.results.every(r => r.metadata.studentId === studentAlice),
    'Alice search returned ONLY Alice chunks'
  );
  assert(
    !aliceOnlySearch.results.some(r => r.chunkId.includes('bob')),
    "Alice search NEVER returned Bob's private notes"
  );

  // Bob searches for TCP - MUST NOT see Alice's chunks
  const bobOnlySearch = await searchSimilarChunks('TCP connection three-way handshake', {
    collectionName: testCollection,
    filters: { studentId: studentBob },
    topK: 10,
  });
  assert(
    bobOnlySearch.results.every(r => r.metadata.studentId === studentBob),
    'Bob search returned ONLY Bob chunks'
  );
  assert(
    bobOnlySearch.results.some(r => r.chunkId === 'res-bob-transport-999_chunk_0'),
    "Bob search successfully retrieved Bob's own chunk"
  );

  // =================================================================
  // 12. EMPTY QUERY HANDLING
  // =================================================================
  console.log('\n--- 12. Testing Empty and Whitespace Query Handling ---');
  const emptyStrRes = await searchSimilarChunks('', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
  });
  assert(emptyStrRes.status === 'empty', 'Empty string query returns status: "empty"');
  assert(emptyStrRes.totalResults === 0, 'Empty string query returns 0 results');
  assert(emptyStrRes.error.includes('non-empty'), 'Empty query returns helpful guidance message');

  const whitespaceRes = await searchSimilarChunks('     \n\t   ', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
  });
  assert(whitespaceRes.status === 'empty', 'Whitespace query returns status: "empty"');
  assert(whitespaceRes.totalResults === 0, 'Whitespace query returns 0 results');

  // =================================================================
  // 13. NO MATCHING RESULTS HANDLING
  // =================================================================
  console.log('\n--- 13. Testing No Matching Results Graceful Handling ---');
  const noMatchRes = await searchSimilarChunks('Quantum physics entanglement', {
    collectionName: testCollection,
    filters: {
      studentId: studentAlice,
      subjectId: 'non-existent-subject-xyz',
    },
  });
  assert(noMatchRes.status === 'empty', 'No matching results returns status: "empty" without error');
  assert(noMatchRes.totalResults === 0, 'No matching results returns 0 totalResults');
  assert(Array.isArray(noMatchRes.results) && noMatchRes.results.length === 0, 'results is an empty array');

  // =================================================================
  // 14. OLLAMA UNAVAILABLE HANDLING
  // =================================================================
  console.log('\n--- 14. Testing Ollama Unavailable Error Handling ---');
  const offlineOllamaRes = await searchSimilarChunks('Test offline ollama query', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    customOllamaUrl: 'http://127.0.0.1:54321', // Unreachable port
  });
  assert(offlineOllamaRes.status === 'failed', 'Offline Ollama returns status: "failed"');
  assert(
    offlineOllamaRes.error && (offlineOllamaRes.error.includes('Ollama is not running') || offlineOllamaRes.error.includes('failed')),
    `Informative error message returned: "${offlineOllamaRes.error}"`
  );

  // =================================================================
  // 15. CHROMADB UNAVAILABLE HANDLING
  // =================================================================
  console.log('\n--- 15. Testing ChromaDB Unavailable Error Handling ---');
  const offlineChromaRes = await searchSimilarChunks('Test offline chroma query', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    customChromaUrl: 'http://127.0.0.1:54322', // Unreachable port
  });
  assert(offlineChromaRes.status === 'failed', 'Offline ChromaDB returns status: "failed"');
  assert(
    offlineChromaRes.error && (offlineChromaRes.error.includes('ChromaDB is not running') || offlineChromaRes.error.includes('failed')),
    `Informative error message returned: "${offlineChromaRes.error}"`
  );

  // =================================================================
  // 16. UNAUTHENTICATED SEARCH
  // =================================================================
  console.log('\n--- 16. Testing Unauthenticated Search Handling ---');
  const unauthRes = await searchSimilarChunks('What is TCP?', {
    collectionName: testCollection,
    filters: { studentId: '' }, // Empty student ID simulating logged-out user
  });
  assert(unauthRes.status === 'failed', 'Unauthenticated search returns status: "failed"');
  assert(
    unauthRes.error.includes('Authentication required'),
    `Authentication error returned: "${unauthRes.error}"`
  );

  // =================================================================
  // 17. INVALID EMBEDDING DIMENSIONS VALIDATION
  // =================================================================
  console.log('\n--- 17. Testing Invalid Embedding Dimensions Validation ---');
  let dimErrorCaught = false;
  try {
    validateQueryEmbeddingVector([0.1, 0.2, 0.3]); // 3 dimensions instead of 768
  } catch (err) {
    dimErrorCaught = true;
    assert(err.message.includes('768 dimensions'), `Correctly rejected invalid dimension count: "${err.message}"`);
  }
  assert(dimErrorCaught, 'Dimension mismatch error was properly thrown');

  let nanErrorCaught = false;
  try {
    const nanVector = new Array(768).fill(0.1);
    nanVector[42] = NaN;
    validateQueryEmbeddingVector(nanVector);
  } catch (err) {
    nanErrorCaught = true;
    assert(err.message.includes('not a valid finite number'), `Correctly rejected NaN vector element: "${err.message}"`);
  }
  assert(nanErrorCaught, 'NaN validation error was properly thrown');

  // =================================================================
  // 18. INVALID METADATA FILTER HANDLING
  // =================================================================
  console.log('\n--- 18. Testing Invalid Metadata Filter Handling ---');
  const invalidFilterRes = await searchSimilarChunks('TCP protocols', {
    collectionName: testCollection,
    filters: {
      studentId: studentAlice,
      subjectId: 12345, // Invalid type: number instead of string
    },
  });
  assert(invalidFilterRes.status === 'failed', 'Invalid metadata filter returns status: "failed"');
  assert(invalidFilterRes.error.includes('subjectId'), `Descriptive filter validation error: "${invalidFilterRes.error}"`);

  let malformedFiltersError = false;
  try {
    validateSearchFilters('not an object');
  } catch (err) {
    malformedFiltersError = true;
    assert(err.message.includes('Expected an object'), `Malformed filter object detected: "${err.message}"`);
  }
  assert(malformedFiltersError, 'Malformed filter validation error was properly thrown');

  // =================================================================
  // CLEANUP
  // =================================================================
  console.log('\n--- Cleaning up Test Collection ---');
  await deleteCollection(testCollection);
  console.log(`Test collection "${testCollection}" cleaned up.`);

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 STAGE 6 VERIFICATION COMPLETE: ALL SEMANTIC SEARCH TESTS PASSED!');
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
