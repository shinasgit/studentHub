// Test Suite for RAG Stage 4: ChromaDB Setup & Vector Storage
// Run with: npx vite-node scripts/test_chroma_service.mjs

import {
  checkChromaConnection,
  listCollections,
  getOrCreateCollection,
  getCollection,
  collectionExists,
  deleteCollection,
  addEmbeddedChunks,
  getChunkById,
  getChunksByIds,
  deleteChunksByIds,
  deleteChunksByResourceId,
  getCollectionStats,
  parseChromaError,
} from '../src/services/chromaService.ts';
import { NOMIC_EMBED_DIMENSIONS } from '../src/types/embedding.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 4: CHROMADB VECTOR STORAGE TEST SUITE');
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

/**
 * Generates a mock 768-dimensional normalized floating point vector for testing.
 */
function createMockVector(seed = 1) {
  const vec = new Array(768);
  for (let i = 0; i < 768; i++) {
    vec[i] = Math.sin(seed * (i + 1)) * 0.1;
  }
  return vec;
}

async function runTestSuite() {
  const testCollName = `test_rag_collection_${Date.now()}`;

  // =================================================================
  // 1. CHROMADB CONNECTION
  // =================================================================
  console.log('--- 1. Testing ChromaDB Server Connection ---');
  const connStatus = await checkChromaConnection();
  assert(connStatus.connected === true, `Connected to local ChromaDB server at ${connStatus.baseUrl}`);
  assert(connStatus.heartbeat !== undefined, `Heartbeat timestamp received: ${connStatus.heartbeat}`);
  assert(typeof connStatus.version === 'string', `Chroma server version identified: ${connStatus.version}`);

  // =================================================================
  // 2. COLLECTION CREATION
  // =================================================================
  console.log('\n--- 2. Testing Collection Creation ---');
  const createdColl = await getOrCreateCollection(testCollName);
  assert(createdColl.id && typeof createdColl.id === 'string', `Collection created with ID: ${createdColl.id}`);
  assert(createdColl.name === testCollName, `Collection name matches: "${createdColl.name}"`);

  // =================================================================
  // 3. COLLECTION RETRIEVAL & EXISTENCE CHECK
  // =================================================================
  console.log('\n--- 3. Testing Collection Retrieval & Existence Checks ---');
  const retrievedColl = await getCollection(testCollName);
  assert(retrievedColl !== null, `Retrieved existing collection by name`);
  assert(retrievedColl.id === createdColl.id, `Retrieved collection ID matches created collection ID`);

  const existsTrue = await collectionExists(testCollName);
  assert(existsTrue === true, `collectionExists returned true for "${testCollName}"`);

  const existsFalse = await collectionExists('non_existent_chroma_coll_xyz_999');
  assert(existsFalse === false, `collectionExists returned false for non-existent collection`);

  // =================================================================
  // 4. STORING A SAMPLE 768-DIMENSIONAL VECTOR & 5. ORIGINAL TEXT + METADATA
  // =================================================================
  console.log('\n--- 4 & 5. Storing 768-Dim Vectors, Text, and Metadata ---');
  const vector1 = createMockVector(1.23);
  const vector2 = createMockVector(4.56);

  const sampleChunks = [
    {
      chunkId: 'test_chunk_doc1_0',
      chunkIndex: 0,
      text: 'A computer network is a system of interconnected computing devices that exchange data and share resources.',
      embedding: vector1,
      dimensions: 768,
      model: 'nomic-embed-text',
      subjectId: 'cs-101',
      moduleId: 'mod-networks',
      resourceId: 'res-net-guide',
      resourceName: 'ComputerNetworksGuide.pdf',
      pageNumber: 1,
      totalChunks: 2,
      tokenCount: 22,
      characterCount: 106,
      metadata: {
        chunkId: 'test_chunk_doc1_0',
        chunkIndex: 0,
        totalChunks: 2,
        studentId: 'student_user_123',
        subjectId: 'cs-101',
        moduleId: 'mod-networks',
        resourceId: 'res-net-guide',
        resourceName: 'ComputerNetworksGuide.pdf',
        pageNumber: 1,
        tokenCount: 22,
        characterCount: 106,
        extractionMethod: 'text',
      },
    },
    {
      chunkId: 'test_chunk_doc1_1',
      chunkIndex: 1,
      text: 'Routing protocols determine the optimal path for packets traversing autonomous networks.',
      embedding: vector2,
      dimensions: 768,
      model: 'nomic-embed-text',
      subjectId: 'cs-101',
      moduleId: 'mod-networks',
      resourceId: 'res-net-guide',
      resourceName: 'ComputerNetworksGuide.pdf',
      pageNumber: 2,
      totalChunks: 2,
      tokenCount: 16,
      characterCount: 88,
      metadata: {
        chunkId: 'test_chunk_doc1_1',
        chunkIndex: 1,
        totalChunks: 2,
        studentId: 'student_user_123',
        subjectId: 'cs-101',
        moduleId: 'mod-networks',
        resourceId: 'res-net-guide',
        resourceName: 'ComputerNetworksGuide.pdf',
        pageNumber: 2,
        tokenCount: 16,
        characterCount: 88,
        extractionMethod: 'text',
      },
    },
  ];

  const addResult = await addEmbeddedChunks(sampleChunks, { collectionName: testCollName });
  assert(addResult.success === true, 'addEmbeddedChunks returned success');
  assert(addResult.count === 2, `Added 2 chunks (count = ${addResult.count})`);
  assert(addResult.ids.includes('test_chunk_doc1_0'), 'Returned IDs include test_chunk_doc1_0');
  assert(addResult.ids.includes('test_chunk_doc1_1'), 'Returned IDs include test_chunk_doc1_1');

  // =================================================================
  // 6. RETRIEVING THE STORED RECORD
  // =================================================================
  console.log('\n--- 6. Testing Record Retrieval by ID ---');
  const record0 = await getChunkById('test_chunk_doc1_0', { collectionName: testCollName });
  assert(record0 !== null, 'Retrieved record is non-null');
  assert(record0.id === 'test_chunk_doc1_0', `Record ID matches: ${record0.id}`);
  assert(record0.text === sampleChunks[0].text, 'Original chunk text preserved verbatim');

  // =================================================================
  // 7. VERIFYING THE VECTOR DIMENSIONS
  // =================================================================
  console.log('\n--- 7. Verifying 768 Vector Dimensions & Finite Numbers ---');
  assert(Array.isArray(record0.embedding), 'Retrieved embedding is an array');
  assert(
    record0.embedding.length === NOMIC_EMBED_DIMENSIONS,
    `Vector has exactly ${NOMIC_EMBED_DIMENSIONS} dimensions (got ${record0.embedding.length})`
  );
  let allFinite = record0.embedding.every((val) => typeof val === 'number' && Number.isFinite(val));
  assert(allFinite, 'Every vector element is a valid finite float');
  console.log(`Sample vector (first 5 dims): [${record0.embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}, ...]`);

  // =================================================================
  // 8. VERIFYING METADATA PRESERVATION
  // =================================================================
  console.log('\n--- 8. Verifying Metadata Attributes Preservation ---');
  assert(record0.metadata.subjectId === 'cs-101', `metadata.subjectId preserved: "cs-101"`);
  assert(record0.metadata.moduleId === 'mod-networks', `metadata.moduleId preserved: "mod-networks"`);
  assert(record0.metadata.resourceId === 'res-net-guide', `metadata.resourceId preserved: "res-net-guide"`);
  assert(record0.metadata.resourceName === 'ComputerNetworksGuide.pdf', `metadata.resourceName preserved: "ComputerNetworksGuide.pdf"`);
  assert(record0.metadata.pageNumber === 1, `metadata.pageNumber preserved: 1`);
  assert(record0.metadata.chunkIndex === 0, `metadata.chunkIndex preserved: 0`);
  assert(record0.metadata.totalChunks === 2, `metadata.totalChunks preserved: 2`);
  assert(record0.metadata.tokenCount === 22, `metadata.tokenCount preserved: 22`);
  assert(record0.metadata.characterCount === 106, `metadata.characterCount preserved: 106`);
  assert(record0.metadata.studentId === 'student_user_123', `metadata.studentId preserved: "student_user_123"`);

  // =================================================================
  // 9. DELETING A RECORD BY ID
  // =================================================================
  console.log('\n--- 9. Testing Deletion by ID ---');
  const delByIdCount = await deleteChunksByIds(['test_chunk_doc1_0'], { collectionName: testCollName });
  assert(delByIdCount >= 0, `deleteChunksByIds executed successfully`);

  const deletedRecord = await getChunkById('test_chunk_doc1_0', { collectionName: testCollName });
  assert(deletedRecord === null, 'Deleted chunk is no longer found (returned null)');

  const remainingRecord = await getChunkById('test_chunk_doc1_1', { collectionName: testCollName });
  assert(remainingRecord !== null, 'Other chunks in collection remain intact');

  // =================================================================
  // 10. DELETING RECORDS BY RESOURCEID
  // =================================================================
  console.log('\n--- 10. Testing Deletion by Resource ID ---');
  // Store a chunk for a new resource to test deletion by resourceId
  const chunkForResource = {
    chunkId: 'test_chunk_res_del_0',
    chunkIndex: 0,
    text: 'Temporary resource text to be deleted by resourceId.',
    embedding: createMockVector(9.99),
    dimensions: 768,
    model: 'nomic-embed-text',
    subjectId: 'cs-101',
    moduleId: 'mod-temp',
    resourceId: 'res-to-delete-999',
    resourceName: 'TempResource.pdf',
    pageNumber: 1,
    totalChunks: 1,
    tokenCount: 10,
    characterCount: 52,
    metadata: {
      chunkId: 'test_chunk_res_del_0',
      chunkIndex: 0,
      totalChunks: 1,
      subjectId: 'cs-101',
      moduleId: 'mod-temp',
      resourceId: 'res-to-delete-999',
      resourceName: 'TempResource.pdf',
      pageNumber: 1,
      tokenCount: 10,
      characterCount: 52,
    },
  };

  await addEmbeddedChunks([chunkForResource], { collectionName: testCollName });
  const checkBeforeDel = await getChunkById('test_chunk_res_del_0', { collectionName: testCollName });
  assert(checkBeforeDel !== null, 'Temporary chunk added successfully');

  // Delete by resourceId
  await deleteChunksByResourceId('res-to-delete-999', { collectionName: testCollName });
  const checkAfterDel = await getChunkById('test_chunk_res_del_0', { collectionName: testCollName });
  assert(checkAfterDel === null, 'All chunks belonging to "res-to-delete-999" were deleted');

  // =================================================================
  // 11. COLLECTION STATISTICS
  // =================================================================
  console.log('\n--- 11. Testing Collection Statistics ---');
  const stats = await getCollectionStats(testCollName);
  assert(stats.collectionName === testCollName, `Stats collectionName matches: ${stats.collectionName}`);
  assert(typeof stats.collectionId === 'string' && stats.collectionId.length > 0, `Stats includes collectionId: ${stats.collectionId}`);
  assert(typeof stats.totalVectors === 'number', `Stats totalVectors is a valid number: ${stats.totalVectors}`);

  // =================================================================
  // 12. CHROMADB UNAVAILABLE ERROR HANDLING
  // =================================================================
  console.log('\n--- 12. Testing ChromaDB Offline / Unavailable Error Handling ---');
  const offlineStatus = await checkChromaConnection('http://127.0.0.1:59998');
  assert(offlineStatus.connected === false, 'checkChromaConnection correctly returns connected: false for offline endpoint');
  assert(
    offlineStatus.error &&
    offlineStatus.error.toLowerCase().includes('chrona') ||
    offlineStatus.error.toLowerCase().includes('not running') ||
    offlineStatus.error.toLowerCase().includes('unreachable') ||
    offlineStatus.error.toLowerCase().includes('start_chroma.ps1'),
    `Actionable guidance provided in error: "${offlineStatus.error}"`
  );

  let caughtListError = false;
  try {
    await listCollections({ customBaseUrl: 'http://127.0.0.1:59998' });
  } catch (err) {
    caughtListError = true;
    assert(err.message.includes('start_chroma.ps1') || err.message.includes('not running'), 'listCollections error includes startup instruction');
  }
  assert(caughtListError, 'listCollections threw error for offline ChromaDB');

  // =================================================================
  // 13. CLEANUP TEST COLLECTION
  // =================================================================
  console.log('\n--- 13. Cleaning up Test Collection ---');
  const deletedColl = await deleteCollection(testCollName);
  assert(deletedColl === true, `Test collection "${testCollName}" deleted successfully`);

  const existsAfterCleanup = await collectionExists(testCollName);
  assert(existsAfterCleanup === false, 'Test collection no longer exists after cleanup');

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 STAGE 4 VERIFICATION COMPLETE: ALL CHROMADB TESTS PASSED!');
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
