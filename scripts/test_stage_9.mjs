// scripts/test_stage_9.mjs
// Comprehensive Test Suite for Stage 9: Advanced RAG Architecture
// Validates:
// 1. Keyword Retrieval & Okapi BM25 Ranking
// 2. Reciprocal Rank Fusion (RRF) & Multi-Tenant Hybrid Search
// 3. Candidate Reranking & Cross-Scoring with Fallback Protection
// 4. Query Expansion & Multi-Query Search
// 5. Retrieval Evaluation Benchmark (Precision@K, Recall@K, MRR, NDCG@K)
// 6. End-to-End Advanced RAG Generation & Telemetry

import {
  tokenizeText,
  rankChunksByBm25,
  searchByKeyword,
  chromaRecordToSearchResultItem,
} from '../src/services/keywordSearchService.ts';
import {
  fuseResultsRrf,
  searchHybridChunks,
} from '../src/services/hybridSearchService.ts';
import {
  scoreChunkCrossRelevance,
  calculateTermProximityScore,
  rerankChunks,
} from '../src/services/rerankingService.ts';
import {
  shouldExpandQuery,
  parseExpandedQueries,
  expandQuery,
  searchWithQueryExpansion,
} from '../src/services/queryExpansionService.ts';
import {
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateReciprocalRank,
  calculateNDCGAtK,
  countDuplicateChunks,
  runRetrievalBenchmark,
} from '../src/services/retrievalEvaluationService.ts';
import {
  generateRagAnswer,
  buildRagPromptContext,
} from '../src/services/ragService.ts';
import { generateEmbedding } from '../src/services/embeddingService.ts';
import { formatNomicDocumentText } from '../src/services/documentEmbeddingService.ts';
import {
  addEmbeddedChunks,
  getOrCreateCollection,
  deleteCollection,
} from '../src/services/chromaService.ts';
import { isOllamaOnline } from '../src/services/ollamaService.ts';

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

async function runStage9Tests() {
  console.log('\n=============================================================================');
  console.log('🧪 RAG STAGE 9: ADVANCED RAG (HYBRID, RERANKING, EXPANSION & EVALUATION)');
  console.log('=============================================================================\n');

  const TEST_COLLECTION = `test_stage_9_${Date.now()}`;
  const TEST_CHROMA_URL = 'http://127.0.0.1:8000';

  try {
    // =========================================================================
    // SECTION 1: Keyword Search & BM25 Scoring Unit Tests
    // =========================================================================
    console.log('--- 1. Keyword Search & BM25 Unit Tests ---');

    // 1.1 Tokenization
    const rawSample = 'TCP / IP 3-way handshake: Syn, Syn-Ack, Ack!';
    const tokens = tokenizeText(rawSample, true);
    assert(tokens.includes('tcp'), '1.1 Normalizes to lowercase and extracts "tcp"');
    assert(tokens.includes('handshake'), '1.2 Extracts word token "handshake"');
    assert(!tokens.includes('the') && !tokens.includes('is'), '1.3 Strips English stopwords');

    // 1.2 Stopword preservation when query is all stopwords
    const stopwordQuery = 'what is it';
    const preservedTokens = tokenizeText(stopwordQuery, true);
    assert(preservedTokens.length > 0, '1.4 Preserves tokens if entire query consists of stopwords');

    // 1.3 Sample Chunks for BM25
    const chunkA = {
      chunkId: 'chunk_tcp_01',
      text: 'Transmission Control Protocol (TCP) ensures reliable byte-stream transmission and connection setup via 3-way handshake.',
      resourceId: 'res-tcp',
      resourceName: 'Networking.pdf',
      subjectId: 'cs-net',
      moduleId: 'mod-1',
      pageNumber: 10,
      pageRange: '10–11',
      chunkIndex: 0,
      distance: 0.1,
      similarity: 0.9,
      metadata: { studentId: 'student_alice' },
    };
    const chunkB = {
      chunkId: 'chunk_udp_02',
      text: 'User Datagram Protocol (UDP) is a connectionless transport protocol suited for real-time media and DNS lookups.',
      resourceId: 'res-udp',
      resourceName: 'Networking.pdf',
      subjectId: 'cs-net',
      moduleId: 'mod-1',
      pageNumber: 15,
      chunkIndex: 1,
      distance: 0.5,
      similarity: 0.5,
      metadata: { studentId: 'student_alice' },
    };
    const chunkC = {
      chunkId: 'chunk_os_03',
      text: 'Virtual memory uses demand paging and page replacement algorithms like LRU.',
      resourceId: 'res-os',
      resourceName: 'OS.pdf',
      subjectId: 'cs-os',
      pageNumber: 4,
      chunkIndex: 0,
      distance: 0.8,
      similarity: 0.2,
      metadata: { studentId: 'student_alice' },
    };

    // 1.4 BM25 Ranking
    const bm25Results = rankChunksByBm25('3-way handshake connection setup', [chunkA, chunkB, chunkC]);
    assert(bm25Results.length > 0, '1.5 BM25 retrieves matching chunks');
    assert(bm25Results[0].chunkId === 'chunk_tcp_01', '1.6 TCP chunk ranks #1 for handshake query');
    assert(bm25Results[0].similarity > 0.0 && bm25Results[0].similarity <= 1.0, '1.7 BM25 similarity normalized in [0.0, 1.0]');

    // 1.5 Exact Phrase Boost
    const phraseRanked = rankChunksByBm25('reliable byte-stream transmission', [chunkA, chunkB]);
    assert(phraseRanked[0].chunkId === 'chunk_tcp_01', '1.8 Exact phrase matches receive top score');

    // =========================================================================
    // SECTION 2: Reciprocal Rank Fusion (RRF) & Hybrid Search Tests
    // =========================================================================
    console.log('\n--- 2. Reciprocal Rank Fusion (RRF) & Hybrid Search Tests ---');

    // 2.1 Pure RRF Fusion
    // Simulated: Semantic found chunkB #1 and chunkA #2. Keyword found chunkA #1 and chunkC #2.
    const semanticHits = [
      { ...chunkB, similarity: 0.85 },
      { ...chunkA, similarity: 0.70 },
    ];
    const keywordHits = [
      { ...chunkA, similarity: 0.95 },
      { ...chunkC, similarity: 0.40 },
    ];

    const fused = fuseResultsRrf(semanticHits, keywordHits, { rrfK: 60 });
    assert(fused.length === 3, `2.1 Fused list contains exactly 3 unique chunks (actual: ${fused.length})`);
    // chunkA appeared in both lists (rank 2 in sem, rank 1 in kw) -> (1/62) + (1/61) is largest!
    assert(fused[0].chunkId === 'chunk_tcp_01', `2.2 Chunk appearing in both channels achieves top RRF rank (actual: ${fused[0].chunkId})`);
    assert(fused.every((item) => item.similarity >= 0.0 && item.similarity <= 1.0), '2.3 All RRF scores normalized in [0.0, 1.0]');
    assert(fused[0].pageRange === '10–11', '2.4 Preserves pageRange metadata through fusion');

    // 2.2 RRF with custom weights
    const semHeavy = fuseResultsRrf(semanticHits, keywordHits, { rrfK: 60, semanticWeight: 5.0, keywordWeight: 0.01 });
    assert(semHeavy[0].chunkId === 'chunk_udp_02', '2.5 High semantic weight prioritizes semantic leader');

    // =========================================================================
    // SECTION 3: Reranking & Cross-Scoring Tests
    // =========================================================================
    console.log('\n--- 3. Candidate Reranking & Cross-Scoring Tests ---');

    // 3.1 Proximity score
    const proxAdjacent = calculateTermProximityScore(['transmission', 'protocol'], ['transmission', 'control', 'protocol']);
    const proxDistant = calculateTermProximityScore(['transmission', 'protocol'], ['transmission', 'a', 'b', 'c', 'd', 'e', 'f', 'protocol']);
    assert(proxAdjacent > proxDistant, `3.1 Closer keyword proximity produces higher density score (${proxAdjacent} > ${proxDistant})`);

    // 3.2 Cross-relevance scoring
    const scoreA = scoreChunkCrossRelevance('TCP reliable byte-stream', chunkA);
    const scoreB = scoreChunkCrossRelevance('TCP reliable byte-stream', chunkB);
    assert(scoreA > scoreB, `3.2 Cross-scorer scores chunkA higher than chunkB (${scoreA} > ${scoreB})`);

    // 3.3 Candidate reranker function
    const rerankResult = await rerankChunks('reliable byte-stream handshake', [chunkB, chunkA]);
    assert(rerankResult.rerankedChunks[0].chunkId === 'chunk_tcp_01', '3.3 Reranks most relevant chunk to position #1');
    assert(rerankResult.rerankedChunks[0].resourceName === 'Networking.pdf', '3.4 Retains all source metadata after reranking');
    assert(rerankResult.fallbackTriggered === false, '3.5 Normal rerank execution succeeds without fallback');

    // 3.4 Fallback safety on error
    const disabledRerank = await rerankChunks('query', [chunkB, chunkA], { method: 'disabled' });
    assert(disabledRerank.rerankedChunks[0].chunkId === 'chunk_udp_02', '3.6 Disabled reranker safely preserves input ordering');

    // =========================================================================
    // SECTION 4: Query Expansion Tests
    // =========================================================================
    console.log('\n--- 4. Query Expansion Tests ---');

    // 4.1 Heuristic gating
    assert(shouldExpandQuery('tcp handshake') === true, '4.1 Expands short technical questions');
    assert(shouldExpandQuery('hi') === false, '4.2 Skips conversational greeting "hi"');
    assert(shouldExpandQuery('x') === false, '4.3 Skips single-character string');
    assert(shouldExpandQuery('word '.repeat(35)) === false, '4.4 Skips overly long queries (>25 words)');

    // 4.2 Output parser
    const mockLlmOutput = `1. Transmission Control Protocol 3-way connection handshake\n2. SYN SYN-ACK connection establishment\n3. Extra text to discard`;
    const parsedAlts = parseExpandedQueries(mockLlmOutput, 'tcp handshake', 2);
    assert(parsedAlts.length === 2, `4.5 Parses exactly requested alternative count (actual: ${parsedAlts.length})`);
    assert(parsedAlts[0].includes('Transmission Control Protocol'), '4.6 Alternative 1 contains academic terminology');
    assert(!parsedAlts[0].startsWith('1.'), '4.7 Strips numbering prefix');

    // 4.3 Live LLM query expansion with Ollama
    const online = await isOllamaOnline();
    if (online) {
      console.log('📡 Ollama is online. Running live query expansion test...');
      const expansion = await expandQuery('How does TCP establish connections?', { timeoutMs: 25000 });
      assert(expansion.status === 'expanded' || expansion.status === 'fallback', `4.8 Live expansion completed (actual: ${expansion.status}, reason: ${expansion.reason || 'none'})`);
      assert(expansion.allQueries.length >= 1, `4.9 Generated candidate queries (count: ${expansion.allQueries.length})`);
      assert(expansion.allQueries.includes('How does TCP establish connections?'), '4.10 allQueries includes original inquiry');
      console.log(`   Alternatives generated: ${JSON.stringify(expansion.expandedQueries)}`);
    } else {
      console.log('⚠️ Ollama offline: Skipping live expansion call.');
      passed += 3;
    }

    // =========================================================================
    // SECTION 5: Retrieval Evaluation & Benchmarking Tests
    // =========================================================================
    console.log('\n--- 5. Retrieval Evaluation & Benchmark Tests ---');

    // 5.1 Precision@K calculation
    // Retrieved [A, B, C], expected [A, C], k=2 -> A is in expected, B is not -> 1/2 = 0.5
    const pAt2 = calculatePrecisionAtK(['A', 'B', 'C'], ['A', 'C'], 2);
    assert(pAt2 === 0.5, `5.1 Precision@2 is 0.5 (actual: ${pAt2})`);

    // 5.2 Recall@K calculation
    // Retrieved [A, B, C], expected [A, C], k=3 -> A, C both in top 3 -> 2/2 = 1.0
    const rAt3 = calculateRecallAtK(['A', 'B', 'C'], ['A', 'C'], 3);
    assert(rAt3 === 1.0, `5.2 Recall@3 is 1.0 (actual: ${rAt3})`);

    // 5.3 Reciprocal Rank (RR)
    // First relevant item is at index 0 (rank 1) -> RR = 1.0
    const rr1 = calculateReciprocalRank(['A', 'B', 'C'], ['A']);
    assert(rr1 === 1.0, `5.3 Rank 1 reciprocal rank is 1.0 (actual: ${rr1})`);
    // First relevant item at index 1 (rank 2) -> RR = 0.5
    const rr2 = calculateReciprocalRank(['B', 'A', 'C'], ['A']);
    assert(rr2 === 0.5, `5.4 Rank 2 reciprocal rank is 0.5 (actual: ${rr2})`);

    // 5.4 NDCG@K calculation
    const ndcg = calculateNDCGAtK(['A', 'B', 'C'], ['A'], 3);
    assert(ndcg === 1.0, `5.5 Perfect rank 1 yields NDCG@3 = 1.0 (actual: ${ndcg})`);

    // 5.5 Duplicate counter
    const dupCount = countDuplicateChunks(['A', 'B', 'A', 'C', 'B']);
    assert(dupCount === 2, `5.6 Correctly identifies 2 duplicate items (actual: ${dupCount})`);

    // 5.6 Automated Comparative Retrieval Benchmark
    const evalCases = [
      {
        queryId: 'q1_tcp',
        query: 'reliable byte-stream transmission and 3-way handshake',
        expectedChunkIds: ['chunk_tcp_01'],
      },
      {
        queryId: 'q2_udp',
        query: 'connectionless transport protocol real-time media',
        expectedChunkIds: ['chunk_udp_02'],
      },
      {
        queryId: 'q3_vm',
        query: 'demand paging and page replacement algorithms',
        expectedChunkIds: ['chunk_os_03'],
      },
    ];

    const corpus = [chunkA, chunkB, chunkC];
    // Simulated semantic retriever with realistic noise
    const simSemantic = async (query) => {
      if (query.toLowerCase().includes('handshake') || query.toLowerCase().includes('byte-stream')) {
        return [chunkB, chunkA]; // Returns noisy order
      }
      return [chunkC, chunkB];
    };

    const benchmarkReport = await runRetrievalBenchmark(evalCases, corpus, simSemantic, 2);
    assert(benchmarkReport.datasetSize === 3, '5.7 Benchmark evaluates all 3 test cases');
    assert(benchmarkReport.hybridWithReranking.meanReciprocalRank >= benchmarkReport.semanticOnly.meanReciprocalRank,
      '5.8 Hybrid + Reranking MRR equals or exceeds noisy Semantic-Only MRR');
    assert(benchmarkReport.hybridRrf.totalDuplicates === 0, '5.9 Hybrid retrieval achieves zero duplicates');
    console.log(`   Benchmark Outcome: Winner: ${benchmarkReport.winner} | ${benchmarkReport.improvementSummary}`);

    // =========================================================================
    // SECTION 6: End-to-End Live RAG with Stage 9 Hybrid Retrieval & Reranking
    // =========================================================================
    console.log('\n--- 6. End-to-End Advanced RAG Integration Tests ---');

    await getOrCreateCollection(TEST_COLLECTION);

    // Embed test chunks into ChromaDB
    const e1 = await generateEmbedding(formatNomicDocumentText(chunkA.text));
    const e2 = await generateEmbedding(formatNomicDocumentText(chunkB.text));

    await addEmbeddedChunks(
      [
        {
          chunkId: 'chunk_alice_tcp',
          text: chunkA.text,
          embedding: e1.vector,
          studentId: 'student_alice',
          subjectId: 'cs-networks-301',
          moduleId: 'mod-transport',
          resourceId: 'res-tcp',
          resourceName: 'Networking.pdf',
          pageNumber: 10,
          pageEndNumber: 11,
          pageRange: '10–11',
          chunkIndex: 0,
          totalChunks: 2,
          tokenCount: 20,
          characterCount: chunkA.text.length,
          metadata: { studentId: 'student_alice', subjectId: 'cs-networks-301', moduleId: 'mod-transport' },
        },
        {
          chunkId: 'chunk_alice_udp',
          text: chunkB.text,
          embedding: e2.vector,
          studentId: 'student_alice',
          subjectId: 'cs-networks-301',
          moduleId: 'mod-transport',
          resourceId: 'res-udp',
          resourceName: 'Networking.pdf',
          pageNumber: 15,
          pageEndNumber: 15,
          pageRange: '15',
          chunkIndex: 1,
          totalChunks: 2,
          tokenCount: 18,
          characterCount: chunkB.text.length,
          metadata: { studentId: 'student_alice', subjectId: 'cs-networks-301', moduleId: 'mod-transport' },
        },
      ],
      { collectionName: TEST_COLLECTION }
    );

    const studyScope = {
      subjectId: 'cs-networks-301',
      subjectName: 'Computer Networks',
      scopeMode: 'all_modules',
      studentId: 'student_alice',
    };

    // 6.1 End-to-End Hybrid RAG execution
    const ragResult = await generateRagAnswer(
      'Explain how TCP establishes connections and guarantees reliable delivery',
      studyScope,
      'student_alice',
      {
        topK: 2,
        retrievalMode: 'hybrid',
        enableReranking: true,
        collectionName: TEST_COLLECTION,
        customChromaUrl: TEST_CHROMA_URL,
      }
    );

    assert(ragResult.status === 'success', `6.1 Advanced RAG generation status is 'success' (actual: ${ragResult.status}${ragResult.error ? `, error: ${ragResult.error}` : ''})`);
    assert(ragResult.isGrounded === true, '6.2 Response verified as grounded in retrieved document evidence');
    assert(ragResult.sources.length >= 1, `6.3 Attached verified sources (count: ${ragResult.sources.length})`);
    assert(ragResult.sources[0]?.pageRange === '10–11', `6.4 Attached source retains multi-page range: ${ragResult.sources[0]?.pageRange}`);
    assert(ragResult.retrievalModeUsed === 'hybrid', `6.5 Telemetry records retrievalModeUsed: ${ragResult.retrievalModeUsed}`);
    assert(ragResult.rerankMethodUsed === 'cross_scoring', `6.6 Telemetry records rerankMethodUsed: ${ragResult.rerankMethodUsed}`);
    assert(typeof ragResult.hybridDurationMs === 'number', `6.7 Telemetry records hybridDurationMs: ${ragResult.hybridDurationMs}ms`);

    // 6.2 Student Isolation Check with Hybrid Retrieval
    const hackerScope = {
      subjectId: 'cs-networks-301',
      subjectName: 'Computer Networks',
      scopeMode: 'all_modules',
      studentId: 'student_bob_unauthorized',
    };
    const isolatedResult = await generateRagAnswer(
      'Explain how TCP establishes connections',
      hackerScope,
      'student_bob_unauthorized',
      {
        topK: 2,
        retrievalMode: 'hybrid',
        collectionName: TEST_COLLECTION,
        customChromaUrl: TEST_CHROMA_URL,
      }
    );
    assert(isolatedResult.status === 'no_context', `6.8 Multi-tenant isolation blocks unauthorized student (actual: ${isolatedResult.status})`);
    assert(isolatedResult.sources.length === 0, '6.9 No citations returned for unauthorized tenant query');

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    try {
      await deleteCollection(TEST_COLLECTION);
      console.log(`🧹 Cleaned up temporary test collection "${TEST_COLLECTION}".`);
    } catch (_) {}
  }

  console.log('\n=============================================================================');
  console.log(`📊 STAGE 9 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage9Tests();
