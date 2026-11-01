// Test Suite for RAG Stage 8.2: Retrieval & Filtering Improvements
// Run with: npx vite-node scripts/test_stage_8_2.mjs

import {
  buildChromaWhereFilter,
  getOrCreateCollection,
  deleteCollection,
  addEmbeddedChunks,
} from '../src/services/chromaService.ts';
import {
  searchSimilarChunks,
  searchByModules,
  validateSearchFilters,
  formatNomicQueryText,
  NOMIC_QUERY_PREFIX,
  DEFAULT_MIN_SIMILARITY,
} from '../src/services/semanticSearchService.ts';
import {
  formatNomicDocumentText,
  NOMIC_DOCUMENT_PREFIX,
  NOMIC_EMBEDDING_VERSION,
  embedSingleChunk,
  embedChunks,
} from '../src/services/documentEmbeddingService.ts';
import {
  generateRagAnswer,
  DEFAULT_RAG_MIN_SIMILARITY,
} from '../src/services/ragService.ts';
import {
  checkCollectionPrefixStatus,
  createSafeBackupCollection,
} from '../src/services/ragMigrationService.ts';
import { NOMIC_EMBED_DIMENSIONS } from '../src/types/embedding.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 8.2: RETRIEVAL & FILTERING IMPROVEMENTS TEST SUITE');
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

async function runStage82Tests() {
  const testCollection = `test_stage82_${Date.now()}`;
  const studentAlice = 'student_alice_stage82_101';
  const studentBob = 'student_bob_stage82_202';

  // =================================================================
  // SECTION A: MULTI-MODULE FILTERING TESTS
  // =================================================================
  console.log('--- SECTION A: Multi-Module Filtering ---');

  // Test 1: buildChromaWhereFilter with single moduleId
  const singleModFilter = buildChromaWhereFilter({
    studentId: studentAlice,
    subjectId: 'cs-networks-301',
    moduleId: 'mod-transport',
  });
  assert(
    singleModFilter &&
      singleModFilter.$and &&
      singleModFilter.$and.some((c) => c.moduleId === 'mod-transport') &&
      singleModFilter.$and.some((c) => c.studentId === studentAlice),
    '1. Single-module filter builds correct Chroma equality filter with student isolation'
  );

  // Test 2: buildChromaWhereFilter with multiple moduleIds ($in)
  const multiModFilter = buildChromaWhereFilter({
    studentId: studentAlice,
    subjectId: 'cs-networks-301',
    moduleIds: ['mod-transport', 'mod-network-layer'],
  });
  assert(
    multiModFilter &&
      multiModFilter.$and &&
      multiModFilter.$and.some(
        (c) =>
          c.moduleId &&
          typeof c.moduleId === 'object' &&
          Array.isArray(c.moduleId.$in) &&
          c.moduleId.$in.length === 2 &&
          c.moduleId.$in.includes('mod-transport') &&
          c.moduleId.$in.includes('mod-network-layer')
      ),
    '2. Multiple-module filter correctly builds ChromaDB $in filter'
  );

  // Test 3: Entire-subject filtering (no module criteria)
  const entireSubjectFilter = buildChromaWhereFilter({
    studentId: studentAlice,
    subjectId: 'cs-networks-301',
  });
  assert(
    entireSubjectFilter &&
      entireSubjectFilter.$and &&
      entireSubjectFilter.$and.length === 2 &&
      entireSubjectFilter.$and.some((c) => c.subjectId === 'cs-networks-301') &&
      entireSubjectFilter.$and.every((c) => !('moduleId' in c)),
    '3. Entire-subject filter omits moduleId, searching across all modules in subject'
  );

  // Test 4: Resource-specific filtering
  const resourceFilter = buildChromaWhereFilter({
    studentId: studentAlice,
    resourceId: 'res-tcp-handshake-pdf',
  });
  assert(
    resourceFilter &&
      resourceFilter.$and &&
      resourceFilter.$and.some((c) => c.resourceId === 'res-tcp-handshake-pdf') &&
      resourceFilter.$and.some((c) => c.studentId === studentAlice),
    '4. Resource-specific filter includes studentId and resourceId'
  );

  // Test 5: Empty module selection (moduleIds: [])
  const emptyModulesFilter = buildChromaWhereFilter({
    studentId: studentAlice,
    subjectId: 'cs-networks-301',
    moduleIds: [],
  });
  assert(
    emptyModulesFilter &&
      emptyModulesFilter.$and &&
      emptyModulesFilter.$and.every((c) => !('moduleId' in c)),
    '5. Empty module selection (moduleIds: []) cleanly falls back to subject without throwing'
  );

  // Test 6: Invalid module IDs filtering and validation
  const whitespaceModulesFilter = buildChromaWhereFilter({
    studentId: studentAlice,
    subjectId: 'cs-networks-301',
    moduleIds: ['', '   '],
  });
  assert(
    whitespaceModulesFilter &&
      whitespaceModulesFilter.$and &&
      whitespaceModulesFilter.$and.every((c) => !('moduleId' in c)),
    '6. Invalid whitespace module IDs are pruned, preventing invalid empty $in clause'
  );

  // Test 7: validateSearchFilters rejects malformed moduleIds
  let filterValidationErrorCaught = false;
  try {
    validateSearchFilters({
      subjectId: 'cs-101',
      moduleIds: 'not-an-array',
    });
  } catch (err) {
    filterValidationErrorCaught = true;
    assert(
      err.message.includes('"moduleIds" must be an array of strings'),
      `7. Malformed moduleIds type rejected: "${err.message}"`
    );
  }
  assert(filterValidationErrorCaught, 'validateSearchFilters threw validation error on non-array moduleIds');

  // =================================================================
  // SECTION B: NOMIC TASK PREFIXES TESTS
  // =================================================================
  console.log('\n--- SECTION B: Nomic Embedding Task Prefixes ---');

  // Test 8: Document prefix addition
  const sampleDocText = 'Operating systems provide process management and scheduling.';
  const prefixedDocText = formatNomicDocumentText(sampleDocText);
  assert(
    prefixedDocText === `${NOMIC_DOCUMENT_PREFIX}${sampleDocText}`,
    '8. Document chunks receive "search_document: " task prefix'
  );

  // Test 9: Query prefix addition
  const sampleQueryText = 'How does round-robin CPU scheduling work?';
  const prefixedQueryText = formatNomicQueryText(sampleQueryText);
  assert(
    prefixedQueryText === `${NOMIC_QUERY_PREFIX}${sampleQueryText}`,
    '9. Queries receive "search_query: " task prefix'
  );

  // Test 10: Prefix is not duplicated if already present
  const doublePrefixedDoc = formatNomicDocumentText(prefixedDocText);
  assert(
    doublePrefixedDoc === prefixedDocText,
    '10. Document prefix is NOT duplicated when text already has prefix'
  );

  const doublePrefixedQuery = formatNomicQueryText(prefixedQueryText);
  assert(
    doublePrefixedQuery === prefixedQueryText,
    '11. Query prefix is NOT duplicated when query already has prefix'
  );

  // Test 12: Live Ollama embedding with document prefix retains 768 dimensions
  console.log('Testing live Ollama embedding generation with prefix...');
  const testSingleChunk = {
    chunkId: 'res-test-chunk-001',
    chunkIndex: 0,
    text: 'A router directs data packets between networks using routing tables and IP addresses.',
    subjectId: 'cs-networks-301',
    moduleId: 'mod-network-layer',
    resourceId: 'res-router-notes',
    resourceName: 'RouterNotes.pdf',
    pageNumber: 5,
    totalChunks: 1,
    tokenCount: 20,
    characterCount: 95,
    metadata: {
      chunkId: 'res-test-chunk-001',
      chunkIndex: 0,
      totalChunks: 1,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-network-layer',
      resourceId: 'res-router-notes',
      resourceName: 'RouterNotes.pdf',
      pageNumber: 5,
      tokenCount: 20,
      characterCount: 95,
      extractionMethod: 'text',
    },
  };

  const embeddedRes = await embedSingleChunk(testSingleChunk);
  assert(
    embeddedRes.embedding.length === NOMIC_EMBED_DIMENSIONS,
    `12. Document chunk embedded with prefix produces exactly ${NOMIC_EMBED_DIMENSIONS} dimensions`
  );
  assert(
    embeddedRes.metadata.embeddingVersion === NOMIC_EMBEDDING_VERSION,
    `13. Embedded chunk is tagged with embeddingVersion: "${NOMIC_EMBEDDING_VERSION}"`
  );
  assert(
    embeddedRes.text === testSingleChunk.text,
    '14. Clean student text is preserved without internal prefix tag in chunk data'
  );

  // =================================================================
  // SECTION C: LIVE CHROMADB POPULATION FOR RETRIEVAL & THRESHOLDS
  // =================================================================
  console.log('\n--- SECTION C: Live Retrieval, Multi-Module Scoping & Thresholds ---');

  console.log(`Setting up isolated collection: "${testCollection}"...`);
  await getOrCreateCollection(testCollection);

  const testChunksToStore = [
    // Alice - CS Networks - Module: mod-transport
    {
      chunkId: 'chunk-alice-transport-1',
      chunkIndex: 0,
      totalChunks: 4,
      text: 'TCP connection setup uses a 3-way handshake with SYN, SYN-ACK, and ACK packets to establish reliable byte-stream delivery.',
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-net-transport-pdf',
      resourceName: 'Networks_Transport.pdf',
      pageNumber: 12,
      tokenCount: 25,
      characterCount: 130,
      studentId: studentAlice,
      metadata: {
        chunkId: 'chunk-alice-transport-1',
        chunkIndex: 0,
        totalChunks: 4,
        subjectId: 'cs-networks-301',
        moduleId: 'mod-transport',
        resourceId: 'res-net-transport-pdf',
        resourceName: 'Networks_Transport.pdf',
        pageNumber: 12,
        tokenCount: 25,
        characterCount: 130,
        studentId: studentAlice,
        embeddingVersion: NOMIC_EMBEDDING_VERSION,
      },
    },
    // Alice - CS Networks - Module: mod-network-layer
    {
      chunkId: 'chunk-alice-network-1',
      chunkIndex: 1,
      totalChunks: 4,
      text: 'The network layer handles packet routing and logical IP addressing across interconnected networks using OSPF and BGP protocols.',
      subjectId: 'cs-networks-301',
      moduleId: 'mod-network-layer',
      resourceId: 'res-net-routing-pdf',
      resourceName: 'Networks_Routing.pdf',
      pageNumber: 24,
      tokenCount: 25,
      characterCount: 135,
      studentId: studentAlice,
      metadata: {
        chunkId: 'chunk-alice-network-1',
        chunkIndex: 1,
        totalChunks: 4,
        subjectId: 'cs-networks-301',
        moduleId: 'mod-network-layer',
        resourceId: 'res-net-routing-pdf',
        resourceName: 'Networks_Routing.pdf',
        pageNumber: 24,
        tokenCount: 25,
        characterCount: 135,
        studentId: studentAlice,
        embeddingVersion: NOMIC_EMBEDDING_VERSION,
      },
    },
    // Alice - CS Networks - Module: mod-application-layer
    {
      chunkId: 'chunk-alice-app-1',
      chunkIndex: 2,
      totalChunks: 4,
      text: 'HTTP and DNS operate at the application layer to translate domain names and request web pages over client-server sockets.',
      subjectId: 'cs-networks-301',
      moduleId: 'mod-application-layer',
      resourceId: 'res-net-app-pdf',
      resourceName: 'Networks_Application.pdf',
      pageNumber: 3,
      tokenCount: 24,
      characterCount: 125,
      studentId: studentAlice,
      metadata: {
        chunkId: 'chunk-alice-app-1',
        chunkIndex: 2,
        totalChunks: 4,
        subjectId: 'cs-networks-301',
        moduleId: 'mod-application-layer',
        resourceId: 'res-net-app-pdf',
        resourceName: 'Networks_Application.pdf',
        pageNumber: 3,
        tokenCount: 24,
        characterCount: 125,
        studentId: studentAlice,
        embeddingVersion: NOMIC_EMBEDDING_VERSION,
      },
    },
    // Bob - CS Networks - Module: mod-transport (Student Isolation test)
    {
      chunkId: 'chunk-bob-transport-1',
      chunkIndex: 3,
      totalChunks: 4,
      text: 'Bob confidential transport notes: SECRET_TOKEN_BOB_9999. Do not leak to Alice under any condition.',
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-bob-secret-pdf',
      resourceName: 'BobSecretNotes.pdf',
      pageNumber: 1,
      tokenCount: 20,
      characterCount: 105,
      studentId: studentBob,
      metadata: {
        chunkId: 'chunk-bob-transport-1',
        chunkIndex: 3,
        totalChunks: 4,
        subjectId: 'cs-networks-301',
        moduleId: 'mod-transport',
        resourceId: 'res-bob-secret-pdf',
        resourceName: 'BobSecretNotes.pdf',
        pageNumber: 1,
        tokenCount: 20,
        characterCount: 105,
        studentId: studentBob,
        embeddingVersion: NOMIC_EMBEDDING_VERSION,
      },
    },
  ];

  console.log('Embedding and indexing test chunks with Nomic prefixes into ChromaDB...');
  const embeddedResult = await embedChunks(testChunksToStore);
  await addEmbeddedChunks(embeddedResult.embeddedChunks, { collectionName: testCollection });
  console.log('Indexed test chunks successfully.');

  // Test 15: Multi-Module Live Retrieval: filter by ['mod-transport', 'mod-network-layer']
  console.log('\nTesting multi-module retrieval with ChromaDB $in...');
  const multiModuleSearchResult = await searchSimilarChunks('Explain network protocols and connection handshake', {
    collectionName: testCollection,
    filters: {
      studentId: studentAlice,
      subjectId: 'cs-networks-301',
      moduleIds: ['mod-transport', 'mod-network-layer'],
    },
    topK: 10,
    minSimilarity: 0.10,
  });

  assert(multiModuleSearchResult.status === 'success', '15. Multi-module search executed with status: success');
  assert(multiModuleSearchResult.results.length >= 2, `16. Retrieved ${multiModuleSearchResult.results.length} chunks across selected modules`);
  assert(
    multiModuleSearchResult.results.every((r) =>
      ['mod-transport', 'mod-network-layer'].includes(r.moduleId || '')
    ),
    '17. All returned chunks strictly belong to one of the selected modules'
  );
  assert(
    !multiModuleSearchResult.results.some((r) => r.moduleId === 'mod-application-layer'),
    '18. Unselected module "mod-application-layer" was completely excluded'
  );

  // Test 19: searchByModules helper function
  const searchByModulesRes = await searchByModules(
    'transport handshake',
    'cs-networks-301',
    ['mod-transport'],
    {
      collectionName: testCollection,
      filters: { studentId: studentAlice },
      topK: 5,
    }
  );
  assert(searchByModulesRes.status === 'success', '19. searchByModules helper succeeded');
  assert(searchByModulesRes.results.every((r) => r.moduleId === 'mod-transport'), '20. searchByModules strictly filtered to mod-transport');

  // Test 21: Student isolation in multi-module search
  assert(
    multiModuleSearchResult.results.every((r) => r.metadata.studentId === studentAlice),
    '21. Multi-module search preserved student-level isolation (no Bob chunks)'
  );
  assert(
    !multiModuleSearchResult.results.some((r) => r.text.includes('SECRET_TOKEN_BOB')),
    '22. Bob confidential data was never retrieved by Alice'
  );

  // Test 23: Non-existent module ID in moduleIds
  const nonExistentModResult = await searchSimilarChunks('network routing', {
    collectionName: testCollection,
    filters: {
      studentId: studentAlice,
      subjectId: 'cs-networks-301',
      moduleIds: ['mod-does-not-exist-xyz'],
    },
    topK: 5,
  });
  assert(nonExistentModResult.status === 'empty', '23. Non-existent module ID returns status: "empty" gracefully');
  assert(nonExistentModResult.totalResults === 0, '24. 0 results returned for non-existent module ID');

  // =================================================================
  // SECTION D: SIMILARITY THRESHOLD TESTS
  // =================================================================
  console.log('\n--- SECTION D: Minimum Similarity Threshold ---');

  assert(DEFAULT_RAG_MIN_SIMILARITY === 0.50, '25. Default RAG similarity threshold is configured to 0.50');
  assert(DEFAULT_MIN_SIMILARITY === 0.50, '26. Default Semantic Search similarity threshold is configured to 0.50');

  // Test 27: Relevant chunk above threshold (0.50)
  const queryTCP = 'TCP three-way handshake SYN SYN-ACK ACK';
  const aboveThresholdSearch = await searchSimilarChunks(queryTCP, {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    minSimilarity: 0.50,
  });
  assert(aboveThresholdSearch.status === 'success', '27. Highly relevant query returns results above 0.50 threshold');
  assert(aboveThresholdSearch.results.length > 0, '28. Matching chunks returned above threshold');
  const topSimilarity = aboveThresholdSearch.results[0]?.similarity ?? 0;
  assert(topSimilarity >= 0.50, `29. Top result similarity (${(topSimilarity * 100).toFixed(1)}%) is >= 50%`);

  // Test 30: High custom threshold (0.95) filters out all chunks
  const highThresholdSearch = await searchSimilarChunks('TCP connection setup', {
    collectionName: testCollection,
    filters: { studentId: studentAlice },
    minSimilarity: 0.99, // Unattainably high threshold
  });
  assert(highThresholdSearch.status === 'empty', '30. Custom high threshold (0.99) filters out chunks below threshold');
  assert(highThresholdSearch.totalResults === 0, '31. Total results is 0 when all chunks are below threshold');

  // Test 32: generateRagAnswer with high threshold returns status: "no_context"
  const ragNoContextResult = await generateRagAnswer(
    'TCP connection setup',
    {
      subjectId: 'cs-networks-301',
      subjectName: 'Computer Networks',
      scopeMode: 'entire_subject',
      moduleIds: [],
    },
    studentAlice,
    {
      collectionName: testCollection,
      minSimilarity: 0.99, // High threshold causes all chunks to be rejected
    }
  );
  assert(ragNoContextResult.status === 'no_context', '32. generateRagAnswer returns status: "no_context" when chunks fall below threshold');
  assert(ragNoContextResult.isGrounded === false, '33. isGrounded is false for no-context refusal');
  assert(ragNoContextResult.sources.length === 0, '34. No sources are cited when similarity threshold rejects context');
  assert(
    ragNoContextResult.answer.includes('no relevant passages were found'),
    '35. Clear, friendly academic refusal message provided to student'
  );

  // Test 36: generateRagAnswer with multi-module scope
  console.log('\nTesting generateRagAnswer with multi-module scope...');
  const ragMultiModResult = await generateRagAnswer(
    'How is a TCP connection established?',
    {
      subjectId: 'cs-networks-301',
      subjectName: 'Computer Networks',
      scopeMode: 'specific_modules',
      moduleIds: ['mod-transport', 'mod-network-layer'],
    },
    studentAlice,
    {
      collectionName: testCollection,
      minSimilarity: 0.40,
    }
  );
  assert(ragMultiModResult.status === 'success', '36. generateRagAnswer succeeded with multi-module scope');
  assert(ragMultiModResult.isGrounded === true, '37. Generated answer is grounded in retrieved excerpts');
  assert(ragMultiModResult.sources.length > 0, '38. Source citations attached to response');
  assert(
    ragMultiModResult.sources.every((s) => ['mod-transport', 'mod-network-layer'].includes(s.moduleId || '')),
    '39. All cited sources are from the selected modules'
  );

  // =================================================================
  // SECTION E: SAFE MIGRATION & BACKUP TESTS
  // =================================================================
  console.log('\n--- SECTION E: Safe Migration & Backup Verification ---');

  // Test 40: Check prefix status of test collection
  const migStatus = await checkCollectionPrefixStatus(testCollection);
  assert(migStatus.totalVectors === 4, `40. Migration status reports 4 total vectors (got ${migStatus.totalVectors})`);
  assert(migStatus.prefixedVectorsV2 === 4, `41. All newly indexed vectors are tagged as v2_nomic_prefix (got ${migStatus.prefixedVectorsV2})`);
  assert(migStatus.isFullyMigrated === true, '42. Collection correctly identified as fully migrated to v2');

  // Test 43: Safe backup collection creation (non-destructive)
  const backupName = `${testCollection}_backup`;
  const backupResult = await createSafeBackupCollection(testCollection, backupName);
  assert(backupResult.success === true, '43. Safe backup collection created successfully');
  assert(backupResult.recordsCopied === 4, `44. Copied all 4 records to backup collection without data loss`);

  // Verify backup collection exists and contains all records
  const backupCheck = await checkCollectionPrefixStatus(backupName);
  assert(backupCheck.totalVectors === 4, '45. Backup collection verified with matching record count');

  // Clean up test collections
  console.log('\nCleaning up isolated test collections...');
  await deleteCollection(testCollection);
  await deleteCollection(backupName);
  console.log('Cleaned up test collections.');

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 STAGE 8.2 VERIFICATION COMPLETE: ALL 45 TESTS PASSED!');
  } else {
    console.error(`❌ STAGE 8.2 TEST SUITE HAS ${failed} FAILURES.`);
  }
  console.log('=============================================================\n');
}

runStage82Tests().catch((err) => {
  console.error('Fatal error during Stage 8.2 test run:', err);
  process.exit(1);
});
