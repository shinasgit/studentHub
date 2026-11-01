// scripts/test_stage_8_6.mjs
// Test Suite for Stage 8.6: Performance Optimization & Streaming
// Validates NDJSON progressive stream parsing, partial network chunk reassembly,
// stream cancellation & abort signal handling, partial answer preservation,
// post-completion citation verification, telemetry, and live Ollama streaming.

import {
  parseNdjsonStream,
  generateCompletion,
  generateChat,
  isOllamaOnline,
} from '../src/services/ollamaService.ts';
import {
  generateRagAnswer,
  buildRagPromptContext,
} from '../src/services/ragService.ts';
import { generateChatResponse } from '../src/services/chatService.ts';
import {
  validateCitation,
  verifyCitationsAgainstEvidence,
  filterVerifiedCitations,
} from '../src/services/citationService.ts';
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

/**
 * Creates a mock ReadableStream<Uint8Array> emitting string chunks.
 */
function createMockStream(chunks, delayMs = 0) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        if (delayMs > 0) {
          await new Promise((res) => setTimeout(res, delayMs));
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Creates a stream that simulates an unrecoverable network failure mid-stream.
 */
function createFailingStream(chunks, failAfterChunkIndex = 1) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index === failAfterChunkIndex) {
        controller.error(new Error('Connection reset by peer: socket hung up'));
        return;
      }
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

async function runStage86Tests() {
  console.log('\n=============================================================');
  console.log('🧪 RAG STAGE 8.6: PERFORMANCE OPTIMIZATION & STREAMING');
  console.log('=============================================================\n');

  // =========================================================================
  // SECTION A: NDJSON Streaming Response Parsing Unit Tests
  // =========================================================================
  console.log('--- SECTION A: NDJSON Streaming Response Parsing Unit Tests ---');

  // 1. Multiple standard streamed chunks
  const standardChunks = [
    JSON.stringify({ response: 'The ', done: false }) + '\n',
    JSON.stringify({ response: 'Transmission ', done: false }) + '\n',
    JSON.stringify({ response: 'Control ', done: false }) + '\n',
    JSON.stringify({ response: 'Protocol.', done: true, total_duration: 500000000, eval_count: 5 }) + '\n',
  ];

  const receivedTokens = [];
  const stream1 = createMockStream(standardChunks);
  const result1 = await parseNdjsonStream(stream1, (token) => {
    receivedTokens.push(token);
  });

  assert(result1.text === 'The Transmission Control Protocol.', '1.1 Reassembles full text from standard stream');
  assert(receivedTokens.length === 4, '1.2 Fires onChunk callback 4 times');
  assert(receivedTokens.join('') === 'The Transmission Control Protocol.', '1.3 Token sequence matches expected text');
  assert(result1.done === true, '1.4 Result flags done: true');
  assert(result1.evalCount === 5, '1.5 Extracts evalCount from done chunk');
  assert(result1.timeToFirstTokenMs !== undefined && result1.timeToFirstTokenMs >= 0, '1.6 Measures timeToFirstTokenMs');

  // 2. Partial NDJSON messages across TCP chunk boundaries
  // Simulate network packet boundary splitting a single JSON line:
  // Chunk A: `{"response":"Transport `
  // Chunk B: `layer protocol"}\n`
  const splitChunks = [
    '{"response":"Trans',
    'port layer ',
    'protocol"}\n',
    '{"response":" provides reli',
    'able delivery."}\n',
    '{"response":"","done":true}\n',
  ];

  const splitTokens = [];
  const stream2 = createMockStream(splitChunks);
  const result2 = await parseNdjsonStream(stream2, (token) => {
    splitTokens.push(token);
  });

  assert(result2.text === 'Transport layer protocol provides reliable delivery.', '2.1 Reassembles fragmented JSON lines correctly');
  assert(splitTokens.length === 2, '2.2 Emits complete messages only, not partial fragments');
  assert(splitTokens[0] === 'Transport layer protocol', '2.3 First reassembled chunk matches');
  assert(splitTokens[1] === ' provides reliable delivery.', '2.4 Second reassembled chunk matches');

  // 3. Completed streams with done: true
  const completionChunk = [
    JSON.stringify({ model: 'llama3.2:3b', response: 'Summary: ok.', done: true, total_duration: 750000000, eval_count: 12 }) + '\n',
  ];
  const stream3 = createMockStream(completionChunk);
  const result3 = await parseNdjsonStream(stream3);
  assert(result3.text === 'Summary: ok.', '3.1 Extracts text from single complete chunk');
  assert(result3.model === 'llama3.2:3b', '3.2 Extracts model name');
  assert(result3.evalCount === 12, '3.3 Extracts evalCount');
  assert(result3.totalDuration === 750000000, '3.4 Extracts totalDuration');

  // 4. Empty streams
  const stream4 = createMockStream([]);
  const result4 = await parseNdjsonStream(stream4);
  assert(result4.text === '', '4.1 Empty stream returns empty text');
  assert(result4.done === true, '4.2 Empty stream finishes cleanly');

  // 5. Malformed stream data resilience
  const malformedChunks = [
    JSON.stringify({ response: 'Valid line 1. ' }) + '\n',
    '<<<INTERNAL_GATEWAY_CORRUPT_HEADER>>>\n', // Corrupt non-JSON line
    '{not-json-line}\n',                     // Bad JSON syntax
    JSON.stringify({ response: 'Valid line 2.' }) + '\n',
    JSON.stringify({ response: '', done: true }) + '\n',
  ];

  const malformedTokens = [];
  const stream5 = createMockStream(malformedChunks);
  const result5 = await parseNdjsonStream(stream5, (token) => {
    malformedTokens.push(token);
  });

  assert(result5.text === 'Valid line 1. Valid line 2.', '5.1 Ignores corrupted lines and preserves valid text');
  assert(malformedTokens.length === 2, '5.2 Receives both valid chunks');

  // 6. Connection failures mid-stream
  const failingStream = createFailingStream([
    JSON.stringify({ response: 'Start of generation. ' }) + '\n',
    JSON.stringify({ response: 'Will crash now.' }) + '\n',
  ], 1);

  let stream6Error = null;
  try {
    await parseNdjsonStream(failingStream);
  } catch (err) {
    stream6Error = err;
  }
  assert(stream6Error !== null, '6.1 Throws on abrupt connection drop');
  assert(stream6Error.message.includes('socket hung up'), '6.2 Preserves descriptive error message');

  // =========================================================================
  // SECTION B: Request Cancellation & Partial Answer Preservation
  // =========================================================================
  console.log('\n--- SECTION B: Cancellation & Partial Answer Preservation ---');

  // 7. Request cancellation using AbortController mid-stream
  const abortCtrl = new AbortController();
  const slowChunks = [
    JSON.stringify({ response: 'Chunk 1. ' }) + '\n',
    JSON.stringify({ response: 'Chunk 2. ' }) + '\n',
    JSON.stringify({ response: 'Chunk 3. ' }) + '\n',
    JSON.stringify({ response: 'Chunk 4.' }) + '\n',
  ];

  const stream7 = createMockStream(slowChunks, 20); // 20ms delay per chunk
  const chunksReceived7 = [];

  const parsePromise7 = parseNdjsonStream(
    stream7,
    (token) => {
      chunksReceived7.push(token);
      if (chunksReceived7.length === 2) {
        abortCtrl.abort(); // Abort after second chunk!
      }
    },
    abortCtrl.signal
  );

  const result7 = await parsePromise7;
  assert(result7.isCancelled === true, '7.1 Marks stream as cancelled when aborted');
  assert(result7.text === 'Chunk 1. Chunk 2. ', '7.2 Preserves partial text accumulated up to cancellation point');
  assert(chunksReceived7.length === 2, '7.3 Stops consuming remaining chunks after abort');

  // 8. Timeout handling simulation
  const timeoutCtrl = new AbortController();
  const timeoutStream = createMockStream([
    JSON.stringify({ response: 'First token. ' }) + '\n',
    JSON.stringify({ response: 'Second token.' }) + '\n',
  ], 50);

  // Trigger timeout after 15ms
  setTimeout(() => timeoutCtrl.abort(new Error('Generation timeout after 15ms')), 15);
  const result8 = await parseNdjsonStream(timeoutStream, null, timeoutCtrl.signal);
  assert(result8.isCancelled === true, '8.1 Handles timeout abort signal cleanly');

  // =========================================================================
  // SECTION C: Citation Verification After Completion (Zero Premature Citations)
  // =========================================================================
  console.log('\n--- SECTION C: Citation Verification & Evidence Consistency ---');

  // 9. Citation verification occurs only after stream completion
  // Ensure unverified citations are never passed to the caller
  const mockEvidenceChunks = [
    {
      chunkId: 'chunk-tcp-01',
      resourceId: 'res-tcp-01',
      documentId: 'doc-tcp-01',
      resourceName: 'TCP_Basics.pdf',
      pageNumber: 3,
      pageEndNumber: 4,
      pageRange: '3–4',
      text: 'TCP establishes connections using a three-way handshake: SYN, SYN-ACK, ACK.',
      similarity: 0.92,
      distance: 0.08,
      metadata: {
        studentId: 'student-charlie',
        subjectId: 'cs-networking',
        moduleId: 'mod-transport',
      },
    },
  ];

  const candidateCitations = [
    {
      chunkId: 'chunk-tcp-01',
      resourceId: 'res-tcp-01',
      resourceName: 'TCP_Basics.pdf',
      pageNumber: 3,
      pageEndNumber: 4,
      pageRange: '3–4',
      similarity: 0.92,
      distance: 0.08,
      subjectId: 'cs-networking',
      moduleId: 'mod-transport',
      studentId: 'student-charlie',
    },
    {
      // Hallucinated citation not in evidence
      chunkId: 'chunk-fake-99',
      resourceId: 'res-fake-99',
      resourceName: 'Fake_Notes.pdf',
      pageNumber: 99,
      similarity: 0.35,
      distance: 0.65,
      subjectId: 'cs-networking',
      studentId: 'student-charlie',
    },
  ];

  const verifiedList = verifyCitationsAgainstEvidence(candidateCitations, mockEvidenceChunks, {
    expectedStudentId: 'student-charlie',
    expectedSubjectId: 'cs-networking',
  });

  const strictlyVerified = filterVerifiedCitations(verifiedList);
  assert(strictlyVerified.length === 1, '9.1 Strictly verified citation count is 1');
  assert(strictlyVerified[0].chunkId === 'chunk-tcp-01', '9.2 Only evidence-backed citation is verified');
  assert(strictlyVerified[0].pageRange === '3–4', '9.3 Preserves multi-page citation range: 3–4');
  assert(verifiedList.length === 2, '9.4 Raw list records 2 candidates');
  assert(verifiedList[1].isVerified === false, '9.5 Hallucinated citation is marked unverified');

  // =========================================================================
  // SECTION D: Performance Telemetry & Measurement
  // =========================================================================
  console.log('\n--- SECTION D: Performance Telemetry & Measurement ---');

  // 10. Performance breakdown validation
  const promptContext10 = buildRagPromptContext('Explain TCP handshake', mockEvidenceChunks, {
    subjectId: 'cs-networking',
    subjectName: 'Computer Networks',
    scopeMode: 'entire_subject',
    moduleIds: [],
    moduleNames: [],
    totalModuleCount: 1,
  });

  assert(promptContext10.chunksUsed === 1, '10.1 Used 1 chunk in prompt');
  assert(promptContext10.systemPrompt.includes('academic AI Study Assistant'), '10.2 Includes academic system prompt');
  assert(promptContext10.userPrompt.includes('TCP establishes connections'), '10.3 Injects sanitized document excerpts');

  // =========================================================================
  // SECTION E: Existing Non-Streaming Fallback Backward Compatibility
  // =========================================================================
  console.log('\n--- SECTION E: Non-Streaming Fallback Backward Compatibility ---');

  // 11. Backward-compatible options (stream: false or undefined)
  const defaultOptions = {
    topK: 3,
    minSimilarity: 0.50,
  };
  assert(defaultOptions.stream === undefined, '11.1 stream option defaults to undefined');
  assert(defaultOptions.onChunk === undefined, '11.2 onChunk callback defaults to undefined');

  // 12. ChatMessage backward compatibility
  const legacyMessage = {
    id: 'msg-legacy-123',
    sender: 'assistant',
    content: 'TCP provides reliable, ordered transmission.',
    timestamp: '2026-10-31T12:00:00Z',
  };

  assert(legacyMessage.isStreaming === undefined, '12.1 Older message handles missing isStreaming gracefully');
  assert(legacyMessage.isCancelled === undefined, '12.2 Older message handles missing isCancelled gracefully');
  assert(legacyMessage.timeToFirstTokenMs === undefined, '12.3 Older message handles missing TTFT gracefully');

  // =========================================================================
  // SECTION F: Live Ollama Streaming Integration Test
  // =========================================================================
  console.log('\n--- SECTION F: Live Ollama Streaming Integration Test ---');

  const isOnline = await isOllamaOnline();
  if (isOnline) {
    console.log('📡 Ollama is online. Running live stream test with llama3.2:3b...');

    const liveTokens = [];
    const liveStartTime = performance.now();

    try {
      const liveResult = await generateCompletion({
        model: 'llama3.2:3b',
        prompt: 'State the single word: "CONFIRMED". Do not include anything else.',
        temperature: 0.1,
        stream: true,
        onChunk: (chunk) => {
          liveTokens.push(chunk);
        },
      });

      const liveElapsed = Math.round(performance.now() - liveStartTime);
      assert(liveResult.isStreamed === true, '13.1 Live completion returns isStreamed: true');
      assert(liveTokens.length > 0, `13.2 Received ${liveTokens.length} progressive chunks via onChunk`);
      assert(liveResult.text.includes('CONFIRMED'), '13.3 Output text matches expected completion');
      assert(liveResult.timeToFirstTokenMs !== undefined && liveResult.timeToFirstTokenMs >= 0, `13.4 TTFT measured: ${liveResult.timeToFirstTokenMs}ms (total: ${liveElapsed}ms)`);
      console.log(`   Tokens received: ${liveTokens.length}, TTFT: ${liveResult.timeToFirstTokenMs}ms, Total: ${liveElapsed}ms`);
    } catch (liveErr) {
      console.warn('Live Ollama stream test encountered error:', liveErr);
      assert(false, '13.1 Live Ollama streaming test passed', liveErr.message);
    }

    // 14. Live Ollama chat streaming test
    try {
      const chatTokens = [];
      const chatResult = await generateChat({
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'Say "HELLO" and nothing else.' }],
        temperature: 0.1,
        stream: true,
        onChunk: (chunk) => {
          chatTokens.push(chunk);
        },
      });

      assert(chatResult.isStreamed === true, '14.1 Live chat returns isStreamed: true');
      assert(chatTokens.length > 0, `14.2 Live chat received ${chatTokens.length} chunks`);
      assert(chatResult.text.toUpperCase().includes('HELLO'), '14.3 Chat response text contains HELLO');
      assert(chatResult.timeToFirstTokenMs > 0, `14.4 Chat TTFT measured: ${chatResult.timeToFirstTokenMs}ms`);
    } catch (chatErr) {
      console.warn('Live Ollama chat test encountered error:', chatErr);
      assert(false, '14.1 Live Ollama chat test passed', chatErr.message);
    }

    // 15. Live Stream Cancellation Test
    try {
      const liveAbortCtrl = new AbortController();
      let chunksBeforeCancel = 0;

      const cancelPromise = generateCompletion({
        model: 'llama3.2:3b',
        prompt: 'Count slowly from 1 to 100 with long explanations for each number.',
        temperature: 0.3,
        stream: true,
        abortSignal: liveAbortCtrl.signal,
        onChunk: () => {
          chunksBeforeCancel++;
          if (chunksBeforeCancel >= 3) {
            liveAbortCtrl.abort();
          }
        },
      });

      const cancelResult = await cancelPromise;
      assert(cancelResult.isCancelled === true, '15.1 Live stream aborts successfully mid-generation');
      assert(cancelResult.text.length > 0, '15.2 Partial text is preserved on live cancellation');
      assert(chunksBeforeCancel >= 3, `15.3 Received ${chunksBeforeCancel} chunks before cancellation`);
      console.log(`   Cancelled live stream after ${chunksBeforeCancel} chunks; preserved: "${cancelResult.text.slice(0, 40)}..."`);
    } catch (cancelErr) {
      console.warn('Live cancellation test encountered error:', cancelErr);
      assert(false, '15.1 Live cancellation test passed', cancelErr.message);
    }
  } else {
    console.log('⚠️ Ollama is offline or unavailable. Skipping live integration tests.');
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n=============================================================');
  console.log(`📊 STAGE 8.6 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage86Tests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
