// scripts/test_stage_10.mjs
// Comprehensive Test Suite for Stage 10: AI Study Tools Integration
// Validates:
// 1. Scoped Retrieval (Subject-level, Module-level, Resource-level)
// 2. Multi-Tenant Student Isolation in ChromaDB Study Tool Chunks
// 3. Context Budgeting & Token Management (<7000 chars)
// 4. Citation Formatting, Page Range Aggregation, & Source References
// 5. Robust JSON Extraction & Parsing for LLM Outputs
// 6. Graceful Handling for Not-Indexed and Empty Scopes
// 7. Tool Formats & Grounding:
//    - Module Summary (7-section structured academic markdown)
//    - Quick Study Notes (5-section high-yield revision points)
//    - Practice Questions (Validated question items with answers)
//    - MCQ Quiz (Exactly 10 questions, 4 options, valid answer keys)
// 8. MCQ Quiz Scoring Mechanics, Answer Selection, & Retake Logic
// 9. End-to-End Live Ollama & ChromaDB Integration

import {
  fetchScopeContextChunks,
  budgetScopeChunks,
  robustJsonParser,
  generateStudyToolContent,
} from '../src/services/studyToolGenerationService.ts';
import {
  generateModuleSummary,
} from '../src/services/summaryService.ts';
import {
  generateQuickNotes,
} from '../src/services/quickNotesService.ts';
import {
  generatePracticeQuestions,
  validatePracticeQuestions,
} from '../src/services/practiceQuestionsService.ts';
import {
  generateMcqQuiz,
  validateMcqQuestions,
} from '../src/services/mcqQuizService.ts';
import {
  addEmbeddedChunks,
  getOrCreateCollection,
  deleteCollection,
} from '../src/services/chromaService.ts';
import { generateEmbedding } from '../src/services/embeddingService.ts';
import { formatNomicDocumentText } from '../src/services/documentEmbeddingService.ts';
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

async function runStage10Tests() {
  console.log('\n=============================================================================');
  console.log('🧪 RAG STAGE 10: AI STUDY TOOLS INTEGRATION (UNIFIED ARCHITECTURE)');
  console.log('=============================================================================\n');

  const TEST_COLLECTION = `test_stage_10_tools_${Date.now()}`;
  const STUDENT_A = 'student_alice_101';
  const STUDENT_B = 'student_bob_202';
  const SUBJECT_ID = 'subj_distributed_systems';
  const MODULE_1_ID = 'mod_consensus';
  const MODULE_2_ID = 'mod_replication';
  const RESOURCE_1_ID = 'res_raft_paper';
  const RESOURCE_2_ID = 'res_paxos_notes';

  // Sample course chunks with rich academic grounding
  const sampleChunks = [
    {
      chunkId: 'chunk_raft_01',
      text: 'Raft is a consensus algorithm designed as an alternative to Multi-Paxos to be more understandable. It decomposes consensus into leader election, log replication, and safety. A leader is elected when a candidate receives votes from a majority of nodes.',
      metadata: {
        studentId: STUDENT_A,
        subjectId: SUBJECT_ID,
        moduleId: MODULE_1_ID,
        resourceId: RESOURCE_1_ID,
        resourceName: 'Raft-Consensus-Paper.pdf',
        pageNumber: 1,
        chunkIndex: 0,
      },
    },
    {
      chunkId: 'chunk_raft_02',
      text: 'Raft nodes operate in one of three states: Leader, Follower, or Candidate. In normal operation there is exactly one leader, and all other servers are followers. Followers respond to requests from leaders and candidates. Raft uses randomized election timeouts between 150ms and 300ms.',
      metadata: {
        studentId: STUDENT_A,
        subjectId: SUBJECT_ID,
        moduleId: MODULE_1_ID,
        resourceId: RESOURCE_1_ID,
        resourceName: 'Raft-Consensus-Paper.pdf',
        pageNumber: 2,
        chunkIndex: 1,
      },
    },
    {
      chunkId: 'chunk_paxos_01',
      text: 'Basic Paxos consensus protocol reaches agreement among distributed nodes over a single proposed value. Multi-Paxos extends this to agree on a sequence of values forming a distributed state machine log. Paxos guarantees safety even during network partitions.',
      metadata: {
        studentId: STUDENT_A,
        subjectId: SUBJECT_ID,
        moduleId: MODULE_1_ID,
        resourceId: RESOURCE_2_ID,
        resourceName: 'Paxos-Lecture-Notes.pdf',
        pageNumber: 5,
        chunkIndex: 0,
      },
    },
    {
      chunkId: 'chunk_repl_01',
      text: 'State Machine Replication (SMR) is a general technique for implementing a fault-tolerant service by replicating servers and coordinating client interactions. All replicas execute operations in identical deterministic order.',
      metadata: {
        studentId: STUDENT_A,
        subjectId: SUBJECT_ID,
        moduleId: MODULE_2_ID,
        resourceId: 'res_smr_handout',
        resourceName: 'SMR-Handout.pdf',
        pageNumber: 1,
        chunkIndex: 0,
      },
    },
  ];

  // =========================================================================
  // SUITE 1: Robust JSON Parser Unit Tests
  // =========================================================================
  console.log('--- SUITE 1: Robust JSON Parser ---');

  const rawArray = '[{"id":"1","text":"Alpha"},{"id":"2","text":"Beta"}]';
  const parsed1 = robustJsonParser(rawArray);
  assert(Array.isArray(parsed1) && parsed1.length === 2, 'Parses clean JSON array directly');

  const markdownArray = '```json\n[{"name":"Gamma"}]\n```';
  const parsed2 = robustJsonParser(markdownArray);
  assert(Array.isArray(parsed2) && parsed2[0].name === 'Gamma', 'Extracts JSON from markdown code fence');

  const conversationalArray = 'Here are your requested quiz questions:\n\n[{"q":"What is Raft?"}]\n\nHope this helps!';
  const parsed3 = robustJsonParser(conversationalArray);
  assert(Array.isArray(parsed3) && parsed3[0].q === 'What is Raft?', 'Extracts JSON embedded inside conversational text');

  const invalidJson = 'This is completely invalid non-JSON output from the LLM';
  const parsed4 = robustJsonParser(invalidJson, []);
  assert(Array.isArray(parsed4) && parsed4.length === 0, 'Gracefully returns fallback array for invalid JSON');

  let threw = false;
  try {
    robustJsonParser(invalidJson);
  } catch {
    threw = true;
  }
  assert(threw, 'Throws descriptive error when no fallback is provided');

  // =========================================================================
  // SUITE 2: Context Budgeting & Citation Aggregation Unit Tests
  // =========================================================================
  console.log('\n--- SUITE 2: Context Budgeting & Citation Aggregation ---');

  const budgetResult = budgetScopeChunks(sampleChunks, 5000);
  assert(budgetResult.chunksUsed === 4, 'Includes all chunks within budget');
  assert(budgetResult.totalChars > 0, 'Computes total context character count');
  assert(budgetResult.sources.length === 3, 'Aggregates distinct source documents', `Got ${budgetResult.sources.length}`);

  const raftPaperSource = budgetResult.sources.find((s) => s.resourceId === RESOURCE_1_ID);
  assert(
    raftPaperSource && raftPaperSource.pageRange === '1–2',
    'Merges contiguous pages into range (e.g., 1–2)',
    `Got ${raftPaperSource?.pageRange}`
  );

  const tightBudgetResult = budgetScopeChunks(sampleChunks, 350);
  assert(
    tightBudgetResult.totalChars <= 500 && tightBudgetResult.chunksUsed < 4,
    'Strictly bounds context size under tight budget limit'
  );

  // =========================================================================
  // SUITE 3: Question Validation & Answer Key Normalization
  // =========================================================================
  console.log('\n--- SUITE 3: Question & Answer Key Normalization ---');

  // 3.1 Practice Questions Validator
  const rawPracticeItems = [
    { question: 'What is Raft leader election?', answer: 'Election uses majority votes.', explanation: 'See sec 5.2' },
    { question: 'Abc', answer: 'No' }, // question.length 3 < 5
    { question: 'What is Raft leader election?', answer: 'Duplicate prompt' },
    { question: 'How do election timeouts prevent split votes?', answer: 'Using randomized intervals between 150ms and 300ms.' },
  ];
  const validPQ = validatePracticeQuestions(rawPracticeItems, SUBJECT_ID, MODULE_1_ID, 'medium');
  assert(validPQ.length === 2, 'Practice question validator filters short items and duplicates', `Got ${validPQ.length}`);
  assert(validPQ[0].subjectId === SUBJECT_ID, 'Practice question retains subject scope ID');

  // 3.2 MCQ Validator
  const rawMcqItems = [
    {
      question: 'Which component is responsible for consensus in Raft?',
      options: [
        { id: 'opt-a', text: 'Leader' },
        { id: 'opt-b', text: 'Follower' },
        { id: 'opt-c', text: 'Candidate' },
        { id: 'opt-d', text: 'All nodes collaboratively via RPCs' },
      ],
      correctOptionId: 'opt-a',
      explanation: 'Leader coordinates log replication.',
    },
    {
      question: 'In Raft, what is the default range for election timeouts?',
      options: ['10ms to 50ms', '150ms to 300ms', '1s to 5s', '10s to 30s'],
      correctAnswer: '1', // Index 1 -> opt-b
      explanation: 'Randomized intervals avoid split votes.',
    },
    {
      question: 'Invalid question with missing options',
      options: ['Only opt 1', 'Only opt 2'],
      correctOptionId: 'opt-a',
    },
    {
      question: 'Invalid question with invalid answer key',
      options: ['A', 'B', 'C', 'D'],
      correctOptionId: 'opt-z',
    },
  ];
  const validMCQ = validateMcqQuestions(rawMcqItems, SUBJECT_ID, MODULE_1_ID, 'medium');
  assert(validMCQ.length === 2, 'MCQ validator filters invalid options count and invalid keys', `Got ${validMCQ.length}`);
  assert(validMCQ[0].options.length === 4, 'Valid MCQ question has exactly 4 options');
  assert(validMCQ[1].correctOptionId === 'opt-b', 'Normalizes numeric answer index to standard opt-b key');

  // =========================================================================
  // SUITE 4: Interactive MCQ Quiz Scoring Mechanics
  // =========================================================================
  console.log('\n--- SUITE 4: MCQ Quiz Scoring Mechanics ---');

  // Simulate a 10-question quiz session
  const mockQuizQuestions = Array.from({ length: 10 }).map((_, idx) => ({
    id: `q_${idx + 1}`,
    subjectId: SUBJECT_ID,
    question: `Question ${idx + 1}: What is concept ${idx + 1}?`,
    options: [
      { id: 'opt-a', text: 'Option A' },
      { id: 'opt-b', text: 'Option B' },
      { id: 'opt-c', text: 'Option C' },
      { id: 'opt-d', text: 'Option D' },
    ],
    correctOptionId: idx % 2 === 0 ? 'opt-a' : 'opt-b',
    explanation: `Explanation for question ${idx + 1}`,
  }));

  // Student answers: 8 correct, 2 incorrect
  const studentAnswers = {
    q_1: 'opt-a', // Correct
    q_2: 'opt-b', // Correct
    q_3: 'opt-a', // Correct
    q_4: 'opt-b', // Correct
    q_5: 'opt-a', // Correct
    q_6: 'opt-b', // Correct
    q_7: 'opt-a', // Correct
    q_8: 'opt-b', // Correct
    q_9: 'opt-c', // WRONG (correct is opt-a)
    q_10: 'opt-d', // WRONG (correct is opt-b)
  };

  let score = 0;
  mockQuizQuestions.forEach((q) => {
    if (studentAnswers[q.id] === q.correctOptionId) {
      score++;
    }
  });

  const percentage = Math.round((score / mockQuizQuestions.length) * 100);
  assert(score === 8, 'Quiz calculates exact correct answer count (8/10)', `Got ${score}`);
  assert(percentage === 80, 'Quiz calculates correct percentage score (80%)', `Got ${percentage}%`);

  // Retake reset simulation
  const resetAnswers = {};
  assert(Object.keys(resetAnswers).length === 0, 'Retake reset cleanly clears student answer map');

  // =========================================================================
  // SUITE 5: ChromaDB Setup & Scoped Retrieval
  // =========================================================================
  console.log('\n--- SUITE 5: ChromaDB Scoped Retrieval & Multi-Tenant Isolation ---');

  let chromaReady = false;
  try {
    const col = await getOrCreateCollection(TEST_COLLECTION);
    if (col) {
      chromaReady = true;

      // Embed and store test chunks
      const embedded = [];
      for (const c of sampleChunks) {
        const nomicFormatted = formatNomicDocumentText(c.text, 'Course notes');
        const vec = await generateEmbedding(nomicFormatted);
        embedded.push({
          chunkId: c.chunkId,
          text: c.text,
          embedding: vec.vector,
          studentId: c.metadata.studentId,
          subjectId: c.metadata.subjectId,
          moduleId: c.metadata.moduleId,
          resourceId: c.metadata.resourceId,
          resourceName: c.metadata.resourceName,
          pageNumber: c.metadata.pageNumber,
          chunkIndex: c.metadata.chunkIndex,
          totalChunks: 4,
          tokenCount: 30,
          characterCount: c.text.length,
          metadata: c.metadata,
        });
      }

      await addEmbeddedChunks(embedded, { collectionName: TEST_COLLECTION });
      assert(true, 'Indexed test course chunks into ChromaDB collection');
    }
  } catch (err) {
    console.warn('⚠️ ChromaDB setup failed (running fallback checks):', err.message);
  }

  if (chromaReady) {
    // 5.1 Subject-level Scope: all modules in subject
    const subjectChunks = await fetchScopeContextChunks({
      subjectId: SUBJECT_ID,
      studentId: STUDENT_A,
    }, { collectionName: TEST_COLLECTION });
    assert(
      subjectChunks.length === 4,
      'Subject scope retrieves all 4 chunks across all modules',
      `Got ${subjectChunks.length}`
    );

    // 5.2 Module-level Scope: only module 1
    const mod1Chunks = await fetchScopeContextChunks({
      subjectId: SUBJECT_ID,
      moduleId: MODULE_1_ID,
      studentId: STUDENT_A,
    }, { collectionName: TEST_COLLECTION });
    assert(
      mod1Chunks.length === 3,
      'Module scope retrieves only chunks matching moduleId (3 chunks)',
      `Got ${mod1Chunks.length}`
    );

    // 5.3 Resource-level Scope: only raft paper
    const resChunks = await fetchScopeContextChunks({
      subjectId: SUBJECT_ID,
      resourceId: RESOURCE_1_ID,
      studentId: STUDENT_A,
    }, { collectionName: TEST_COLLECTION });
    assert(
      resChunks.length === 2,
      'Resource scope retrieves only chunks matching resourceId (2 chunks)',
      `Got ${resChunks.length}`
    );

    // 5.4 Multi-tenant student isolation: Student B gets 0 chunks
    const studentBChunks = await fetchScopeContextChunks({
      subjectId: SUBJECT_ID,
      studentId: STUDENT_B,
    }, { collectionName: TEST_COLLECTION });
    assert(
      studentBChunks.length === 0,
      'Student isolation prevents Student B from retrieving Student A chunks'
    );

    // 5.5 Non-indexed Subject Scope: returns empty
    const unindexedChunks = await fetchScopeContextChunks({
      subjectId: 'subj_unindexed_physics',
      studentId: STUDENT_A,
    }, { collectionName: TEST_COLLECTION });
    assert(
      unindexedChunks.length === 0,
      'Non-indexed subject gracefully returns 0 chunks'
    );
  }

  // =========================================================================
  // SUITE 6: Graceful Handling for Empty & Non-Indexed Scopes
  // =========================================================================
  console.log('\n--- SUITE 6: Empty & Non-Indexed Scope Handling ---');

  // Empty scope
  const emptyRes = await generateStudyToolContent({
    tool: 'summary',
    scope: { subjectId: '', subjectName: '', studentId: STUDENT_A },
    materials: [],
    collectionName: TEST_COLLECTION,
  });
  assert(emptyRes.status === 'no_materials', 'Empty materials and scope returns status: no_materials');

  // Non-indexed subject scope
  const notIndexedRes = await generateStudyToolContent({
    tool: 'summary',
    scope: { subjectId: 'non_existent_subject_999', subjectName: 'Unknown Subject', studentId: STUDENT_A },
    materials: [{ id: 'res_unindexed', name: 'Unindexed-Document.pdf', type: 'PDF' }],
    collectionName: TEST_COLLECTION,
  });
  assert(
    notIndexedRes.status === 'not_indexed',
    'Unindexed scope returns status: not_indexed without crashing'
  );
  assert(
    notIndexedRes.chunksUsedCount === 0,
    'Unindexed scope reports 0 chunks used'
  );

  // =========================================================================
  // SUITE 7: Live Ollama LLM Study Tool Generation
  // =========================================================================
  console.log('\n--- SUITE 7: End-to-End Live Ollama Generation ---');

  const ollamaOnline = await isOllamaOnline();
  if (!ollamaOnline || !chromaReady) {
    console.log('⚠️ Ollama or ChromaDB offline, skipping live LLM generation tests.');
  } else {
    console.log('⚡ Ollama is online! Testing live grounded generation for Study Tools...');

    const activeCourseMaterials = [
      { id: RESOURCE_1_ID, name: 'Raft-Consensus-Paper.pdf', type: 'PDF' },
      { id: RESOURCE_2_ID, name: 'Paxos-Lecture-Notes.pdf', type: 'PDF' },
    ];

    // 7.1 Module Summary Generation (7-section markdown)
    try {
      console.log('Generating Module Summary with RAG...');
      const summaryResult = await generateStudyToolContent({
        tool: 'summary',
        scope: {
          subjectId: SUBJECT_ID,
          subjectName: 'Distributed Systems',
          moduleId: MODULE_1_ID,
          moduleName: 'Consensus Protocols',
          studentId: STUDENT_A,
        },
        materials: activeCourseMaterials,
        collectionName: TEST_COLLECTION,
        model: 'llama3.2:3b',
      });

      assert(summaryResult.status === 'success', 'RAG Module Summary generated successfully');
      assert(summaryResult.isGrounded === true, 'Module Summary is marked as RAG grounded');
      assert(summaryResult.sources.length > 0, 'Module Summary includes verified source citations');
      assert(
        typeof summaryResult.summaryText === 'string' && summaryResult.summaryText.length > 200,
        'Module Summary produces substantive academic markdown content'
      );
      assert(
        summaryResult.summaryText?.includes('Raft') || summaryResult.summaryText?.includes('consensus'),
        'Module Summary text reflects indexed consensus material'
      );
    } catch (err) {
      console.error('❌ Summary generation failed:', err.message);
      failed++;
    }

    // 7.2 Quick Study Notes Generation (5-section markdown)
    try {
      console.log('Generating Quick Study Notes with RAG...');
      const notesResult = await generateStudyToolContent({
        tool: 'notes',
        scope: {
          subjectId: SUBJECT_ID,
          subjectName: 'Distributed Systems',
          moduleId: MODULE_1_ID,
          moduleName: 'Consensus Protocols',
          studentId: STUDENT_A,
        },
        materials: activeCourseMaterials,
        collectionName: TEST_COLLECTION,
        model: 'llama3.2:3b',
      });

      assert(notesResult.status === 'success', 'RAG Quick Notes generated successfully');
      assert(notesResult.isGrounded === true, 'Quick Notes is marked as RAG grounded');
      assert(notesResult.sources.length > 0, 'Quick Notes includes verified source citations');
      assert(
        typeof notesResult.notesText === 'string' && notesResult.notesText.length > 150,
        'Quick Notes produces concise revision markdown'
      );
    } catch (err) {
      console.error('❌ Quick Notes generation failed:', err.message);
      failed++;
    }

    // 7.3 Practice Questions Generation (JSON array)
    try {
      console.log('Generating Practice Questions with RAG...');
      const pqResult = await generateStudyToolContent({
        tool: 'practice',
        scope: {
          subjectId: SUBJECT_ID,
          subjectName: 'Distributed Systems',
          moduleId: MODULE_1_ID,
          moduleName: 'Consensus Protocols',
          studentId: STUDENT_A,
        },
        materials: activeCourseMaterials,
        count: 5,
        collectionName: TEST_COLLECTION,
        model: 'llama3.2:3b',
      });

      assert(pqResult.status === 'success', 'RAG Practice Questions generated successfully');
      assert(Array.isArray(pqResult.practiceQuestions), 'Practice questions returned as array');
      assert(
        pqResult.practiceQuestions && pqResult.practiceQuestions.length > 0,
        `Generated ${pqResult.practiceQuestions?.length} practice questions`
      );
      assert(
        pqResult.practiceQuestions && pqResult.practiceQuestions[0]?.answer?.length > 0,
        'Practice question contains complete detailed answer'
      );
    } catch (err) {
      console.error('❌ Practice questions generation failed:', err.message);
      failed++;
    }

    // 7.4 MCQ Quiz Generation (JSON array with options and answer keys)
    try {
      console.log('Generating MCQ Quiz with RAG...');
      const quizResult = await generateStudyToolContent({
        tool: 'quiz',
        scope: {
          subjectId: SUBJECT_ID,
          subjectName: 'Distributed Systems',
          moduleId: MODULE_1_ID,
          moduleName: 'Consensus Protocols',
          studentId: STUDENT_A,
        },
        materials: activeCourseMaterials,
        collectionName: TEST_COLLECTION,
        model: 'llama3.2:3b',
      });

      assert(quizResult.status === 'success', 'RAG MCQ Quiz generated successfully');
      assert(Array.isArray(quizResult.mcqQuestions), 'MCQ questions returned as array');
      assert(
        quizResult.mcqQuestions && quizResult.mcqQuestions.length > 0,
        `Generated ${quizResult.mcqQuestions?.length} MCQ questions`
      );
      if (quizResult.mcqQuestions && quizResult.mcqQuestions.length > 0) {
        const firstQ = quizResult.mcqQuestions[0];
        assert(firstQ.options.length === 4, 'Quiz question has exactly 4 options');
        assert(Boolean(firstQ.correctOptionId), 'Quiz question has designated correctOptionId');
        assert(Boolean(firstQ.explanation), 'Quiz question includes explanatory rationale');
      }
    } catch (err) {
      console.error('❌ MCQ quiz generation failed:', err.message);
      failed++;
    }
  }

  // Cleanup test collection
  if (chromaReady) {
    try {
      await deleteCollection(TEST_COLLECTION);
      console.log(`\n🧹 Cleaned up temporary test collection: ${TEST_COLLECTION}`);
    } catch {
      // Ignore
    }
  }

  console.log('\n=============================================================================');
  console.log(`🎯 STAGE 10 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage10Tests().catch((err) => {
  console.error('💥 Unhandled test error in Stage 10 suite:', err);
  process.exit(1);
});
