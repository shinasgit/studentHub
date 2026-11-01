// scripts/test_stage_8_5.mjs
// Test Suite for Stage 8.5: Citation Verification & Reader Resilience
// Tests citation validation, evidence consistency, hallucination defense,
// deleted resource handling, storage URL resolution, and PDF reader resilience.

import {
  validateCitation,
  verifyCitationsAgainstEvidence,
  filterVerifiedCitations,
  extractInlineCitations,
  resolveCitationNavigation,
} from '../src/services/citationService.ts';
import {
  generateRagAnswer,
  buildRagPromptContext,
} from '../src/services/ragService.ts';
import {
  addEmbeddedChunks,
  deleteCollection,
  getOrCreateCollection,
} from '../src/services/chromaService.ts';
import { generateEmbedding } from '../src/services/embeddingService.ts';
import { formatNomicDocumentText } from '../src/services/documentEmbeddingService.ts';

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

async function runStage85Tests() {
  console.log('\n=============================================================');
  console.log('🧪 RAG STAGE 8.5: CITATION VERIFICATION & READER RESILIENCE');
  console.log('=============================================================\n');

  // =========================================================================
  // SECTION A: Structural Citation Validation Unit Tests
  // =========================================================================
  console.log('--- SECTION A: Citation Validation Unit Tests ---');

  // 1. Valid Citation
  const validCitation = {
    chunkId: 'res-net-101_chunk_0',
    resourceId: 'res-net-101',
    resourceName: 'ComputerNetworks_Transport.pdf',
    pageNumber: 14,
    pageEndNumber: 15,
    pageRange: '14–15',
    similarity: 0.88,
    distance: 0.12,
    subjectId: 'cs-networks-301',
    moduleId: 'mod-transport',
    studentId: 'student_alice_123',
    textSnippet: 'TCP provides reliable byte stream delivery.',
  };

  const v1 = validateCitation(validCitation, {
    expectedStudentId: 'student_alice_123',
    expectedSubjectId: 'cs-networks-301',
    expectedModuleIds: ['mod-transport', 'mod-network-layer'],
  });
  assert(v1.isValid === true, '1.1 Valid citation passes validation');
  assert(v1.errors.length === 0, '1.2 Valid citation has zero errors');
  assert(v1.sanitizedCitation?.isVerified === true, '1.3 Valid citation is marked verified');
  assert(v1.sanitizedCitation?.pageRange === '14–15', '1.4 Preserves page range: 14–15');

  // 2. Invalid Chunk ID
  const invalidChunkId = validateCitation({
    ...validCitation,
    chunkId: '',
  });
  assert(invalidChunkId.isValid === false, '2.1 Empty chunk ID fails validation');
  assert(
    invalidChunkId.errors.some((e) => e.includes('Chunk ID is required')),
    '2.2 Descriptive chunkId error message'
  );

  const missingChunkId = validateCitation({
    ...validCitation,
    chunkId: undefined,
  });
  assert(missingChunkId.isValid === false, '2.3 Undefined chunk ID fails validation');

  // 3. Invalid Resource ID
  const invalidResId = validateCitation({
    ...validCitation,
    resourceId: '   ',
  });
  assert(invalidResId.isValid === false, '3.1 Whitespace resource ID fails validation');
  assert(
    invalidResId.errors.some((e) => e.includes('Resource ID is required')),
    '3.2 Descriptive resourceId error message'
  );

  // 4. Missing Filename
  const missingFilename = validateCitation({
    ...validCitation,
    resourceName: '',
  });
  assert(missingFilename.isValid === false, '4.1 Empty filename fails validation');
  assert(
    missingFilename.errors.some((e) => e.includes('Resource filename is required')),
    '4.2 Descriptive filename error message'
  );

  // 5. Invalid Starting Page Numbers
  const zeroPage = validateCitation({ ...validCitation, pageNumber: 0 });
  assert(zeroPage.isValid === false, '5.1 Page 0 fails validation');

  const negativePage = validateCitation({ ...validCitation, pageNumber: -4 });
  assert(negativePage.isValid === false, '5.2 Negative page number fails validation');

  const nanPage = validateCitation({ ...validCitation, pageNumber: NaN });
  assert(nanPage.isValid === false, '5.3 NaN page number fails validation');

  const floatPage = validateCitation({ ...validCitation, pageNumber: 3.14 });
  assert(floatPage.isValid === false, '5.4 Non-integer page number fails validation');

  // 6. Multi-Page Citations Validation
  const invertedRange = validateCitation({
    ...validCitation,
    pageNumber: 15,
    pageEndNumber: 14,
  });
  assert(invertedRange.isValid === false, '6.1 Inverted page range (15 to 14) fails validation');
  assert(
    invertedRange.errors.some((e) => e.includes('cannot be less than starting page')),
    '6.2 Descriptive inverted page range error message'
  );

  const singlePageValid = validateCitation({
    ...validCitation,
    pageNumber: 7,
    pageEndNumber: undefined,
    pageRange: undefined,
  });
  assert(singlePageValid.isValid === true, '6.3 Single page citation is valid');
  assert(singlePageValid.sanitizedCitation?.pageRange === '7', '6.4 Single page formats pageRange as "7"');

  // 7. Student ID Isolation Validation (Cross-Tenant Guard)
  const tenantMismatch = validateCitation(
    { ...validCitation, studentId: 'student_bob_999' },
    { expectedStudentId: 'student_alice_123' }
  );
  assert(tenantMismatch.isValid === false, '7.1 Cross-tenant studentId mismatch rejected');
  assert(
    tenantMismatch.errors.some((e) => e.includes('Tenant isolation violation')),
    '7.2 Descriptive tenant isolation error message'
  );

  // 8. Subject and Module Scope Validation
  const subjectMismatch = validateCitation(
    { ...validCitation, subjectId: 'cs-dbms-201' },
    { expectedSubjectId: 'cs-networks-301' }
  );
  assert(subjectMismatch.isValid === false, '8.1 Mismatched subject scope rejected');

  const moduleMismatch = validateCitation(
    { ...validCitation, moduleId: 'mod-unrelated-math' },
    {
      expectedSubjectId: 'cs-networks-301',
      expectedModuleIds: ['mod-transport', 'mod-network-layer'],
    }
  );
  assert(moduleMismatch.isValid === false, '8.2 Module outside selected scope rejected');

  // =========================================================================
  // SECTION B: Citation-to-Source Consistency & Evidence Grounding
  // =========================================================================
  console.log('\n--- SECTION B: Citation-to-Source Consistency ---');

  const mockRetrievedChunks = [
    {
      chunkId: 'res-tcp_chunk_0',
      resourceId: 'res-tcp',
      resourceName: 'TCP_Specification.pdf',
      pageNumber: 14,
      pageEndNumber: 15,
      pageRange: '14–15',
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      similarity: 0.86,
      distance: 0.14,
      chunkIndex: 0,
      text: 'Transmission Control Protocol provides connection-oriented streams.',
      metadata: {
        studentId: 'student_alice_123',
        resourceId: 'res-tcp',
        resourceName: 'TCP_Specification.pdf',
        pageNumber: 14,
        pageEndNumber: 15,
        pageRange: '14–15',
        subjectId: 'cs-networks-301',
        moduleId: 'mod-transport',
        chunkIndex: 0,
        totalChunks: 1,
        characterCount: 68,
        tokenCount: 15,
        embeddingVersion: 'v2_nomic_prefix',
      },
    },
    {
      chunkId: 'res-udp_chunk_1',
      resourceId: 'res-udp',
      resourceName: 'UDP_Overview.pdf',
      pageNumber: 3,
      pageEndNumber: 3,
      pageRange: '3',
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      similarity: 0.75,
      distance: 0.25,
      chunkIndex: 1,
      text: 'User Datagram Protocol provides connectionless datagram delivery.',
      metadata: {
        studentId: 'student_alice_123',
        resourceId: 'res-udp',
        resourceName: 'UDP_Overview.pdf',
        pageNumber: 3,
        pageEndNumber: 3,
        pageRange: '3',
        subjectId: 'cs-networks-301',
        moduleId: 'mod-transport',
        chunkIndex: 1,
        totalChunks: 2,
        characterCount: 65,
        tokenCount: 14,
        embeddingVersion: 'v2_nomic_prefix',
      },
    },
  ];

  // 9. Citation Matching Retrieved Evidence
  const validCandidate = {
    chunkId: 'res-tcp_chunk_0',
    resourceId: 'res-tcp',
    resourceName: 'TCP_Specification.pdf',
    pageNumber: 14,
    pageEndNumber: 15,
    pageRange: '14–15',
    similarity: 0.86,
    distance: 0.14,
    subjectId: 'cs-networks-301',
    moduleId: 'mod-transport',
    studentId: 'student_alice_123',
  };

  const verifiedList = verifyCitationsAgainstEvidence(
    [validCandidate],
    mockRetrievedChunks,
    { expectedStudentId: 'student_alice_123' }
  );

  assert(verifiedList.length === 1, '9.1 Verified citations array length is 1');
  assert(verifiedList[0].isVerified === true, '9.2 Genuine chunk citation marked isVerified: true');
  assert(verifiedList[0].validationError === undefined, '9.3 Genuine citation has no validation error');
  assert(verifiedList[0].pageRange === '14–15', '9.4 Multi-page range preserved on verified citation');

  // 10. Hallucinated / Non-Existent Chunk ID
  const fakeChunkCandidate = {
    chunkId: 'hallucinated_chunk_999',
    resourceId: 'res-tcp',
    resourceName: 'TCP_Specification.pdf',
    pageNumber: 14,
    similarity: 0.86,
    distance: 0.14,
  };

  const fakeChunkResult = verifyCitationsAgainstEvidence(
    [fakeChunkCandidate],
    mockRetrievedChunks
  );
  assert(fakeChunkResult[0].isVerified === false, '10.1 Hallucinated chunk ID rejected');
  assert(
    fakeChunkResult[0].validationError?.includes('does not correspond to any retrieved evidence'),
    '10.2 Explanatory error for non-retrieved chunk'
  );

  // 11. Page Number Mismatch from Actual Chunk
  const wrongPageCandidate = {
    chunkId: 'res-tcp_chunk_0',
    resourceId: 'res-tcp',
    resourceName: 'TCP_Specification.pdf',
    pageNumber: 99, // Chunk is actually on page 14
    similarity: 0.86,
    distance: 0.14,
  };

  const wrongPageResult = verifyCitationsAgainstEvidence(
    [wrongPageCandidate],
    mockRetrievedChunks
  );
  assert(wrongPageResult[0].isVerified === false, '11.1 Fabricated page number rejected');
  assert(
    wrongPageResult[0].validationError?.includes('does not match retrieved evidence chunk pageNumber'),
    '11.2 Error specifies page mismatch'
  );

  // 12. filterVerifiedCitations
  const mixedList = [
    { ...validCandidate, isVerified: true },
    { ...fakeChunkCandidate, isVerified: false },
    {
      chunkId: 'res-udp_chunk_1',
      resourceId: 'res-udp',
      resourceName: 'UDP_Overview.pdf',
      pageNumber: 3,
      similarity: 0.75,
      distance: 0.25,
      isVerified: true,
    },
  ];

  const onlyVerified = filterVerifiedCitations(mixedList);
  assert(onlyVerified.length === 2, '12.1 filterVerifiedCitations returned exactly 2 verified citations');
  assert(onlyVerified.every((c) => c.isVerified === true), '12.2 All returned citations are verified');

  // 13. Inline Citation Extraction
  const sampleLLMText =
    'According to [TCP_Specification.pdf - Page 14], TCP uses a three-way handshake. Furthermore, [UDP_Overview.pdf, pp. 3-4] states that UDP is connectionless.';
  const extracted = extractInlineCitations(sampleLLMText);

  assert(extracted.length === 2, '13.1 Extracted 2 inline citations from text');
  assert(extracted[0].filename === 'TCP_Specification.pdf', '13.2 Extracted filename 1');
  assert(extracted[0].pageNumber === 14, '13.3 Extracted page number 1');
  assert(extracted[1].filename === 'UDP_Overview.pdf', '13.4 Extracted filename 2');
  assert(extracted[1].pageNumber === 3, '13.5 Extracted start page 2');
  assert(extracted[1].pageEndNumber === 4, '13.6 Extracted end page 2');

  // =========================================================================
  // SECTION C: PDF Reader Resilience & Citation Navigation
  // =========================================================================
  console.log('\n--- SECTION C: PDF Reader Resilience & Navigation ---');

  // 14. Ready Navigation with Valid Resource & Storage Key
  const mockValidResource = {
    id: 'res-tcp',
    userId: 'student_alice_123',
    subjectId: 'cs-networks-301',
    moduleId: 'mod-transport',
    title: 'TCP_Specification.pdf',
    type: 'pdf',
    url: '',
    fileStorageKey: 'vault_tcp_key',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const navReady = await resolveCitationNavigation(
    'student_alice_123',
    validCandidate,
    {
      getResourceFn: async () => mockValidResource,
      getFileUrlFn: async (key) => (key === 'vault_tcp_key' ? 'blob:http://localhost/mock-blob-url' : null),
    }
  );

  assert(navReady.status === 'ready', '14.1 Status is "ready" when file resolves');
  assert(navReady.resolvedUrl === 'blob:http://localhost/mock-blob-url', '14.2 Resolved URL provided');
  assert(navReady.pageNumber === 14, '14.3 Preserved cited pageNumber: 14');
  assert(navReady.pageEndNumber === 15, '14.4 Preserved pageEndNumber: 15');
  assert(navReady.pageRange === '14–15', '14.5 Preserved pageRange: "14–15"');

  // 15. Deleted Resource Handling
  const navDeleted = await resolveCitationNavigation(
    'student_alice_123',
    validCandidate,
    {
      getResourceFn: async () => null, // Resource deleted from Firestore
    }
  );

  assert(navDeleted.status === 'deleted', '15.1 Deleted resource identified with status: "deleted"');
  assert(navDeleted.errorTitle === 'Study Document Not Found', '15.2 Friendly error title provided');
  assert(
    navDeleted.errorMessage?.includes('is no longer available in your study library'),
    '15.3 Helpful message explaining resource was deleted/moved'
  );
  assert(navDeleted.pageNumber === 14, '15.4 Citation page preserved for display on error screen');

  // 16. Missing PDF URL Handling
  const mockResourceNoUrl = {
    ...mockValidResource,
    url: '',
    fileStorageKey: null,
  };

  const navMissingUrl = await resolveCitationNavigation(
    'student_alice_123',
    validCandidate,
    {
      getResourceFn: async () => mockResourceNoUrl,
      getFileUrlFn: async () => null,
    }
  );

  assert(navMissingUrl.status === 'missing_url', '16.1 Missing URL identified with status: "missing_url"');
  assert(navMissingUrl.errorTitle === 'Document File Unavailable', '16.2 Appropriate error title');
  assert(
    navMissingUrl.errorMessage?.includes('No file link or storage record was found'),
    '16.3 Explanatory guidance message'
  );

  // 17. Expired or Inaccessible Storage Key Handling
  const navInaccessible = await resolveCitationNavigation(
    'student_alice_123',
    validCandidate,
    {
      getResourceFn: async () => mockValidResource,
      getFileUrlFn: async () => {
        throw new Error('IndexedDB vault transaction aborted: QuotaExceeded');
      },
    }
  );

  assert(
    navInaccessible.status === 'missing_url' || navInaccessible.status === 'error',
    '17.1 Inaccessible storage fails gracefully without crashing application'
  );

  // 18. Invalid Page Number Fallback
  const badPageCandidate = {
    ...validCandidate,
    pageNumber: 0,
  };

  const navBadPage = await resolveCitationNavigation(
    'student_alice_123',
    badPageCandidate,
    {
      getResourceFn: async () => mockValidResource,
      getFileUrlFn: async () => 'http://example.com/doc.pdf',
    }
  );

  assert(navBadPage.pageNumber === 1, '18.1 Invalid page 0 safely defaulted to page 1');

  // 19. Missing Resource ID Citation
  const noResIdCandidate = {
    ...validCandidate,
    resourceId: '',
  };

  const navNoResId = await resolveCitationNavigation(
    'student_alice_123',
    noResIdCandidate
  );
  assert(navNoResId.status === 'invalid_citation', '19.1 Missing resource ID returns status: "invalid_citation"');

  // 20. Database Network Exception Resilience
  const navDbError = await resolveCitationNavigation(
    'student_alice_123',
    validCandidate,
    {
      getResourceFn: async () => {
        throw new Error('Firestore unavailable: Network timeout');
      },
    }
  );

  assert(navDbError.status === 'error', '20.1 Database network error returns status: "error"');
  assert(
    navDbError.errorTitle === 'Error Accessing Study Resource',
    '20.2 Friendly connection error title'
  );

  // =========================================================================
  // SECTION D: Live End-to-End RAG Pipeline Citation Verification
  // =========================================================================
  console.log('\n--- SECTION D: Live ChromaDB & Ollama Pipeline Integration ---');

  const testCollectionName = `test_stage85_${Date.now()}`;
  console.log(`Setting up isolated test collection: "${testCollectionName}"...`);
  await getOrCreateCollection(testCollectionName);

  // Index real document chunk into ChromaDB
  const sampleDocChunks = [
    {
      chunkId: 'chunk_alice_dns_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 8,
      pageEndNumber: 9,
      pageRange: '8–9',
      tokenCount: 38,
      characterCount: 168,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-application-layer',
      resourceId: 'res-dns-module',
      resourceName: 'ComputerNetworks_DNS.pdf',
      studentId: 'student_alice_123',
      text: 'The Domain Name System (DNS) translates human-readable hostnames like www.example.com into IP addresses like 93.184.216.34. DNS operates primarily over UDP port 53.',
    },
  ];

  const prefixedText = formatNomicDocumentText(sampleDocChunks[0].text);
  const embResult = await generateEmbedding(prefixedText);

  await addEmbeddedChunks(
    [
      {
        ...sampleDocChunks[0],
        embedding: embResult.vector,
        metadata: {
          ...sampleDocChunks[0],
          embeddingVersion: 'v2_nomic_prefix',
        },
      },
    ],
    { collectionName: testCollectionName }
  );
  console.log(`Indexed sample DNS chunk into "${testCollectionName}".`);

  // Run live RAG answer generation
  const liveRagResult = await generateRagAnswer(
    'What is DNS and what does it do?',
    {
      subjectId: 'cs-networks-301',
      subjectName: 'Computer Networks',
      scopeMode: 'entire_subject',
      moduleIds: [],
      moduleNames: [],
      totalModuleCount: 5,
    },
    'student_alice_123',
    {
      collectionName: testCollectionName,
      temperature: 0.2,
      minSimilarity: 0.5,
    }
  );

  assert(liveRagResult.status === 'success', '21.1 Live RAG answer generated successfully');
  assert(liveRagResult.isGrounded === true, '21.2 Live RAG answer marked isGrounded: true');
  assert(liveRagResult.sources.length === 1, '21.3 Exactly 1 source cited');
  assert(liveRagResult.sources[0].isVerified === true, '21.4 Live citation is marked isVerified: true');
  assert(liveRagResult.sources[0].resourceName === 'ComputerNetworks_DNS.pdf', '21.5 Preserved resource filename');
  assert(liveRagResult.sources[0].pageNumber === 8, '21.6 Preserved start page: 8');
  assert(liveRagResult.sources[0].pageEndNumber === 9, '21.7 Preserved end page: 9');
  assert(liveRagResult.sources[0].pageRange === '8–9', '21.8 Preserved pageRange: "8–9"');
  assert(liveRagResult.verifiedSourcesCount === 1, '21.9 verifiedSourcesCount is 1');
  assert(liveRagResult.unverifiedCitationsCount === 0, '21.10 unverifiedCitationsCount is 0');

  // Cleanup test collection
  console.log(`\nCleaning up test collection: "${testCollectionName}"...`);
  await deleteCollection(testCollectionName);
  console.log('Test collection successfully deleted.');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n=============================================================');
  console.log(`📊 STAGE 8.5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage85Tests().catch((err) => {
  console.error('Fatal error during Stage 8.5 tests:', err);
  process.exit(1);
});
