// Test Suite for RAG Stage 8.3: Conversation History & Query Condensation
// Run with: npx vite-node scripts/test_stage_8_3.mjs

import {
  generateRagAnswer,
  buildRagPromptContext,
  DEFAULT_RAG_MIN_SIMILARITY,
} from '../src/services/ragService.ts';
import {
  condenseQuestion,
  formatConversationHistoryForCondensation,
  cleanCondensedQuestion,
} from '../src/services/queryCondensationService.ts';
import { generateChatResponse } from '../src/services/chatService.ts';
import {
  getOrCreateCollection,
  deleteCollection,
  addEmbeddedChunks,
} from '../src/services/chromaService.ts';
import { generateEmbedding } from '../src/services/embeddingService.ts';
import { formatNomicDocumentText } from '../src/services/documentEmbeddingService.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 8.3: CONVERSATION HISTORY & QUERY CONDENSATION');
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

async function runStage83TestSuite() {
  const testCollection = `test_stage83_${Date.now()}`;
  const studentAlice = 'student_alice_stage83_101';
  const studentBob = 'student_bob_stage83_202';

  console.log(`Setting up isolated test collection: "${testCollection}"...`);
  await getOrCreateCollection(testCollection);

  // -----------------------------------------------------------------
  // PREPARATION: Index realistic course knowledge chunks
  // -----------------------------------------------------------------
  console.log('Indexing test study documents with Nomic document prefixes...');

  const aliceChunks = [
    {
      chunkId: 'chunk_tcp_overview_0',
      chunkIndex: 0,
      totalChunks: 3,
      pageNumber: 14,
      tokenCount: 45,
      characterCount: 240,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-computer-networks-pdf',
      resourceName: 'Computer Networks Module 1.pdf',
      studentId: studentAlice,
      text: 'Transmission Control Protocol (TCP) is a core connection-oriented protocol in the Internet protocol suite. It provides reliable, ordered, and error-checked delivery of a stream of bytes between host computers. TCP uses a formal three-way handshake (SYN, SYN-ACK, ACK) to establish connections.',
    },
    {
      chunkId: 'chunk_tcp_advantages_1',
      chunkIndex: 1,
      totalChunks: 3,
      pageNumber: 15,
      tokenCount: 52,
      characterCount: 280,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-computer-networks-pdf',
      resourceName: 'Computer Networks Module 1.pdf',
      studentId: studentAlice,
      text: 'The primary advantages of TCP include: guaranteed in-order packet delivery, comprehensive end-to-end error detection with retransmissions, full-duplex communication, and built-in flow control and congestion control mechanisms that prevent network collapse under high load.',
    },
    {
      chunkId: 'chunk_tcp_flowcontrol_2',
      chunkIndex: 2,
      totalChunks: 3,
      pageNumber: 18,
      tokenCount: 48,
      characterCount: 260,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-computer-networks-pdf',
      resourceName: 'Computer Networks Module 1.pdf',
      studentId: studentAlice,
      text: 'TCP flow control uses a dynamic sliding window mechanism. The receiving host advertises its available buffer space (receive window) in TCP segment headers. This strictly prevents a fast sender from overwhelming a slower receiver with unbuffered packets.',
    },
    {
      chunkId: 'chunk_db_acid_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 42,
      tokenCount: 55,
      characterCount: 290,
      subjectId: 'cs-databases-201',
      moduleId: 'mod-transactions',
      resourceId: 'res-db-principles-pdf',
      resourceName: 'Database Principles.pdf',
      studentId: studentAlice,
      text: 'ACID transaction properties guarantee database consistency: Atomicity ensures all operations in a transaction succeed or all fail together; Consistency guarantees transition between valid states; Isolation ensures concurrent transactions execute independently; Durability ensures committed updates persist permanently.',
    },
    {
      chunkId: 'chunk_sec_sqli_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 7,
      tokenCount: 40,
      characterCount: 220,
      subjectId: 'cs-security-401',
      moduleId: 'mod-websec',
      resourceId: 'res-security-guide-pdf',
      resourceName: 'Web Security Guide.pdf',
      studentId: studentAlice,
      text: 'SQL Injection (SQLi) is a security vulnerability where an attacker manipulates dynamic SQL queries by injecting malicious SQL statements into user input fields. Primary defense is using parameterized prepared statements instead of string concatenation.',
    },
  ];

  const bobChunks = [
    {
      chunkId: 'chunk_bob_secret_0',
      chunkIndex: 0,
      totalChunks: 1,
      pageNumber: 1,
      tokenCount: 30,
      characterCount: 150,
      subjectId: 'cs-networks-301',
      moduleId: 'mod-transport',
      resourceId: 'res-bob-secret-notes-pdf',
      resourceName: 'Bob Secret Notes.pdf',
      studentId: studentBob,
      text: 'Bob confidential notes: TCP port 9090 is reserved for Bob research testbed.',
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
        tokenCount: c.tokenCount,
        characterCount: c.characterCount,
        subjectId: c.subjectId,
        moduleId: c.moduleId,
        resourceId: c.resourceId,
        resourceName: c.resourceName,
        studentId: c.studentId,
        embeddingVersion: 'nomic-v2-prefixed',
      },
    });
  }

  await addEmbeddedChunks(embeddedChunks, { collectionName: testCollection });
  console.log(`Successfully indexed ${embeddedChunks.length} chunks into "${testCollection}".\n`);

  const networksScope = {
    subjectId: 'cs-networks-301',
    subjectName: 'Computer Networks',
    subjectCode: 'CS301',
    scopeMode: 'entire_subject',
    moduleIds: ['mod-transport'],
    moduleNames: ['Transport Layer'],
    totalModuleCount: 1,
  };

  const databasesScope = {
    subjectId: 'cs-databases-201',
    subjectName: 'Database Systems',
    subjectCode: 'CS201',
    scopeMode: 'entire_subject',
    moduleIds: ['mod-transactions'],
    moduleNames: ['Transactions'],
    totalModuleCount: 1,
  };

  try {
    // =================================================================
    // SCENARIO 1: Normal Standalone Question
    // =================================================================
    console.log('--- SCENARIO 1: Normal Standalone Question ---');
    const res1 = await generateRagAnswer(
      'What is Transmission Control Protocol and what handshake does it use?',
      networksScope,
      studentAlice,
      { collectionName: testCollection }
    );

    assert(res1.status === 'success', '1.1 Standalone question executes with status: success');
    assert(res1.isGrounded === true, '1.2 Standalone answer is verified grounded');
    assert(res1.sources.length > 0, '1.3 Retrieved document sources for standalone question');
    assert(
      res1.sources.some((s) => s.resourceName === 'Computer Networks Module 1.pdf'),
      '1.4 Citations accurately reference real PDF filename'
    );
    assert(
      res1.condensedQuestion === undefined || res1.condensedQuestion === '',
      '1.5 Standalone question without history does not invoke query condensation'
    );
    assert(
      res1.condensationDurationMs === 0 || res1.condensationDurationMs === undefined,
      '1.6 Condensation duration is zero for standalone questions'
    );

    // =================================================================
    // SCENARIO 2: Follow-up Question Referring to Previous Topic
    // =================================================================
    console.log('\n--- SCENARIO 2: Follow-up Question Referring to Previous Topic ---');
    const history2 = [
      {
        role: 'user',
        content: 'What is TCP?',
      },
      {
        role: 'assistant',
        content: 'TCP (Transmission Control Protocol) is a connection-oriented transport protocol that provides reliable delivery using a three-way handshake.',
      },
    ];

    const res2 = await generateRagAnswer(
      'Explain its advantages.',
      networksScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history2,
      }
    );

    assert(res2.status === 'success', '2.1 Follow-up question executed successfully');
    assert(res2.isGrounded === true, '2.2 Follow-up answer is grounded in study materials');
    assert(
      typeof res2.condensedQuestion === 'string' && res2.condensedQuestion.length > 0,
      '2.3 Condensed question string was produced'
    );
    assert(
      /tcp|transmission\s*control/i.test(res2.condensedQuestion),
      `2.4 Condensed question resolves "its" to TCP: "${res2.condensedQuestion}"`
    );
    assert(
      res2.sources.some((s) => s.chunkId === 'chunk_tcp_advantages_1'),
      '2.5 Semantic search with condensed question retrieved TCP advantages chunk'
    );
    assert(
      res2.sources.some((s) => s.pageNumber === 15),
      '2.6 Correct citation page (Page 15) preserved'
    );

    // =================================================================
    // SCENARIO 3: Multiple Consecutive Follow-up Questions
    // =================================================================
    console.log('\n--- SCENARIO 3: Multiple Consecutive Follow-up Questions (3 Turns) ---');
    const history3 = [
      {
        role: 'user',
        content: 'What is TCP?',
      },
      {
        role: 'assistant',
        content: 'TCP is a connection-oriented protocol with a three-way handshake.',
      },
      {
        role: 'user',
        content: 'Explain its advantages.',
      },
      {
        role: 'assistant',
        content: 'Its advantages include in-order packet delivery, error checking, and congestion control.',
      },
    ];

    const res3 = await generateRagAnswer(
      'How does it control flow and prevent overwhelming the receiver?',
      networksScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history3,
      }
    );

    assert(res3.status === 'success', '3.1 Consecutive follow-up executed with status: success');
    assert(
      typeof res3.condensedQuestion === 'string' &&
        /tcp|flow\s*control/i.test(res3.condensedQuestion),
      `3.2 Query condensed across 2 turns into self-contained search query: "${res3.condensedQuestion}"`
    );
    assert(
      res3.sources.some((s) => s.chunkId === 'chunk_tcp_flowcontrol_2'),
      '3.3 Retrieved specific flow control and sliding window chunk (chunk_tcp_flowcontrol_2)'
    );
    assert(
      /sliding\s*window|buffer/i.test(res3.answer),
      '3.4 Generated answer accurately explains sliding window mechanism from study material'
    );

    // =================================================================
    // SCENARIO 4: Pronoun-based Questions
    // =================================================================
    console.log('\n--- SCENARIO 4: Pronoun-based Questions ("What does its first letter stand for?") ---');
    const history4 = [
      {
        role: 'user',
        content: 'Tell me about ACID properties in databases.',
      },
      {
        role: 'assistant',
        content: 'ACID transaction properties guarantee database consistency even during power failures or system crashes.',
      },
    ];

    const res4 = await generateRagAnswer(
      'What does its first letter stand for and what does it mean?',
      databasesScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history4,
      }
    );

    assert(res4.status === 'success', '4.1 Pronoun-based follow-up completed successfully');
    assert(
      typeof res4.condensedQuestion === 'string' &&
        /acid|database/i.test(res4.condensedQuestion),
      `4.2 Pronoun "its" resolved to ACID/database: "${res4.condensedQuestion}"`
    );
    assert(
      /atomicity/i.test(res4.answer),
      '4.3 Grounded answer correctly identifies "Atomicity" from retrieved ACID document'
    );
    assert(
      res4.sources.some((s) => s.resourceName === 'Database Principles.pdf'),
      '4.4 Correct database textbook cited'
    );

    // =================================================================
    // SCENARIO 5: Topic Changes Within the Same Conversation
    // =================================================================
    console.log('\n--- SCENARIO 5: Topic Changes Within the Same Conversation ---');
    const history5 = [
      {
        role: 'user',
        content: 'What is TCP and what are its advantages?',
      },
      {
        role: 'assistant',
        content: 'TCP is a reliable transport protocol with guaranteed in-order delivery and congestion control.',
      },
    ];

    // Abrupt topic shift to web security / SQL injection
    const securityScope = {
      subjectId: 'cs-security-401',
      subjectName: 'Web Security',
      subjectCode: 'CS401',
      scopeMode: 'entire_subject',
      moduleIds: ['mod-websec'],
      moduleNames: ['Web Security'],
      totalModuleCount: 1,
    };

    const res5 = await generateRagAnswer(
      'What is SQL injection and how do you prevent it?',
      securityScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history5,
      }
    );

    assert(res5.status === 'success', '5.1 Topic-shifted question executed successfully');
    assert(
      typeof res5.condensedQuestion === 'string',
      '5.2 Condensation evaluated topic change'
    );
    assert(
      !/tcp|handshake|transport\s*protocol/i.test(res5.condensedQuestion),
      `5.3 Topic shift did NOT contaminate new question with old TCP topic: "${res5.condensedQuestion}"`
    );
    assert(
      res5.sources.some((s) => s.chunkId === 'chunk_sec_sqli_0'),
      '5.4 Retrieved relevant Web Security SQL injection chunk'
    );
    assert(
      /prepared\s*statement|parameter/i.test(res5.answer),
      '5.5 Answer grounded in SQL injection defense (prepared statements)'
    );

    // =================================================================
    // SCENARIO 6: Empty Conversation History Handling
    // =================================================================
    console.log('\n--- SCENARIO 6: Empty Conversation History Handling ---');
    const res6 = await generateRagAnswer(
      'What is SQL injection?',
      securityScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: [], // Explicit empty array
      }
    );

    assert(res6.status === 'success', '6.1 Empty conversation history handles safely');
    assert(res6.isGrounded === true, '6.2 Grounding succeeds with empty history');
    assert(
      res6.condensedQuestion === undefined || res6.condensedQuestion === '',
      '6.3 Query condensation skipped when history is empty array'
    );

    // =================================================================
    // SCENARIO 7: Missing or Irrelevant Retrieved Context
    // =================================================================
    console.log('\n--- SCENARIO 7: Missing or Irrelevant Retrieved Context ---');
    const history7 = [
      {
        role: 'user',
        content: 'What is TCP?',
      },
      {
        role: 'assistant',
        content: 'TCP is a transport protocol.',
      },
    ];

    // Asking about quantum entanglement, which does NOT exist in course PDFs
    const res7 = await generateRagAnswer(
      'What is quantum entanglement and how does it affect quantum key distribution?',
      networksScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history7,
        minSimilarity: 0.50, // Strict Stage 8.2 threshold
      }
    );

    assert(
      res7.status === 'no_context',
      `7.1 Irrelevant topic returns status: no_context (got: ${res7.status})`
    );
    assert(res7.isGrounded === false, '7.2 isGrounded is false for missing context');
    assert(res7.sources.length === 0, '7.3 Sources array is empty when context is insufficient');
    assert(
      /no\s*relevant\s*passages|indexed\s*study\s*materials/i.test(res7.answer),
      '7.4 Refusal response informs student without inventing false academic facts'
    );

    // =================================================================
    // SCENARIO 8: Conversation History with Unrelated Content
    // =================================================================
    console.log('\n--- SCENARIO 8: Conversation History with Unrelated Content ---');
    const history8 = [
      {
        sender: 'user',
        content: 'My favorite meal is pepperoni pizza and I adopted a golden retriever named Rex yesterday!',
      },
      {
        sender: 'assistant',
        content: 'That sounds delightful! Dogs are wonderful and pepperoni pizza is a classic favorite.',
      },
    ];

    const res8 = await generateRagAnswer(
      'What is TCP and what three-way handshake does it perform?',
      networksScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history8,
      }
    );

    assert(res8.status === 'success', '8.1 Unrelated chit-chat history handled successfully');
    assert(res8.isGrounded === true, '8.2 Result is grounded in verified documents');
    assert(
      !/pepperoni|pizza|golden\s*retriever|rex/i.test(res8.answer),
      '8.3 Academic answer does NOT inject unrelated personal chit-chat into factual explanation'
    );
    assert(
      /SYN|SYN-ACK|ACK/i.test(res8.answer),
      '8.4 Real three-way handshake facts retrieved from PDF material'
    );

    // =================================================================
    // SCENARIO 9: Subject and Module Filtering Preservation
    // =================================================================
    console.log('\n--- SCENARIO 9: Subject and Module Filtering Preservation ---');
    const multiModuleScope = {
      subjectId: 'cs-networks-301',
      subjectName: 'Computer Networks',
      subjectCode: 'CS301',
      scopeMode: 'specific_modules',
      moduleIds: ['mod-transport'],
      moduleNames: ['Transport Layer'],
      totalModuleCount: 3,
    };

    const res9 = await generateRagAnswer(
      'Explain its advantages.',
      multiModuleScope,
      studentAlice,
      {
        collectionName: testCollection,
        conversationHistory: history2,
      }
    );

    assert(res9.status === 'success', '9.1 Scoped follow-up executes successfully');
    assert(
      res9.sources.every((s) => s.moduleId === 'mod-transport'),
      '9.2 All retrieved chunks strictly belong to requested moduleId "mod-transport"'
    );
    assert(
      res9.sources.every((s) => s.subjectId === 'cs-networks-301'),
      '9.3 All retrieved chunks strictly belong to requested subjectId "cs-networks-301"'
    );
    assert(
      !res9.sources.some((s) => s.studentId === studentBob),
      '9.4 Bob private notes are strictly filtered out (multi-tenant isolation)'
    );

    // =================================================================
    // SCENARIO 10: Source Citation Preservation
    // =================================================================
    console.log('\n--- SCENARIO 10: Source Citation Preservation ---');
    const res10 = res2; // Follow-up query result from Scenario 2
    assert(Array.isArray(res10.sources) && res10.sources.length > 0, '10.1 Sources array exists and has items');
    const topCitation = res10.sources[0];
    assert(typeof topCitation.chunkId === 'string' && topCitation.chunkId.length > 0, '10.2 Citation has valid chunkId');
    assert(topCitation.resourceName === 'Computer Networks Module 1.pdf', '10.3 Citation has real resourceName');
    assert(typeof topCitation.pageNumber === 'number' && topCitation.pageNumber > 0, '10.4 Citation has valid 1-indexed page number');
    assert(typeof topCitation.similarity === 'number' && topCitation.similarity >= 0.50, '10.5 Citation similarity meets >= 0.50 threshold');
    assert(typeof topCitation.textSnippet === 'string' && topCitation.textSnippet.length > 0, '10.6 Citation textSnippet is available for UI preview');

    // =================================================================
    // SCENARIO 11: Ollama Connection Failure / Graceful Fallback
    // =================================================================
    console.log('\n--- SCENARIO 11: Ollama Connection Failure / Graceful Fallback ---');
    const badOllamaUrl = 'http://127.0.0.1:9999'; // Non-existent offline port
    const fallbackRes = await condenseQuestion(
      'Explain its advantages.',
      history2,
      { customBaseUrl: badOllamaUrl }
    );

    assert(
      fallbackRes.condensedQuestion === 'Explain its advantages.',
      '11.1 Condensation safely falls back to original question on connection error'
    );
    assert(
      fallbackRes.wasCondensed === false,
      '11.2 wasCondensed is false when fallback occurs'
    );
    assert(
      typeof fallbackRes.error === 'string' && fallbackRes.error.length > 0,
      `11.3 Error info logged gracefully: "${fallbackRes.error}"`
    );

    // =================================================================
    // SCENARIO 12: Existing Non-RAG Chatbot Functionality Regression
    // =================================================================
    console.log('\n--- SCENARIO 12: Existing Non-RAG Chatbot Functionality Regression ---');
    const chatMessages = [
      {
        id: 'msg-1',
        sender: 'user',
        content: 'Hi, what topics are in this course?',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        sender: 'assistant',
        content: 'Hello! This course covers Computer Networks, focusing on Transport Layer protocols.',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-3',
        sender: 'user',
        content: 'Can you give me a quick study tip for college exams?',
        timestamp: new Date().toISOString(),
      },
    ];

    const nonRagRes = await generateChatResponse({
      messages: chatMessages,
      scope: networksScope,
      studentId: studentAlice,
      enableRag: false, // Explicitly test non-RAG mode
    });

    assert(typeof nonRagRes.text === 'string' && nonRagRes.text.length > 20, '12.1 Non-RAG chatbot produces conversational response');
    assert(nonRagRes.isRagGrounded !== true, '12.2 Non-RAG response is not marked as RAG grounded');
    assert(
      !nonRagRes.sources || nonRagRes.sources.length === 0,
      '12.3 Non-RAG response has no PDF chunk citations'
    );
    assert(typeof nonRagRes.durationMs === 'number' && nonRagRes.durationMs > 0, '12.4 Non-RAG telemetry duration recorded');

    // =================================================================
    // SECTION B: HELPER FUNCTION & PROMPT UNIT TESTS
    // =================================================================
    console.log('\n--- SECTION B: Helper Function & Prompt Unit Tests ---');
    // Unit test formatConversationHistoryForCondensation
    const formatted = formatConversationHistoryForCondensation(history3, 3);
    assert(
      formatted.includes('User: What is TCP?') && formatted.includes('User: Explain its advantages.'),
      'B.1 formatConversationHistoryForCondensation formats dialogue turns'
    );

    // Truncation test
    const longHistory = [
      {
        sender: 'user',
        content: 'Question 1',
      },
      {
        sender: 'assistant',
        content: 'A'.repeat(500), // Exceeds MAX_ASSISTANT_HISTORY_CHARS (320)
      },
    ];
    const formattedLong = formatConversationHistoryForCondensation(longHistory, 1);
    assert(
      formattedLong.includes('...') && formattedLong.length < 400,
      'B.2 Assistant history messages exceeding length budget are safely truncated'
    );

    // cleanCondensedQuestion unit tests
    const rawWithPrefix = 'Standalone Question: "What are the advantages of TCP?"';
    const cleaned = cleanCondensedQuestion(rawWithPrefix, 'Explain its advantages.');
    assert(
      cleaned === 'What are the advantages of TCP?',
      `B.3 cleanCondensedQuestion strips prefix and enclosing quotes: "${cleaned}"`
    );

    const rawMultiLine = 'Here is the rewritten question:\nWhat are the advantages of TCP?\nHope this helps!';
    const cleanedMulti = cleanCondensedQuestion(rawMultiLine, 'Explain its advantages.');
    assert(
      cleanedMulti === 'What are the advantages of TCP?',
      `B.4 cleanCondensedQuestion extracts lone question line: "${cleanedMulti}"`
    );

    // Prompt context separation check
    const promptBundle = buildRagPromptContext(
      'Explain its advantages.',
      res2.sources.map((s) => ({
        chunkId: s.chunkId,
        resourceId: s.resourceId,
        resourceName: s.resourceName,
        pageNumber: s.pageNumber,
        similarity: s.similarity,
        distance: s.distance,
        text: 'The primary advantages of TCP include guaranteed delivery...',
        studentId: studentAlice,
      })),
      networksScope,
      { conversationHistory: history2 }
    );

    assert(
      promptBundle.userPrompt.includes('### RECENT CONVERSATION CONTEXT (Informational dialogue context only - NOT academic evidence):'),
      'B.5 userPrompt clearly isolates conversation context in dedicated disclaimer header'
    );
    assert(
      promptBundle.userPrompt.includes('### VERIFIED DOCUMENT EXCERPTS (Primary Academic Evidence):'),
      'B.6 userPrompt clearly isolates verified document excerpts in separate academic evidence header'
    );
    assert(
      promptBundle.systemPrompt.includes('Rule 6') || promptBundle.systemPrompt.includes('Conversation History Boundaries'),
      'B.7 systemPrompt contains explicit Rule 6 instructing model on conversation history boundaries'
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
  console.log(`📊 STAGE 8.3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage83TestSuite().catch((err) => {
  console.error('\n❌ Unhandled error in Stage 8.3 test suite:', err);
  process.exit(1);
});
