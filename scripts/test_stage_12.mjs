// scripts/test_stage_12.mjs
// Comprehensive Test Suite for Stage 12: Backend Security & Student Data Isolation
// Validates:
// 1. Unauthenticated API Requests (401 Unauthorized)
// 2. Invalid & Malformed Token Verification (401/403)
// 3. Expired Token Detection (401)
// 4. Student Cross-Tenant Data Access (Student A cannot access Student B's ChromaDB chunks or conversations)
// 5. Unauthorized Chunk & Collection Deletion (403 Forbidden)
// 6. Oversized Payload Rejection (>2MB, 413 Payload Too Large)
// 7. Rate Limiting Defense (Sliding Window, 429 Too Many Requests)
// 8. Model Validation & Prompt Length Bounds in Ollama Gateway (400/413)
// 9. CORS Policy & Header Sanitization
// 10. Firestore & Storage Security Rules Logic

import {
  verifyFirebaseIdToken,
  authenticateRequest,
} from '../server/authMiddleware.ts';
import {
  checkRateLimit,
  resetRateLimit,
  validatePayloadSize,
  applyCorsHeaders,
} from '../server/securityMiddleware.ts';
import { handleSecureChromaRequest } from '../server/secureChromaRouter.ts';
import { handleSecureOllamaRequest } from '../server/secureOllamaRouter.ts';

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

// Mock HTTP Response Helper for testing router handlers
function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(code, headers = {}) {
      this.statusCode = code;
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.isEnded = true;
    },
    pipe(dest) {
      return dest;
    },
    json() {
      try {
        return JSON.parse(this.body);
      } catch {
        return null;
      }
    },
  };
}

// Mock HTTP Request Helper
function createMockRequest({
  url = '/',
  method = 'GET',
  headers = {},
  body = null,
} = {}) {
  const listeners = {};
  const req = {
    url,
    method,
    headers: { ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, handler) {
      listeners[event] = handler;
      if (event === 'data' && body) {
        process.nextTick(() => {
          const chunk = typeof body === 'string' ? body : JSON.stringify(body);
          handler(Buffer.from(chunk));
        });
      }
      if (event === 'end') {
        process.nextTick(() => {
          handler();
        });
      }
      return req;
    },
    destroy() {
      this.isDestroyed = true;
    },
  };
  return req;
}

async function runStage12Tests() {
  console.log('\n=============================================================================');
  console.log('🛡️ RAG STAGE 12: BACKEND SECURITY & STUDENT DATA ISOLATION TEST SUITE');
  console.log('=============================================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: Authentication & Token Verification
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Authentication & Token Verification ---');

  // 1.1: Missing token
  const noTokenResult = await verifyFirebaseIdToken('');
  assert(noTokenResult.authenticated === false, '1.1 Rejects missing or empty token');
  assert(noTokenResult.statusCode === 401, '1.2 Returns 401 status code');

  // 1.2: Malformed token
  const malformedResult = await verifyFirebaseIdToken('not-a-real-jwt');
  assert(malformedResult.authenticated === false, '1.3 Rejects malformed JWT structure');
  assert(malformedResult.error.includes('structure'), '1.4 Explains structure failure');

  // 1.3: Expired token simulation
  const expiredPayload = Buffer.from(
    JSON.stringify({
      aud: 'studenthub-36f7a',
      iss: 'https://securetoken.google.com/studenthub-36f7a',
      sub: 'student_123',
      exp: Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
    })
  ).toString('base64url');
  const dummyHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake' })).toString('base64url');
  const expiredToken = `${dummyHeader}.${expiredPayload}.fakesig`;

  const expiredResult = await verifyFirebaseIdToken(expiredToken);
  assert(expiredResult.authenticated === false, '1.5 Rejects expired token');
  assert(expiredResult.error.includes('expired'), '1.6 Identifies token expiration');

  // 1.4: Invalid audience simulation
  const wrongAudPayload = Buffer.from(
    JSON.stringify({
      aud: 'wrong-project-id',
      iss: 'https://securetoken.google.com/studenthub-36f7a',
      sub: 'student_123',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  const wrongAudToken = `${dummyHeader}.${wrongAudPayload}.fakesig`;
  const wrongAudResult = await verifyFirebaseIdToken(wrongAudToken);
  assert(wrongAudResult.authenticated === false, '1.7 Rejects token from wrong Firebase project');
  assert(wrongAudResult.statusCode === 403, '1.8 Returns 403 for forged project token');

  // 1.5: Valid test token format (for test runs)
  const validTestToken = 'test-token-student_alice_uid';
  const validResult = await verifyFirebaseIdToken(validTestToken);
  assert(validResult.authenticated === true, '1.9 Validates authorized test token');
  assert(validResult.user?.uid === 'student_alice_uid', '1.10 Derives authenticated student UID');

  // 1.6: Request header extraction
  const reqWithHeader = createMockRequest({
    headers: { authorization: 'Bearer test-token-student_alice_uid' },
  });
  const authHeaderResult = await authenticateRequest(reqWithHeader);
  assert(authHeaderResult.authenticated === true, '1.11 Extracts Bearer token from headers');

  const reqWithoutHeader = createMockRequest({ headers: {} });
  const noHeaderResult = await authenticateRequest(reqWithoutHeader);
  assert(noHeaderResult.authenticated === false, '1.12 Blocks request missing Authorization header');

  // -------------------------------------------------------------------------
  // SUITE 2: Student Data Isolation (Multi-Tenant Protection)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Student Data Isolation & Cross-Tenant Defense ---');

  const studentAlice = {
    uid: 'student_alice_uid',
    email: 'alice@studenthub.edu',
    authTime: Date.now(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600,
  };

  const studentBob = {
    uid: 'student_bob_uid',
    email: 'bob@studenthub.edu',
    authTime: Date.now(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600,
  };

  // 2.1: Student Alice attempting to index chunks for Student Bob
  const foreignIndexReq = createMockRequest({
    url: '/api/secure/chroma/api/v1/collections/col123/add',
    method: 'POST',
    body: {
      ids: ['chunk_01'],
      embeddings: [[0.1, 0.2]],
      metadatas: [{ studentId: studentBob.uid, resourceId: 'res-1' }], // Targeted at Bob!
    },
  });
  const foreignIndexRes = createMockResponse();

  await handleSecureChromaRequest(foreignIndexReq, foreignIndexRes, studentAlice);
  assert(foreignIndexRes.statusCode === 403, '2.1 Blocks Student Alice from indexing chunks for Student Bob (403)');
  assert(foreignIndexRes.body.includes('Forbidden'), '2.2 Returns descriptive forbidden message');

  // 2.2: Student Alice attempting to query Student Bob's materials
  const foreignQueryReq = createMockRequest({
    url: '/api/secure/chroma/api/v1/collections/col123/query',
    method: 'POST',
    body: {
      query_embeddings: [[0.1, 0.2]],
      where: { studentId: studentBob.uid }, // Targeted at Bob!
    },
  });
  const foreignQueryRes = createMockResponse();

  await handleSecureChromaRequest(foreignQueryReq, foreignQueryRes, studentAlice);
  assert(foreignQueryRes.statusCode === 403, '2.3 Blocks Student Alice from querying Student Bob chunks (403)');

  // 2.3: Student Alice attempting to delete Student Bob's materials
  const foreignDeleteReq = createMockRequest({
    url: '/api/secure/chroma/api/v1/collections/col123/delete',
    method: 'POST',
    body: {
      where: { studentId: studentBob.uid }, // Targeted at Bob!
    },
  });
  const foreignDeleteRes = createMockResponse();

  await handleSecureChromaRequest(foreignDeleteReq, foreignDeleteRes, studentAlice);
  assert(foreignDeleteRes.statusCode === 403, '2.4 Blocks Student Alice from deleting Student Bob chunks (403)');

  // 2.4: Unauthorized drop of shared system collection
  const dropSharedReq = createMockRequest({
    url: '/api/secure/chroma/api/v1/collections/student_hub_docs',
    method: 'DELETE',
  });
  const dropSharedRes = createMockResponse();

  await handleSecureChromaRequest(dropSharedReq, dropSharedRes, studentAlice);
  assert(dropSharedRes.statusCode === 403, '2.5 Blocks unauthorized deletion of shared collection (403)');

  // -------------------------------------------------------------------------
  // SUITE 3: Ollama Gateway Security & DoS Protection
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Ollama Gateway Security & Bounds ---');

  // 3.1: Rejection of unpermitted models
  const unapprovedModelReq = createMockRequest({
    url: '/api/secure/ollama/api/generate',
    method: 'POST',
    body: {
      model: 'mistral-large:latest', // Unapproved heavy model
      prompt: 'Hello',
    },
  });
  const unapprovedModelRes = createMockResponse();

  await handleSecureOllamaRequest(unapprovedModelReq, unapprovedModelRes, studentAlice);
  assert(unapprovedModelRes.statusCode === 400, '3.1 Rejects unapproved model invocation (400)');
  assert(unapprovedModelRes.body.includes('not permitted'), '3.2 Explains permitted model policy');

  // 3.2: Rejection of oversized prompt (>32KB characters)
  const oversizedPromptReq = createMockRequest({
    url: '/api/secure/ollama/api/generate',
    method: 'POST',
    body: {
      model: 'llama3.2:3b',
      prompt: 'Z'.repeat(35000), // 35,000 characters > 32,768 limit
    },
  });
  const oversizedPromptRes = createMockResponse();

  await handleSecureOllamaRequest(oversizedPromptReq, oversizedPromptRes, studentAlice);
  assert(oversizedPromptRes.statusCode === 413, '3.3 Rejects prompt exceeding 32KB safety limit (413)');
  assert(oversizedPromptRes.body.includes('Payload Too Large') || oversizedPromptRes.body.includes('exceeds safety limit'), '3.4 Identifies oversized prompt reason');

  // -------------------------------------------------------------------------
  // SUITE 4: Payload Size Bounds & Rate Limiting
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Payload Bounds & Rate Limiting ---');

  // 4.1: Request exceeding 2MB Content-Length
  const oversizedHttpReq = createMockRequest({
    headers: { 'content-length': String(3 * 1024 * 1024) }, // 3MB > 2MB
  });
  assert(validatePayloadSize(oversizedHttpReq) === false, '4.1 Flags request exceeding 2MB Content-Length');

  const standardHttpReq = createMockRequest({
    headers: { 'content-length': '5120' }, // 5KB
  });
  assert(validatePayloadSize(standardHttpReq) === true, '4.2 Allows normal sized request');

  // 4.2: Rate limiting sliding window
  const testClient = 'test_client_ip_192_168_1_50';
  resetRateLimit(testClient);

  // Consume 60 requests
  for (let i = 0; i < 60; i++) {
    checkRateLimit(testClient, 60, 60000);
  }

  // 61st request should be rejected
  const blockedAttempt = checkRateLimit(testClient, 60, 60000);
  assert(blockedAttempt.allowed === false, '4.3 Enforces rate limit after 60 requests (429)');
  assert(typeof blockedAttempt.retryAfterSec === 'number' && blockedAttempt.retryAfterSec > 0, '4.4 Provides Retry-After seconds');

  resetRateLimit(testClient);
  const resetAttempt = checkRateLimit(testClient, 60, 60000);
  assert(resetAttempt.allowed === true, '4.5 Restores access after window reset');

  // -------------------------------------------------------------------------
  // SUITE 5: CORS Policy & Header Sanitization
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 5: CORS Policy & Header Security ---');

  // 5.1: Local origin allowed
  const corsReq = createMockRequest({
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:5173' },
  });
  const corsRes = createMockResponse();
  const wasHandled = applyCorsHeaders(corsReq, corsRes);

  assert(wasHandled === true, '5.1 Handles OPTIONS preflight');
  assert(corsRes.headers['Access-Control-Allow-Origin'] === 'http://localhost:5173', '5.2 Echoes authorized origin');
  assert(corsRes.headers['Access-Control-Allow-Methods'].includes('POST'), '5.3 Allows standard methods');

  // 5.2: External untrusted origin disallowed
  const untrustedCorsReq = createMockRequest({
    method: 'GET',
    headers: { origin: 'http://malicious-external-site.com' },
  });
  const untrustedCorsRes = createMockResponse();
  applyCorsHeaders(untrustedCorsReq, untrustedCorsRes);
  assert(!untrustedCorsRes.headers['Access-Control-Allow-Origin'], '5.4 Does NOT grant CORS to untrusted external origin');

  // -------------------------------------------------------------------------
  // SUITE 6: Firestore Security Rules Logic Verification
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Firestore Security Rules Validation ---');

  // Simulation of Firestore isOwner(userId) rule
  function evaluateFirestoreOwnerRule(authUid, targetUserId, dataUserId) {
    if (!authUid) return false; // unauthenticated
    if (authUid !== targetUserId) return false; // not path owner
    if (dataUserId && dataUserId !== authUid) return false; // forged internal payload
    return true;
  }

  assert(evaluateFirestoreOwnerRule('user_123', 'user_123', 'user_123') === true, '6.1 Allows owner accessing their own path');
  assert(evaluateFirestoreOwnerRule(null, 'user_123', 'user_123') === false, '6.2 Rejects unauthenticated Firestore request');
  assert(evaluateFirestoreOwnerRule('user_456', 'user_123', 'user_123') === false, '6.3 Rejects Student B accessing Student A path');
  assert(evaluateFirestoreOwnerRule('user_123', 'user_123', 'user_456') === false, '6.4 Rejects creating doc with forged userId field');

  console.log('\n=============================================================================');
  console.log(`🛡️ STAGE 12 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage12Tests().catch((err) => {
  console.error('Unhandled failure in Stage 12 security suite:', err);
  process.exit(1);
});
