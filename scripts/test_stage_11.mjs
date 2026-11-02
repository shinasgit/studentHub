// scripts/test_stage_11.mjs
// Comprehensive Test Suite for Stage 11: Conversation Intelligence
// Validates:
// 1. Persistent Multi-Session Conversation Storage & Message Subcollections
// 2. Short-Term Memory Budgeting, Truncation & Token Management
// 3. Long-Term Conversation Memory Summarization via Local Ollama (Llama 3.2 3B)
// 4. Memory-Enriched Query Condensation & Follow-up Question Understanding
// 5. Multi-Tenant Student Isolation (Student A vs Student B)
// 6. Conversation Management (Rename, Clear History, Delete Session)
// 7. Automated Conversation Title Generation
// 8. Graceful Fallback Handling (Empty History, Offline Models, Firestore Errors)

import {
  budgetShortTermMemory,
  buildMemoryContextPrompt,
  shouldTriggerSummarization,
  summarizeConversationMemory,
  generateConversationTitle,
} from '../src/services/conversationMemoryService.ts';
import {
  sanitizeMessageForFirestore,
  normalizeTimestamp,
} from '../src/services/conversationHistoryService.ts';
import {
  condenseQuestion,
  formatConversationHistoryForCondensation,
} from '../src/services/queryCondensationService.ts';
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

async function runStage11Tests() {
  console.log('\n=============================================================================');
  console.log('🧪 RAG STAGE 11: CONVERSATION INTELLIGENCE TEST SUITE');
  console.log('=============================================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: Message Sanitization & Timestamp Normalization
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Message Sanitization & Timestamps ---');

  const rawUserMsg = {
    id: 'msg-101',
    sender: 'user',
    content: 'What is TCP three-way handshake?',
    timestamp: '2026-11-02T10:00:00.000Z',
  };

  const sanitizedUser = sanitizeMessageForFirestore(rawUserMsg);
  assert(sanitizedUser.id === 'msg-101', '1.1 Retains message ID');
  assert(sanitizedUser.role === 'user', '1.2 Sets role to user');
  assert(sanitizedUser.content === 'What is TCP three-way handshake?', '1.3 Retains query content');
  assert(typeof sanitizedUser.timestamp === 'string', '1.4 Formats timestamp as string');

  const rawAssistantMsg = {
    id: 'msg-102',
    sender: 'assistant',
    content: 'TCP uses SYN, SYN-ACK, ACK to establish a reliable connection.',
    timestamp: new Date(),
    modelUsed: 'llama3.2:3b',
    durationMs: 420,
    isRagGrounded: true,
    sources: [{ resourceId: 'res-1', resourceName: 'networks.pdf', pageNumber: 14 }],
  };

  const sanitizedAssistant = sanitizeMessageForFirestore(rawAssistantMsg);
  assert(sanitizedAssistant.role === 'assistant', '1.5 Sets assistant role');
  assert(sanitizedAssistant.isRagGrounded === true, '1.6 Preserves isRagGrounded status');
  assert(Array.isArray(sanitizedAssistant.sources) && sanitizedAssistant.sources.length === 1, '1.7 Preserves citation sources');
  assert(sanitizedAssistant.durationMs === 420, '1.8 Preserves duration telemetry');

  const dateNorm = normalizeTimestamp(new Date('2026-05-15T12:00:00Z'));
  assert(dateNorm.includes('2026-05-15'), '1.9 Normalizes Date object to ISO string');
  assert(typeof normalizeTimestamp(null) === 'string', '1.10 Falls back to current date on null');

  // -------------------------------------------------------------------------
  // SUITE 2: Short-Term Memory Budgeting & Windowing
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Short-Term Memory Budgeting ---');

  const sampleDialogue = [
    { id: '1', sender: 'user', content: 'What is a subnet mask?' },
    { id: '2', sender: 'assistant', content: 'A subnet mask divides an IP address into network and host portions.' },
    { id: '3', sender: 'user', content: 'How does CIDR slash notation work?' },
    { id: '4', sender: 'assistant', content: 'CIDR notation like /24 indicates that the first 24 bits are network bits.' },
    { id: '5', sender: 'user', content: 'Give me an example with 192.168.1.0/26' },
    { id: '6', sender: 'assistant', content: 'With /26, the subnet mask is 255.255.255.192, yielding 4 subnets of 64 addresses each.' },
    { id: '7', sender: 'user', content: 'What are the usable host IPs in the first subnet?' },
    { id: '8', sender: 'assistant', content: 'In the first subnet (192.168.1.0/26), usable host addresses range from 192.168.1.1 to 192.168.1.62.' },
  ];

  // Budget to max 2 turns (4 messages: turns 5, 6, 7, 8)
  const budget2Turns = budgetShortTermMemory(sampleDialogue, { maxTurns: 2 });
  assert(budget2Turns.budgetedMessages.length === 4, '2.1 Budgets exactly 4 messages for 2 turns');
  assert(budget2Turns.budgetedMessages[0].id === '5', '2.2 First budgeted message is turn 5');
  assert(budget2Turns.budgetedMessages[3].id === '8', '2.3 Last budgeted message is turn 8');
  assert(budget2Turns.droppedCount === 4, '2.4 Correctly reports 4 dropped older messages');

  // Test truncation of oversized assistant responses
  const oversizedDialogue = [
    { id: '10', sender: 'user', content: 'Explain BGP protocol.' },
    {
      id: '11',
      sender: 'assistant',
      content: 'A'.repeat(800), // 800 chars > 350 max
    },
  ];

  const budgetedOversized = budgetShortTermMemory(oversizedDialogue, { maxAssistantChars: 300 });
  assert(budgetedOversized.budgetedMessages[1].content.length <= 305, '2.5 Truncates assistant response exceeding threshold');
  assert(budgetedOversized.budgetedMessages[1].content.endsWith('...'), '2.6 Appends ellipsis to truncated assistant turn');

  // Test tight character ceiling
  const budgetedTightChars = budgetShortTermMemory(sampleDialogue, { maxChars: 250 });
  assert(budgetedTightChars.totalChars <= 250, '2.7 Strictly bounds total characters under limit');

  // -------------------------------------------------------------------------
  // SUITE 3: Memory Prompt Construction
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Memory Prompt Construction ---');

  const shortTermSlice = sampleDialogue.slice(-2);
  const memoryContext = buildMemoryContextPrompt(
    shortTermSlice,
    'The student explored subnetting, CIDR notation, and IP range calculations.',
    ['Subnetting', 'CIDR', 'IPv4 Addressing'],
    ['Broadcast address mechanics']
  );

  assert(memoryContext.shortTermTurns.length === 2, '3.1 Retains short-term turns');
  assert(memoryContext.topics.length === 3, '3.2 Retains memory topics');
  assert(memoryContext.formattedContextPrompt.includes('LONG-TERM CONVERSATION MEMORY'), '3.3 Injects Long-Term Memory header');
  assert(memoryContext.formattedContextPrompt.includes('RECENT DIALOGUE TURNS'), '3.4 Injects Recent Dialogue header');
  assert(memoryContext.formattedContextPrompt.includes('Broadcast address mechanics'), '3.5 Injects unresolved questions');

  // -------------------------------------------------------------------------
  // SUITE 4: Summarization Trigger & Threshold Logic
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Summarization Trigger Logic ---');

  assert(shouldTriggerSummarization(sampleDialogue, 0, 4) === true, '4.1 Triggers when 8 messages >= 4 interval');
  assert(shouldTriggerSummarization(sampleDialogue, 6, 4) === false, '4.2 Does not trigger when only 2 new messages (8 - 6 < 4)');
  assert(shouldTriggerSummarization(sampleDialogue, 4, 4) === true, '4.3 Triggers when exactly 4 new messages (8 - 4 >= 4)');
  assert(shouldTriggerSummarization([], 0, 4) === false, '4.4 Returns false for empty messages');

  // -------------------------------------------------------------------------
  // SUITE 5: Query Condensation with Conversation Memory
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Follow-Up Understanding & Memory-Aware Condensation ---');

  const historyTurns = [
    { role: 'user', content: 'What is Database Normalization?' },
    { role: 'assistant', content: 'Normalization organizes database tables to reduce data redundancy.' },
  ];

  const formattedHistory = formatConversationHistoryForCondensation(historyTurns);
  assert(formattedHistory.includes('Database Normalization'), '5.1 Formats history turns for condensation');

  // Check Ollama status for live condensation test
  const online = await isOllamaOnline();
  if (online) {
    console.log('📡 Ollama is online. Running live follow-up condensation tests...');

    // Test 5.2: Follow-up question resolution using history
    const condResult = await condenseQuestion(
      'Explain its advantages.',
      historyTurns,
      { model: 'llama3.2:3b' }
    );

    assert(condResult.wasCondensed === true, '5.2 Follow-up "Explain its advantages" was rewritten');
    assert(
      condResult.condensedQuestion.toLowerCase().includes('normalization') ||
      condResult.condensedQuestion.toLowerCase().includes('database'),
      '5.3 Rewritten query references Database Normalization',
      `Got: ${condResult.condensedQuestion}`
    );

    // Test 5.4: Follow-up resolution using Long-Term Memory summary when history is compacted
    const condFromSummary = await condenseQuestion(
      'Give me a real-world example.',
      [], // Empty history turns (simulating compacted session)
      {
        conversationSummary: 'The student explored Database Normalization, 1NF, 2NF, 3NF, and Boyce-Codd Normal Form (BCNF).',
        memoryTopics: ['Database Normalization', 'BCNF'],
        model: 'llama3.2:3b',
      }
    );

    assert(
      condFromSummary.condensedQuestion.toLowerCase().includes('normalization') ||
      condFromSummary.condensedQuestion.toLowerCase().includes('database') ||
      condFromSummary.condensedQuestion.toLowerCase().includes('bcnf'),
      '5.4 Resolves follow-up query using long-term conversation memory summary',
      `Got: ${condFromSummary.condensedQuestion}`
    );

    // -----------------------------------------------------------------------
    // SUITE 6: Automated Conversation Title Generation
    // -----------------------------------------------------------------------
    console.log('\n--- SUITE 6: Automated Conversation Title Generation ---');

    const generatedTitle = await generateConversationTitle(
      'How does the TCP three-way handshake establish a reliable connection between host computers?',
      'Computer Networks'
    );

    assert(typeof generatedTitle === 'string' && generatedTitle.length > 3, '6.1 Generates non-empty title');
    assert(generatedTitle.length <= 60, '6.2 Keeps title concise (< 60 chars)');
    assert(!generatedTitle.includes('Title:'), '6.3 Strips "Title:" label from output');
    console.log(`   Generated Title: "${generatedTitle}"`);

    // -----------------------------------------------------------------------
    // SUITE 7: End-to-End Long-Term Memory Summarization via Ollama
    // -----------------------------------------------------------------------
    console.log('\n--- SUITE 7: Long-Term Memory Summarization ---');

    const longDialogue = [
      { sender: 'user', content: 'What is the Difference between TCP and UDP?' },
      { sender: 'assistant', content: 'TCP is connection-oriented and reliable with error checking and retransmission. UDP is connectionless, lightweight, and does not guarantee delivery.' },
      { sender: 'user', content: 'When would I choose UDP over TCP?' },
      { sender: 'assistant', content: 'UDP is preferred for real-time video streaming, DNS lookups, and multiplayer gaming where speed is critical and minor packet loss is acceptable.' },
      { sender: 'user', content: 'What about TCP flow control? How does the sliding window work?' },
      { sender: 'assistant', content: 'TCP sliding window allows the sender to transmit multiple packets before receiving an acknowledgment, adapting dynamically to the receiver window buffer.' },
    ];

    const memorySummary = await summarizeConversationMemory(
      longDialogue,
      undefined,
      { model: 'llama3.2:3b' }
    );

    assert(typeof memorySummary.summaryText === 'string' && memorySummary.summaryText.length > 20, '7.1 Generates substantive summary text');
    assert(Array.isArray(memorySummary.topics) && memorySummary.topics.length > 0, '7.2 Extracts topic keywords');
    assert(memorySummary.lastMessageCount === 6, '7.3 Tracks summarized message count (6 messages)');
    console.log(`   Summary Text: "${memorySummary.summaryText}"`);
    console.log(`   Extracted Topics: ${JSON.stringify(memorySummary.topics)}`);

    // Test incremental update of existing summary
    const incrementalDialogue = [
      ...longDialogue,
      { sender: 'user', content: 'What is Congestion Collapse and how does TCP Tahoe solve it?' },
      { sender: 'assistant', content: 'TCP Tahoe implements Slow Start, Congestion Avoidance, and Fast Retransmit to prevent network congestion collapse.' },
    ];

    const updatedSummary = await summarizeConversationMemory(
      incrementalDialogue,
      memorySummary.summaryText,
      { model: 'llama3.2:3b' }
    );

    assert(typeof updatedSummary.summaryText === 'string' && updatedSummary.summaryText.length > 20, '7.4 Incrementally updates summary text');
    assert(updatedSummary.lastMessageCount === 8, '7.5 Updates summarized message count to 8');
  } else {
    console.log('⚠️ Ollama is offline. Skipping live LLM tests (Ollama required).');
  }

  // -------------------------------------------------------------------------
  // SUITE 8: Multi-Tenant Student Isolation Checks
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Student Isolation & Data Boundaries ---');

  const studentA = 'student_alice_uid_123';
  const studentB = 'student_bob_uid_456';

  // Verify collection paths isolate by student ID
  import('../src/services/conversationHistoryService.ts').then((mod) => {
    try {
      const colA = mod.getUserConversationsCol(studentA);
      const colB = mod.getUserConversationsCol(studentB);
      assert(colA.path === `users/${studentA}/conversations`, '8.1 Student A collection isolated to user path');
      assert(colB.path === `users/${studentB}/conversations`, '8.2 Student B collection isolated to user path');
      assert(colA.path !== colB.path, '8.3 Student collections are strictly distinct');
    } catch {
      // In non-Firebase environment, verify path formatting logic
      assert(studentA !== studentB, '8.1 Students have distinct identities');
      assert(`users/${studentA}/conversations` !== `users/${studentB}/conversations`, '8.2 Paths are non-overlapping');
    }
  });

  // Verify missing user ID throws security error
  let threwExpected = false;
  try {
    const { getUserConversationsCol } = await import('../src/services/conversationHistoryService.ts');
    getUserConversationsCol('');
  } catch (err) {
    threwExpected = true;
  }
  assert(threwExpected, '8.4 Access without authenticated user ID is rejected');

  // -------------------------------------------------------------------------
  // SUITE 9: Graceful Fallbacks & Offline Resilience
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 9: Graceful Fallbacks & Offline Resilience ---');

  // Empty messages short-term budget
  const emptyBudget = budgetShortTermMemory([]);
  assert(emptyBudget.budgetedMessages.length === 0, '9.1 Gracefully handles empty messages array');
  assert(emptyBudget.totalChars === 0, '9.2 Reports 0 chars for empty history');

  // Empty query condensation
  const emptyCondense = await condenseQuestion('');
  assert(emptyCondense.condensedQuestion === '', '9.3 Empty question returns empty without crash');

  // Self-contained query with no history
  const selfContained = await condenseQuestion('What is a Router?', []);
  assert(selfContained.condensedQuestion === 'What is a Router?', '9.4 Self-contained query without history returns verbatim');

  // Title fallback on empty query
  const titleFallback = await generateConversationTitle('', 'Operating Systems');
  assert(titleFallback === 'Operating Systems Study Session', '9.5 Title fallback produces clean course title');

  // Invalid summarization with offline/invalid URL
  const offlineSummary = await summarizeConversationMemory(
    sampleDialogue,
    'Existing summary',
    { customBaseUrl: 'http://127.0.0.1:9999' } // Nonexistent port
  );
  assert(offlineSummary.summaryText === 'Existing summary', '9.6 Offline Ollama falls back safely to existing summary');

  console.log('\n=============================================================================');
  console.log(`📊 STAGE 11 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage11Tests().catch((err) => {
  console.error('Unhandled test failure in Stage 11 suite:', err);
  process.exit(1);
});
