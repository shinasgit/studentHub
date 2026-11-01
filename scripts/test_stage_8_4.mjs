// Test Suite for RAG Stage 8.4: Context Construction & Deduplication
// Run with: npx vite-node scripts/test_stage_8_4.mjs

import {
  generateRagAnswer,
  buildRagPromptContext,
  selectOptimalContextChunks,
  deduplicateChunks,
  truncateAtSentenceBoundary,
  formatPageCitation,
  isDuplicateOrRedundantChunk,
  DEFAULT_RAG_MIN_SIMILARITY,
} from '../src/services/ragService.ts';
import { chunkDocument } from '../src/services/chunkingService.ts';
import {
  getOrCreateCollection,
  deleteCollection,
  addEmbeddedChunks,
} from '../src/services/chromaService.ts';
import { generateEmbedding } from '../src/services/embeddingService.ts';
import { formatNomicDocumentText } from '../src/services/documentEmbeddingService.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 8.4: CONTEXT CONSTRUCTION & DEDUPLICATION');
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

async function runStage84TestSuite() {
  const testCollection = `test_stage84_${Date.now()}`;
  const studentAlice = 'student_alice_stage84_101';
  const studentBob = 'student_bob_stage84_202';

  // =================================================================
  // SECTION A: UNIT & ALGORITHM TESTS
  // =================================================================
  console.log('--- SECTION A: Deduplication, Budgeting & Multi-Page Unit Tests ---');

  // 1. Exact Duplicate Chunk Removal
  const exactChunkA = {
    chunkId: 'chunk_tcp_exact_1',
    text: 'Transmission Control Protocol (TCP) is a connection-oriented protocol providing reliable delivery.',
    resourceId: 'res-net-1',
    resourceName: 'Networks.pdf',
    subjectId: 'cs-net-101',
    pageNumber: 10,
    chunkIndex: 0,
    distance: 0.15,
    similarity: 0.85,
    metadata: { chunkId: 'chunk_tcp_exact_1', pageNumber: 10 },
  };

  const exactChunkB = {
    chunkId: 'chunk_tcp_exact_2',
    text: 'Transmission Control Protocol (TCP) is a connection-oriented protocol providing reliable delivery.',
    resourceId: 'res-net-1',
    resourceName: 'Networks.pdf',
    subjectId: 'cs-net-101',
    pageNumber: 10,
    chunkIndex: 1,
    distance: 0.16,
    similarity: 0.84,
    metadata: { chunkId: 'chunk_tcp_exact_2', pageNumber: 10 },
  };

  const exactDedupResult = deduplicateChunks([exactChunkA, exactChunkB]);
  assert(
    exactDedupResult.deduplicated.length === 1 && exactDedupResult.removedCount === 1,
    '1. Exact duplicate chunk removed (1 kept, 1 removed)'
  );
  assert(
    exactDedupResult.deduplicated[0].chunkId === 'chunk_tcp_exact_1',
    '1.1 Higher-ranked chunk preserved during exact duplicate removal'
  );

  // 2. Normalized-Text Duplicate Removal
  const normChunkA = {
    chunkId: 'chunk_norm_1',
    text: 'ACID transaction properties guarantee database validity: Atomicity, Consistency, Isolation, Durability.',
    resourceId: 'res-db-1',
    resourceName: 'Databases.pdf',
    subjectId: 'cs-db-101',
    pageNumber: 42,
    chunkIndex: 0,
    distance: 0.12,
    similarity: 0.88,
    metadata: { chunkId: 'chunk_norm_1', pageNumber: 42 },
  };

  const normChunkB = {
    chunkId: 'chunk_norm_2',
    text: '  acid transaction properties guarantee database validity: atomicity consistency isolation durability.\n\n',
    resourceId: 'res-db-1',
    resourceName: 'Databases.pdf',
    subjectId: 'cs-db-101',
    pageNumber: 42,
    chunkIndex: 1,
    distance: 0.14,
    similarity: 0.86,
    metadata: { chunkId: 'chunk_norm_2', pageNumber: 42 },
  };

  const normDedupResult = deduplicateChunks([normChunkA, normChunkB]);
  assert(
    normDedupResult.deduplicated.length === 1 && normDedupResult.removedCount === 1,
    '2. Normalized-text duplicate removed (casing, whitespace, punctuation differences ignored)'
  );

  // 3. Near-Duplicate Detection
  const nearChunkA = {
    chunkId: 'chunk_near_1',
    text: 'The primary advantages of TCP include: guaranteed in-order packet delivery, comprehensive end-to-end error detection with retransmissions, full-duplex communication, and built-in flow control and congestion control mechanisms.',
    resourceId: 'res-net-1',
    resourceName: 'Networks.pdf',
    subjectId: 'cs-net-101',
    pageNumber: 15,
    chunkIndex: 0,
    distance: 0.10,
    similarity: 0.90,
    metadata: { chunkId: 'chunk_near_1', pageNumber: 15 },
  };

  // Near duplicate with 95% same words, tiny variation
  const nearChunkB = {
    chunkId: 'chunk_near_2',
    text: 'Primary advantages of TCP include guaranteed in-order packet delivery, comprehensive end-to-end error detection with retransmissions, full-duplex communication, and built-in flow control and congestion control.',
    resourceId: 'res-net-1',
    resourceName: 'Networks.pdf',
    subjectId: 'cs-net-101',
    pageNumber: 15,
    chunkIndex: 1,
    distance: 0.13,
    similarity: 0.87,
    metadata: { chunkId: 'chunk_near_2', pageNumber: 15 },
  };

  const nearDedupResult = deduplicateChunks([nearChunkA, nearChunkB]);
  assert(
    nearDedupResult.deduplicated.length === 1 && nearDedupResult.removedCount === 1,
    '3. Near-duplicate chunk detected and pruned'
  );

  // 4. Preservation of Useful Adjacent Chunks
  // Chunk 1 has overview; Chunk 2 has sliding window overlap from window boundary (~20% overlap), but introduces flow control mechanics
  const adjacentChunkA = {
    chunkId: 'chunk_adj_1',
    text: 'Transmission Control Protocol (TCP) is a connection-oriented transport protocol that provides reliable delivery using a three-way handshake.',
    resourceId: 'res-net-1',
    resourceName: 'Networks.pdf',
    subjectId: 'cs-net-101',
    pageNumber: 14,
    chunkIndex: 0,
    distance: 0.10,
    similarity: 0.90,
    metadata: { chunkId: 'chunk_adj_1', pageNumber: 14 },
  };

  const adjacentChunkB = {
    chunkId: 'chunk_adj_2',
    text: 'Using a three-way handshake, TCP establishes connection state. TCP flow control uses a sliding window mechanism where the receiver advertises buffer capacity to prevent packet drops.',
    resourceId: 'res-net-1',
    resourceName: 'Networks.pdf',
    subjectId: 'cs-net-101',
    pageNumber: 14,
    chunkIndex: 1,
    distance: 0.12,
    similarity: 0.88,
    metadata: { chunkId: 'chunk_adj_2', pageNumber: 14 },
  };

  const adjResult = deduplicateChunks([adjacentChunkA, adjacentChunkB]);
  assert(
    adjResult.deduplicated.length === 2 && adjResult.removedCount === 0,
    '4. Genuinely useful adjacent chunks are preserved (sliding window boundary overlap is NOT aggressively removed)'
  );

  // 5. Context Budget Enforcement
  const budgetTestChunks = [
    {
      chunkId: 'c1',
      text: 'A'.repeat(500),
      resourceId: 'r1',
      resourceName: 'Doc1.pdf',
      subjectId: 's1',
      pageNumber: 1,
      chunkIndex: 0,
      distance: 0.1,
      similarity: 0.9,
      metadata: { chunkId: 'c1', pageNumber: 1 },
    },
    {
      chunkId: 'c2',
      text: 'B'.repeat(500),
      resourceId: 'r1',
      resourceName: 'Doc1.pdf',
      subjectId: 's1',
      pageNumber: 2,
      chunkIndex: 1,
      distance: 0.2,
      similarity: 0.8,
      metadata: { chunkId: 'c2', pageNumber: 2 },
    },
  ];

  const maxCharsBudget = 700;
  const budgetResult = selectOptimalContextChunks(budgetTestChunks, maxCharsBudget);
  assert(
    budgetResult.totalChars <= maxCharsBudget,
    `5. Context budget strictly enforced (used ${budgetResult.totalChars} <= ${maxCharsBudget} budget)`
  );

  // 6. Including Smaller Chunks After an Oversized Chunk
  // Exact scenario from specification:
  // Budget: 4,000 chars.
  // Chunk 1: 1,200 chars
  // Chunk 2: 3,500 chars (exceeds remaining budget after Chunk 1)
  // Chunk 3: 800 chars (fits)
  // Chunk 4: 600 chars (fits)
  const specChunks = [
    {
      chunkId: 'chunk_spec_1',
      text: '1. First chunk content. '.repeat(50), // ~1,200 chars
      resourceId: 'r1',
      resourceName: 'SpecDoc.pdf',
      subjectId: 's1',
      pageNumber: 1,
      chunkIndex: 0,
      distance: 0.10,
      similarity: 0.90,
      metadata: { chunkId: 'chunk_spec_1', pageNumber: 1 },
    },
    {
      chunkId: 'chunk_spec_2_oversized',
      text: '2. Giant oversized second chunk. '.repeat(110), // ~3,500 chars
      resourceId: 'r1',
      resourceName: 'SpecDoc.pdf',
      subjectId: 's1',
      pageNumber: 2,
      chunkIndex: 1,
      distance: 0.15,
      similarity: 0.85,
      metadata: { chunkId: 'chunk_spec_2_oversized', pageNumber: 2 },
    },
    {
      chunkId: 'chunk_spec_3_fits',
      text: '3. Smaller third chunk content. '.repeat(25), // ~800 chars
      resourceId: 'r1',
      resourceName: 'SpecDoc.pdf',
      subjectId: 's1',
      pageNumber: 3,
      chunkIndex: 2,
      distance: 0.20,
      similarity: 0.80,
      metadata: { chunkId: 'chunk_spec_3_fits', pageNumber: 3 },
    },
    {
      chunkId: 'chunk_spec_4_fits',
      text: '4. Compact fourth chunk content. '.repeat(18), // ~600 chars
      resourceId: 'r1',
      resourceName: 'SpecDoc.pdf',
      subjectId: 's1',
      pageNumber: 4,
      chunkIndex: 3,
      distance: 0.25,
      similarity: 0.75,
      metadata: { chunkId: 'chunk_spec_4_fits', pageNumber: 4 },
    },
  ];

  const specSelection = selectOptimalContextChunks(specChunks, 4000);
  const selectedIds = specSelection.selectedChunks.map((sc) => sc.chunk.chunkId);

  assert(
    selectedIds.includes('chunk_spec_1') &&
      selectedIds.includes('chunk_spec_3_fits') &&
      selectedIds.includes('chunk_spec_4_fits'),
    '6.1 Smaller chunks (Chunk 3 and Chunk 4) are successfully included after oversized Chunk 2'
  );
  assert(
    !selectedIds.includes('chunk_spec_2_oversized'),
    '6.2 Oversized Chunk 2 was skipped without breaking the iteration loop'
  );
  assert(
    specSelection.totalChars <= 4000,
    `6.3 Total chars (${specSelection.totalChars}) strictly respects 4,000 budget`
  );

  // 7. Correct Behavior When All Chunks Exceed the Budget
  const allOversizedChunks = [
    {
      chunkId: 'huge_chunk_1',
      text: 'This is a detailed analysis of transport layer flow control. It uses sliding windows to regulate packet transmission. The receiver buffer capacity is advertised in segment headers. Congestion collapse is prevented under high network traffic load.',
      resourceId: 'r1',
      resourceName: 'Networks.pdf',
      subjectId: 's1',
      pageNumber: 14,
      chunkIndex: 0,
      distance: 0.10,
      similarity: 0.90,
      metadata: { chunkId: 'huge_chunk_1', pageNumber: 14 },
    },
    {
      chunkId: 'huge_chunk_2',
      text: 'Another giant chunk with extensive architectural explanations. It describes the slow start and congestion avoidance phases in detail.',
      resourceId: 'r1',
      resourceName: 'Networks.pdf',
      subjectId: 's1',
      pageNumber: 15,
      chunkIndex: 1,
      distance: 0.15,
      similarity: 0.85,
      metadata: { chunkId: 'huge_chunk_2', pageNumber: 15 },
    },
  ];

  // Budget is only 160 characters (smaller than either chunk with header)
  const smallBudget = 160;
  const allOversizedResult = selectOptimalContextChunks(allOversizedChunks, smallBudget);

  assert(
    allOversizedResult.selectedChunks.length === 1,
    '7.1 Context is not empty when all chunks exceed budget (top chunk is gracefully truncated)'
  );
  assert(
    allOversizedResult.totalChars <= smallBudget,
    `7.2 Truncated context fits within tight budget (${allOversizedResult.totalChars} <= ${smallBudget})`
  );
  assert(
    allOversizedResult.selectedChunks[0].isTruncated === true,
    '7.3 isTruncated flag marks truncated chunk'
  );

  // 8. Sentence-Boundary Truncation
  const sampleParagraph =
    'Transmission Control Protocol is reliable. It uses a three-way handshake to establish connections. Flow control uses sliding windows.';
  const truncatedSentence = truncateAtSentenceBoundary(sampleParagraph, 105);

  assert(
    truncatedSentence.truncated === true,
    '8.1 truncateAtSentenceBoundary sets truncated: true'
  );
  assert(
    truncatedSentence.text.endsWith('...'),
    '8.2 Truncated text ends with ellipsis'
  );
  assert(
    truncatedSentence.text.includes('establish connections.') ||
      truncatedSentence.text.includes('Protocol is reliable.'),
    `8.3 Text is cut at a clean sentence terminator rather than mid-word: "${truncatedSentence.text}"`
  );
  assert(
    !truncatedSentence.text.includes('establi...'),
    '8.4 Text is not cut in the middle of a word'
  );

  // 9. Multi-Page Page-Range Preservation
  const singlePageCitation = formatPageCitation(14);
  assert(
    singlePageCitation.headerTag === 'Page: 14' && singlePageCitation.label === 'p. 14',
    '9.1 Single-page chunk formats as "Page: 14" / "p. 14"'
  );

  const multiPageCitation = formatPageCitation(4, 5);
  assert(
    multiPageCitation.headerTag === 'Pages: 4–5' && multiPageCitation.label === 'pp. 4–5',
    '9.2 Multi-page chunk formats as "Pages: 4–5" / "pp. 4–5"'
  );

  // Test chunkDocument multi-page tracking
  const multiPageDocInput = {
    resourceId: 'res-multipage-doc',
    resourceName: 'MultiPageGuide.pdf',
    studentId: studentAlice,
    subjectId: 'cs-net-101',
    moduleId: 'mod-1',
    text: '--- Page 4 ---\nHere is the beginning of the concept on page four.\n\n--- Page 5 ---\nAnd here is the conclusion of the same concept on page five.',
  };

  const chunkedDoc = chunkDocument(multiPageDocInput, { chunkSizeTokens: 500 });
  assert(chunkedDoc.chunks.length > 0, '9.3 Document with page markers chunked successfully');
  const firstChunk = chunkedDoc.chunks[0];
  assert(typeof firstChunk.pageNumber === 'number', '9.4 Chunk has starting pageNumber');
  assert(firstChunk.pageNumber === 4, '9.5 Chunk starting page is 4');

  // 10. Citation Metadata Preservation
  const sampleCandidate = {
    chunkId: 'res-guide_chunk_0',
    text: 'Essential computer network concepts.',
    resourceId: 'res-guide',
    resourceName: 'Guide.pdf',
    subjectId: 'cs-net-301',
    moduleId: 'mod-transport',
    pageNumber: 8,
    pageEndNumber: 9,
    pageRange: '8–9',
    chunkIndex: 0,
    distance: 0.12,
    similarity: 0.88,
    metadata: {
      chunkId: 'res-guide_chunk_0',
      pageNumber: 8,
      pageEndNumber: 9,
      pageRange: '8–9',
    },
  };

  const selectionForMeta = selectOptimalContextChunks([sampleCandidate], 1000);
  const srcRef = selectionForMeta.validSources[0];

  assert(srcRef.chunkId === 'res-guide_chunk_0', '10.1 Preserved chunkId in citation');
  assert(srcRef.resourceId === 'res-guide', '10.2 Preserved resourceId in citation');
  assert(srcRef.resourceName === 'Guide.pdf', '10.3 Preserved resourceName in citation');
  assert(srcRef.pageNumber === 8, '10.4 Preserved starting pageNumber in citation');
  assert(srcRef.pageEndNumber === 9, '10.5 Preserved pageEndNumber in citation');
  assert(srcRef.pageRange === '8–9', '10.6 Preserved pageRange in citation');
  assert(srcRef.similarity === 0.88, '10.7 Preserved similarity in citation');
  assert(srcRef.subjectId === 'cs-net-301', '10.8 Preserved subjectId in citation');
  assert(srcRef.moduleId === 'mod-transport', '10.9 Preserved moduleId in citation');

  // =================================================================
  // SECTION B: LIVE RAG INTEGRATION & REGRESSION TESTS
  // =================================================================
  console.log('\n--- SECTION B: Live ChromaDB & Ollama Integration Tests ---');

  console.log(`Setting up isolated test collection: "${testCollection}"...`);
  await getOrCreateCollection(testCollection);

  const aliceChunks = [
    {
      chunkId: 'chunk_alice_tcp_overview_0',
      chunkIndex: 0,
      totalChunks: 2,
      pageNumber: 14,
      pageEndNumber: 15,
      pageRange: '14–15',
      tokenCount: 45,
      characterCount: 240,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-networks-pdf',
      resourceName: 'Computer Networks Transport.pdf',
      studentId: studentAlice,
      text: 'Transmission Control Protocol (TCP) is a connection-oriented transport layer protocol that provides reliable, ordered, and error-checked delivery of a stream of bytes between host computers. It uses a three-way handshake (SYN, SYN-ACK, ACK) to establish connections.',
    },
    // Duplicate chunk of overview (to verify live deduplication in RAG generation)
    {
      chunkId: 'chunk_alice_tcp_duplicate_1',
      chunkIndex: 1,
      totalChunks: 2,
      pageNumber: 14,
      pageEndNumber: 15,
      pageRange: '14–15',
      tokenCount: 45,
      characterCount: 240,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-networks-pdf',
      resourceName: 'Computer Networks Transport.pdf',
      studentId: studentAlice,
      text: 'Transmission Control Protocol (TCP) is a connection-oriented transport layer protocol that provides reliable, ordered, and error-checked delivery of a stream of bytes between host computers. It uses a three-way handshake (SYN, SYN-ACK, ACK) to establish connections.',
    },
    {
      chunkId: 'chunk_alice_db_acid_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 42,
      pageEndNumber: 42,
      tokenCount: 50,
      characterCount: 260,
      subjectId: 'cs-databases-201',
      moduleId: 'mod-transactions',
      resourceId: 'res-db-principles-pdf',
      resourceName: 'Database Principles.pdf',
      studentId: studentAlice,
      text: 'ACID transaction properties guarantee database consistency even during power failures: Atomicity ensures all operations succeed or all fail together; Consistency guarantees transition between valid states; Isolation ensures independent execution; Durability ensures updates persist permanently.',
    },
  ];

  const bobChunks = [
    {
      chunkId: 'chunk_bob_secret_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 1,
      pageEndNumber: 1,
      tokenCount: 30,
      characterCount: 140,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-bob-secret-pdf',
      resourceName: 'Bob Private Notes.pdf',
      studentId: studentBob,
      text: 'CONFIDENTIAL: Bob research lab TCP port is 9988. Not for public disclosure.',
    },
  ];

  const allChunks = [...aliceChunks, ...bobChunks];
  const embeddedChunks = [];

  for (const c of allChunks) {
    const prefixedText = formatNomicDocumentText(c.text);
    const embedRes = await generateEmbedding(prefixedText);
    embeddedChunks.push({
      ...c,
      embedding: embedRes.vector,
      metadata: {
        chunkId: c.chunkId,
        chunkIndex: c.chunkIndex,
        totalChunks: c.totalChunks,
        pageNumber: c.pageNumber,
        pageEndNumber: c.pageEndNumber,
        pageRange: c.pageRange,
        tokenCount: c.tokenCount,
        characterCount: c.characterCount,
        subjectId: c.subjectId,
        moduleId: c.moduleId,
        resourceId: c.resourceId,
        resourceName: c.resourceName,
        studentId: c.studentId,
        embeddingVersion: 'v2_nomic_prefix',
      },
    });
  }

  await addEmbeddedChunks(embeddedChunks, { collectionName: testCollection });
  console.log(`Indexed ${embeddedChunks.length} chunks into "${testCollection}".\n`);

  const networksScope = {
    subjectId: 'cs-networks-301',
    subjectName: 'Computer Networks',
    subjectCode: 'CS301',
    scopeMode: 'entire_subject',
    moduleIds: ['mod-transport'],
    moduleNames: ['Transport Layer'],
    totalModuleCount: 1,
  };

  try {
    // 11. Student and Module Filtering Regression
    const liveRagRes = await generateRagAnswer(
      'What is TCP and what three-way handshake does it use?',
      networksScope,
      studentAlice,
      { collectionName: testCollection }
    );

    assert(liveRagRes.status === 'success', '11.1 Live RAG answer generated with status: success');
    assert(liveRagRes.isGrounded === true, '11.2 Answer is verified grounded in study materials');
    assert(
      !liveRagRes.sources.some((s) => s.studentId === studentBob),
      '11.3 Multi-tenant isolation verified: Bob private chunks not accessible by Alice'
    );
    assert(
      liveRagRes.sources.every((s) => s.subjectId === 'cs-networks-301'),
      '11.4 All retrieved chunks strictly belong to requested subject'
    );

    // Live Deduplication Check: Alice's duplicate chunk was retrieved by Chroma but deduplicated by Stage 8.4!
    assert(
      liveRagRes.dedupRemovedCount !== undefined && liveRagRes.dedupRemovedCount >= 1,
      `11.5 Live duplicate chunk removed during context construction (dedupRemovedCount: ${liveRagRes.dedupRemovedCount})`
    );
    assert(
      liveRagRes.usedChunksCount === 1,
      `11.6 Only 1 unique chunk was sent to LLM context (usedChunksCount: ${liveRagRes.usedChunksCount})`
    );

    // Verify multi-page citation in live result
    const topCitation = liveRagRes.sources[0];
    assert(
      topCitation.pageNumber === 14 && topCitation.pageEndNumber === 15,
      '11.7 Multi-page citation preserved in live result (Pages 14–15)'
    );
    assert(
      topCitation.pageRange === '14–15',
      '11.8 Citation pageRange is formatted as "14–15"'
    );

    // 12. No-Context Behavior
    const noContextRes = await generateRagAnswer(
      'Explain relativistic thermodynamics in astrophysics.',
      networksScope,
      studentAlice,
      { collectionName: testCollection, minSimilarity: 0.50 }
    );

    assert(
      noContextRes.status === 'no_context',
      `12.1 Irrelevant topic returns status: no_context (got: ${noContextRes.status})`
    );
    assert(noContextRes.isGrounded === false, '12.2 isGrounded is false for missing context');
    assert(noContextRes.sources.length === 0, '12.3 Sources array is empty');
    assert(
      /no\s*relevant\s*passages|indexed\s*study\s*materials/i.test(noContextRes.answer),
      '12.4 Helpful refusal message provided without fabricating facts'
    );

    // 13. Similarity Threshold Regression
    assert(
      DEFAULT_RAG_MIN_SIMILARITY === 0.50,
      '13.1 Default RAG minimum similarity threshold is preserved at 0.50'
    );

    // 14. Conversation History and Query Condensation Regression
    const history14 = [
      {
        role: 'user',
        content: 'What is TCP?',
      },
      {
        role: 'assistant',
        content: 'TCP is a connection-oriented transport protocol that uses a three-way handshake.',
      },
    ];

    const followUpRes = await generateRagAnswer(
      'What handshake does it use to establish connections?',
      networksScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history14,
      }
    );

    assert(followUpRes.status === 'success', '14.1 Follow-up question with history executed successfully');
    assert(
      typeof followUpRes.condensedQuestion === 'string' &&
        /tcp|handshake/i.test(followUpRes.condensedQuestion),
      `14.2 Query condensation preserved in follow-up: "${followUpRes.condensedQuestion}"`
    );
    assert(
      /SYN|SYN-ACK|ACK/i.test(followUpRes.answer),
      '14.3 Follow-up grounded answer accurately explains three-way handshake'
    );
    assert(
      followUpRes.sources.some((s) => s.pageRange === '14–15' || s.pageNumber === 14),
      '14.4 Source citation with page range preserved across follow-up turns'
    );
  } finally {
    console.log(`\nCleaning up test collection: "${testCollection}"...`);
    try {
      await deleteCollection(testCollection);
      console.log('Test collection successfully deleted.');
    } catch (cleanupErr) {
      console.warn('Note: Could not delete test collection:', cleanupErr?.message);
    }
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`📊 STAGE 8.4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage84TestSuite().catch((err) => {
  console.error('\n❌ Unhandled error in Stage 8.4 test suite:', err);
  process.exit(1);
});
