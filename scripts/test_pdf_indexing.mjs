// Test Suite for RAG Stage 5: PDF Indexing Pipeline
// Run with: npx vite-node scripts/test_pdf_indexing.mjs

import fs from 'fs';
import path from 'path';
import {
  indexPdfDocument,
  indexMultiplePdfDocuments,
  deleteResourceIndex,
  reindexPdfDocument,
  resolveAuthenticatedStudentId,
} from '../src/services/pdfIndexingService.ts';
import {
  getChunkById,
  getChunksByIds,
  deleteCollection,
  getCollectionStats,
} from '../src/services/chromaService.ts';
import { NOMIC_EMBED_DIMENSIONS } from '../src/types/embedding.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 5: PDF INDEXING PIPELINE TEST SUITE');
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
  const testCollection = `test_index_pipeline_${Date.now()}`;
  const testStudentId = 'student_rag_test_uid_42';

  const fixturesDir = path.resolve('test_fixtures');
  const normalPdfPath = path.join(fixturesDir, 'normal_text.pdf');
  const emptyPdfPath = path.join(fixturesDir, 'empty_document.pdf');
  const corruptedPdfPath = path.join(fixturesDir, 'corrupted_unsupported.pdf');

  // =================================================================
  // 1. DIGITAL PDF EXTRACTION & END-TO-END INDEXING
  // =================================================================
  const normalRaw = fs.readFileSync(normalPdfPath);
  const normalPdfBuffer = new Uint8Array(normalRaw.buffer, normalRaw.byteOffset, normalRaw.byteLength);

  const digitalDocInput = {
    source: {
      arrayBuffer: normalPdfBuffer,
      fileName: 'normal_text.pdf',
    },
    studentId: testStudentId,
    subjectId: 'cs-algo-201',
    moduleId: 'mod-graph-algorithms',
    resourceId: 'res-digital-pdf-001',
    resourceName: 'GraphAlgorithms.pdf',
  };

  const progressEvents = [];
  const digitalResult = await indexPdfDocument(digitalDocInput, {
    collectionName: testCollection,
    onProgress: (p) => {
      progressEvents.push(p);
    },
  });

  assert(digitalResult.status === 'completed', `Digital PDF indexed successfully (status = ${digitalResult.status})`);
  assert(digitalResult.totalPages >= 1, `Extracted ${digitalResult.totalPages} page(s)`);
  assert(digitalResult.totalChunks >= 1, `Generated ${digitalResult.totalChunks} chunk(s)`);
  assert(digitalResult.storedChunks === digitalResult.totalChunks, `All ${digitalResult.totalChunks} chunks stored in ChromaDB`);
  assert(progressEvents.some(p => p.stage === 'extracting'), 'Reported "extracting" progress stage');
  assert(progressEvents.some(p => p.stage === 'chunking'), 'Reported "chunking" progress stage');
  assert(progressEvents.some(p => p.stage === 'embedding'), 'Reported "embedding" progress stage');
  assert(progressEvents.some(p => p.stage === 'storing'), 'Reported "storing" progress stage');
  assert(progressEvents.some(p => p.stage === 'completed'), 'Reported "completed" progress stage');

  // =================================================================
  // 2. SCANNED PDF OCR EXTRACTION
  // =================================================================
  console.log('\n--- 2. Testing Scanned PDF OCR Extraction Indexing ---');
  // Mock/structured scanned PDF extraction result for OCR verification
  const scannedPdfInput = {
    source: {
      pdfResult: {
        fileName: 'ScannedHistoryNotes.pdf',
        status: 'success',
        pageCount: 2,
        totalCharacters: 280,
        text: 'Page 1 OCR: The Industrial Revolution transformed agrarian economies into industrial powerhouses.\n\nPage 2 OCR: Steam engines and mechanized spinning increased manufacturing efficiency exponentially.',
        pages: [
          {
            pageNumber: 1,
            text: 'The Industrial Revolution transformed agrarian economies into industrial powerhouses.',
            charCount: 84,
            extractionMethod: 'ocr',
            confidence: 92,
          },
          {
            pageNumber: 2,
            text: 'Steam engines and mechanized spinning increased manufacturing efficiency exponentially.',
            charCount: 88,
            extractionMethod: 'ocr',
            confidence: 95,
          },
        ],
        isScanned: true,
        hasMixedContent: false,
        ocrPerformed: true,
      },
    },
    studentId: testStudentId,
    subjectId: 'hist-101',
    moduleId: 'mod-industrial-era',
    resourceId: 'res-scanned-ocr-002',
    resourceName: 'ScannedHistoryNotes.pdf',
  };

  const ocrResult = await indexPdfDocument(scannedPdfInput, {
    collectionName: testCollection,
  });

  assert(ocrResult.status === 'completed', 'Scanned PDF indexed successfully');
  assert(ocrResult.isScanned === true, 'isScanned marked true in result');
  assert(ocrResult.ocrPerformed === true, 'ocrPerformed marked true in result');
  assert(ocrResult.totalChunks >= 2, `Generated ${ocrResult.totalChunks} chunks from scanned pages`);

  // =================================================================
  // 3. PAGE NUMBER PRESERVATION
  // =================================================================
  console.log('\n--- 3. Verifying Page Number Preservation ---');
  const ocrChunk0 = await getChunkById('res-scanned-ocr-002_chunk_0', { collectionName: testCollection });
  const ocrChunk1 = await getChunkById('res-scanned-ocr-002_chunk_1', { collectionName: testCollection });

  assert(ocrChunk0 !== null && ocrChunk0.metadata.pageNumber === 1, `Chunk 0 preserved pageNumber: 1 (got ${ocrChunk0?.metadata?.pageNumber})`);
  assert(ocrChunk1 !== null && ocrChunk1.metadata.pageNumber === 2, `Chunk 1 preserved pageNumber: 2 (got ${ocrChunk1?.metadata?.pageNumber})`);

  // =================================================================
  // 4. CHUNK GENERATION & 5. EMBEDDING GENERATION
  // =================================================================
  console.log('\n--- 4 & 5. Verifying Chunk & Embedding Dimensions ---');
  assert(ocrChunk0.embedding.length === NOMIC_EMBED_DIMENSIONS, `Vector has 768 dimensions (got ${ocrChunk0.embedding.length})`);
  assert(ocrChunk0.embedding.every(v => typeof v === 'number' && Number.isFinite(v)), 'Vector contains valid finite floats');

  // =================================================================
  // 6. CHROMADB STORAGE & 7. METADATA PRESERVATION
  // =================================================================
  console.log('\n--- 6 & 7. Verifying ChromaDB Storage & Metadata Integrity ---');
  assert(ocrChunk0.metadata.subjectId === 'hist-101', `subjectId preserved: "hist-101"`);
  assert(ocrChunk0.metadata.moduleId === 'mod-industrial-era', `moduleId preserved: "mod-industrial-era"`);
  assert(ocrChunk0.metadata.resourceId === 'res-scanned-ocr-002', `resourceId preserved: "res-scanned-ocr-002"`);
  assert(ocrChunk0.metadata.resourceName === 'ScannedHistoryNotes.pdf', `resourceName preserved: "ScannedHistoryNotes.pdf"`);
  assert(ocrChunk0.text.includes('Industrial Revolution'), 'Document text preserved verbatim in vector store');

  // =================================================================
  // 8. CORRECT STUDENT / RESOURCE ASSOCIATION
  // =================================================================
  console.log('\n--- 8. Verifying Student / Resource Association ---');
  assert(ocrChunk0.metadata.studentId === testStudentId, `Chunk associated with correct studentId: ${testStudentId}`);

  // =================================================================
  // 9. MULTIPLE PDF INDEXING
  // =================================================================
  console.log('\n--- 9. Testing Multiple PDF Batch Indexing ---');
  const multiInputs = [
    {
      source: {
        pdfResult: {
          fileName: 'DiscreteMath.pdf',
          status: 'success',
          pageCount: 1,
          totalCharacters: 120,
          text: 'Set theory forms the basis of modern mathematics. Relations and functions map domain to codomain.',
          pages: [{ pageNumber: 1, text: 'Set theory forms the basis of modern mathematics.', charCount: 52, extractionMethod: 'text' }],
          isScanned: false,
          hasMixedContent: false,
          ocrPerformed: false,
        },
      },
      studentId: testStudentId,
      subjectId: 'cs-math-102',
      resourceId: 'res-multi-003',
      resourceName: 'DiscreteMath.pdf',
    },
    {
      source: {
        pdfResult: {
          fileName: 'Calculus.pdf',
          status: 'success',
          pageCount: 1,
          totalCharacters: 130,
          text: 'Derivatives measure the instantaneous rate of change. Integrals calculate the area under the curve.',
          pages: [{ pageNumber: 1, text: 'Derivatives measure the instantaneous rate of change.', charCount: 52, extractionMethod: 'text' }],
          isScanned: false,
          hasMixedContent: false,
          ocrPerformed: false,
        },
      },
      studentId: testStudentId,
      subjectId: 'cs-math-102',
      resourceId: 'res-multi-004',
      resourceName: 'Calculus.pdf',
    },
  ];

  const batchResults = await indexMultiplePdfDocuments(multiInputs, { collectionName: testCollection });
  assert(batchResults.length === 2, `Indexed 2 PDFs in batch`);
  assert(batchResults.every(r => r.status === 'completed'), 'Both PDFs in batch reported completed status');

  // =================================================================
  // 10. RE-INDEXING THE SAME RESOURCE (IDEMPOTENCY & NO DUPLICATES)
  // =================================================================
  console.log('\n--- 10. Verifying Idempotent Re-Indexing Without Duplicates ---');
  const statsBeforeReindex = await getCollectionStats(testCollection);
  const totalBefore = statsBeforeReindex.totalVectors;

  // Re-index DiscreteMath with updated content
  const reindexInput = {
    ...multiInputs[0],
    source: {
      pdfResult: {
        fileName: 'DiscreteMath_v2.pdf',
        status: 'success',
        pageCount: 1,
        totalCharacters: 150,
        text: 'Updated set theory notes: Relations, functions, propositional logic, and boolean algebra.',
        pages: [{ pageNumber: 1, text: 'Updated set theory notes: Relations, functions, propositional logic, and boolean algebra.', charCount: 93, extractionMethod: 'text' }],
        isScanned: false,
        hasMixedContent: false,
        ocrPerformed: false,
      },
    },
    resourceName: 'DiscreteMath_v2.pdf',
  };

  const reindexResult = await reindexPdfDocument(reindexInput, { collectionName: testCollection });
  assert(reindexResult.status === 'completed', 'Re-indexing succeeded');

  const statsAfterReindex = await getCollectionStats(testCollection);
  assert(
    statsAfterReindex.totalVectors === totalBefore,
    `Vector count remained identical after re-indexing (${statsAfterReindex.totalVectors} == ${totalBefore}): No duplicates created`
  );

  const updatedChunk = await getChunkById('res-multi-003_chunk_0', { collectionName: testCollection });
  assert(updatedChunk.text.includes('Updated set theory notes'), 'Updated text replaced previous chunk');

  // =================================================================
  // 11. RESOURCE DELETION & VECTOR CLEANUP
  // =================================================================
  console.log('\n--- 11. Verifying Resource Deletion & Vector Cleanup ---');
  await deleteResourceIndex('res-multi-004', testStudentId, { collectionName: testCollection });
  const checkDeleted = await getChunkById('res-multi-004_chunk_0', { collectionName: testCollection });
  assert(checkDeleted === null, 'All vector chunks for deleted resource "res-multi-004" were removed from ChromaDB');

  // =================================================================
  // 12. EMPTY OR UNREADABLE PDF HANDLING
  // =================================================================
  console.log('\n--- 12. Testing Empty & Corrupted PDF Handling ---');
  // Empty PDF
  const emptyRaw = fs.readFileSync(emptyPdfPath);
  const emptyBuffer = new Uint8Array(emptyRaw.buffer, emptyRaw.byteOffset, emptyRaw.byteLength);
  const emptyResult = await indexPdfDocument({
    source: { arrayBuffer: emptyBuffer, fileName: 'empty_document.pdf' },
    studentId: testStudentId,
    subjectId: 'cs-101',
    resourceId: 'res-empty-005',
    resourceName: 'EmptyDoc.pdf',
  }, { collectionName: testCollection });

  assert(emptyResult.status === 'completed', 'Empty PDF handled gracefully without crashing');
  assert(emptyResult.totalChunks === 0, 'Empty PDF produced 0 chunks');

  // Corrupted PDF
  const corruptedRaw = fs.readFileSync(corruptedPdfPath);
  const corruptedBuffer = new Uint8Array(corruptedRaw.buffer, corruptedRaw.byteOffset, corruptedRaw.byteLength);
  const corruptedResult = await indexPdfDocument({
    source: { arrayBuffer: corruptedBuffer, fileName: 'corrupted_unsupported.pdf' },
    studentId: testStudentId,
    subjectId: 'cs-101',
    resourceId: 'res-corrupt-006',
    resourceName: 'CorruptedDoc.pdf',
  }, { collectionName: testCollection });

  assert(corruptedResult.status === 'failed', 'Corrupted PDF safely caught and reported status: failed');
  assert(corruptedResult.error && corruptedResult.error.length > 0, `Error message provided: "${corruptedResult.error}"`);

  // =================================================================
  // 13. OLLAMA UNAVAILABLE HANDLING
  // =================================================================
  console.log('\n--- 13. Verifying Ollama Unavailable Error Handling ---');
  const offlineOllamaResult = await indexPdfDocument({
    source: {
      pdfResult: {
        fileName: 'OfflineTest.pdf',
        status: 'success',
        pageCount: 1,
        totalCharacters: 100,
        text: 'Testing offline Ollama error handling in pipeline.',
        pages: [{ pageNumber: 1, text: 'Testing offline Ollama error handling in pipeline.', charCount: 51, extractionMethod: 'text' }],
        isScanned: false,
        hasMixedContent: false,
        ocrPerformed: false,
      },
    },
    studentId: testStudentId,
    subjectId: 'cs-101',
    resourceId: 'res-ollama-offline',
    resourceName: 'OfflineOllama.pdf',
  }, {
    collectionName: testCollection,
    embeddingOptions: {
      customBaseUrl: 'http://127.0.0.1:54321', // Unreachable Ollama port
    },
  });

  assert(offlineOllamaResult.status === 'failed', 'Offline Ollama caught and reported status: failed');
  assert(offlineOllamaResult.error.includes('Ollama is not running') || offlineOllamaResult.error.includes('failed'), 'Descriptive error returned for offline Ollama');

  // =================================================================
  // 14. CHROMADB UNAVAILABLE HANDLING
  // =================================================================
  console.log('\n--- 14. Verifying ChromaDB Unavailable Error Handling ---');
  const offlineChromaResult = await indexPdfDocument({
    source: {
      pdfResult: {
        fileName: 'OfflineChromaTest.pdf',
        status: 'success',
        pageCount: 1,
        totalCharacters: 100,
        text: 'Testing offline ChromaDB storage error handling in pipeline.',
        pages: [{ pageNumber: 1, text: 'Testing offline ChromaDB storage error handling in pipeline.', charCount: 60, extractionMethod: 'text' }],
        isScanned: false,
        hasMixedContent: false,
        ocrPerformed: false,
      },
    },
    studentId: testStudentId,
    subjectId: 'cs-101',
    resourceId: 'res-chroma-offline',
    resourceName: 'OfflineChroma.pdf',
  }, {
    collectionName: testCollection,
    chromaOptions: {
      customBaseUrl: 'http://127.0.0.1:54322', // Unreachable Chroma port
    },
  });

  assert(offlineChromaResult.status === 'failed', 'Offline ChromaDB caught and reported status: failed');
  assert(offlineChromaResult.error.includes('ChromaDB is not running') || offlineChromaResult.error.includes('failed'), 'Descriptive error returned for offline Chroma');

  // =================================================================
  // 15. PARTIAL INDEXING FAILURE (SAFEGUARDING PREVIOUS INDEX)
  // =================================================================
  console.log('\n--- 15. Verifying Failed Re-Index Does Not Destroy Previous Index ---');
  // 1. Ensure res-digital-pdf-001 has valid vectors in Chroma
  const existingChunk = await getChunkById('res-digital-pdf-001_chunk_0', { collectionName: testCollection });
  assert(existingChunk !== null, 'Existing valid index exists before failed re-index attempt');

  // 2. Attempt re-index with an invalid model that causes embedding failure
  const failedReindexResult = await indexPdfDocument(digitalDocInput, {
    collectionName: testCollection,
    embeddingOptions: {
      model: 'invalid-model-name-xyz',
    },
  });

  assert(failedReindexResult.status === 'failed', 'Failed re-index returned status: failed');

  // 3. Confirm the previous index is STILL INTACT in ChromaDB!
  const survivingChunk = await getChunkById('res-digital-pdf-001_chunk_0', { collectionName: testCollection });
  assert(survivingChunk !== null, 'Previously valid index was preserved intact despite re-index failure!');

  // =================================================================
  // 16. AUTHENTICATION & OWNERSHIP SAFEGUARDS
  // =================================================================
  console.log('\n--- 16. Verifying Authentication & Ownership Safeguards ---');
  let authFailedCleanly = false;
  try {
    resolveAuthenticatedStudentId('');
  } catch (authErr) {
    authFailedCleanly = true;
    assert(authErr.message.includes('Authentication required'), 'Blocked unauthenticated indexing attempt');
  }
  assert(authFailedCleanly, 'Unauthenticated operation rejected');

  // Attempting to index without studentId returns failed status
  const unauthResult = await indexPdfDocument({
    ...digitalDocInput,
    studentId: '',
  }, { collectionName: testCollection });

  assert(unauthResult.status === 'failed', 'Unauthenticated document indexing rejected with status: failed');

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
    console.log('🎉 STAGE 5 VERIFICATION COMPLETE: ALL PDF INDEXING TESTS PASSED!');
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
