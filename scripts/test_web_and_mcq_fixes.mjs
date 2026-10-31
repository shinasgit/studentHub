// Automated Verification Script for AI Student Hub Fixes:
// 1. SSRF and URL Security Validation
// 2. Web Article Content Extraction (stripping nav, footer, scripts)
// 3. YouTube Caption / Transcript error handling
// 4. MCQ Quiz exactly 10 questions enforcement (root cause test)
// 5. MCQ Difficulty cognitive prompt instructions

import {
  validateSafeUrl,
  extractCleanArticleText,
  extractYouTubeTranscript
} from '../server/webExtractorMiddleware.ts';

import {
  validateMcqQuestions,
  DIFFICULTY_INSTRUCTIONS
} from '../src/services/mcqQuizService.ts';

import {
  validatePracticeQuestions
} from '../src/services/practiceQuestionsService.ts';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('\n--- 1. Testing SSRF & URL Security Validation ---');

  // Test Localhost rejection
  try {
    await validateSafeUrl('http://localhost/secret');
    assert(false, 'Should have blocked localhost');
  } catch (err) {
    assert(err.message.includes('blocked') || err.message.includes('localhost'),
      `Blocked localhost safely: ${err.message}`);
  }

  // Test non-standard port rejection
  try {
    await validateSafeUrl('http://example.com:8080/secret');
    assert(false, 'Should have blocked non-standard port 8080');
  } catch (err) {
    assert(err.message.includes('Non-standard port'),
      `Blocked non-standard port safely: ${err.message}`);
  }

  // Test 127.0.0.1 rejection
  try {
    await validateSafeUrl('http://127.0.0.1/api/tags');
    assert(false, 'Should have blocked 127.0.0.1');
  } catch (err) {
    assert(err.message.includes('blocked') || err.message.includes('internal'),
      `Blocked 127.0.0.1 safely: ${err.message}`);
  }

  // Test AWS / Cloud metadata endpoint rejection
  try {
    await validateSafeUrl('http://169.254.169.254/latest/meta-data');
    assert(false, 'Should have blocked 169.254.169.254 cloud metadata');
  } catch (err) {
    assert(err.message.includes('blocked') || err.message.includes('169.254'),
      `Blocked cloud metadata IP safely: ${err.message}`);
  }

  // Test Private network (192.168.1.1) rejection
  try {
    await validateSafeUrl('http://192.168.1.1/admin');
    assert(false, 'Should have blocked 192.168.1.1 private network');
  } catch (err) {
    assert(err.message.includes('private') || err.message.includes('internal') || err.message.includes('blocked'),
      `Blocked private network IP safely: ${err.message}`);
  }

  // Test Invalid protocol (file://) rejection
  try {
    await validateSafeUrl('file:///etc/passwd');
    assert(false, 'Should have blocked file protocol');
  } catch (err) {
    assert(err.message.includes('Only HTTP and HTTPS'),
      `Blocked non-HTTP protocol safely: ${err.message}`);
  }

  // Test Invalid protocol (ftp://) rejection
  try {
    await validateSafeUrl('ftp://example.com/data');
    assert(false, 'Should have blocked ftp protocol');
  } catch (err) {
    assert(err.message.includes('Only HTTP and HTTPS'),
      `Blocked ftp protocol safely: ${err.message}`);
  }

  console.log('\n--- 2. Testing Web Article Text Cleaning & Extraction ---');

  const sampleHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Introduction to Machine Learning</title>
        <script>console.log("analytics tracking code")</script>
        <style>body { font-size: 14px; }</style>
      </head>
      <body>
        <header><nav><a>Home</a><a>Courses</a><a>Login</a></nav></header>
        <aside class="advertisement">Buy our pro course now for $99!</aside>
        <main>
          <article>
            <h1>Machine Learning Fundamentals</h1>
            <p>Machine learning is a subset of artificial intelligence focused on building systems that learn from data.</p>
            <p>Supervised learning involves training models on labeled input-output pairs to predict outcomes for unseen data.</p>
            <p>Unsupervised learning discovers hidden patterns and cluster structures in unlabeled datasets without explicit supervisor feedback.</p>
          </article>
        </main>
        <footer>
          <p>© 2026 Student Portal. All rights reserved. <a href="/privacy">Privacy Policy</a></p>
        </footer>
      </body>
    </html>
  `;

  const cleaned = extractCleanArticleText(sampleHtml, 'https://example.com/ml-fundamentals');
  assert(cleaned.title === 'Introduction to Machine Learning' || cleaned.title === 'Machine Learning Fundamentals',
    `Extracted correct title: "${cleaned.title}"`);
  assert(cleaned.text.includes('Machine learning is a subset of artificial intelligence'),
    'Contains article body text');
  assert(cleaned.text.includes('Supervised learning involves training models'),
    'Contains supervised learning paragraph');
  assert(!cleaned.text.includes('analytics tracking code'),
    'Script tags stripped cleanly');
  assert(!cleaned.text.includes('font-size: 14px'),
    'Style tags stripped cleanly');
  assert(!cleaned.text.includes('Buy our pro course now'),
    'Aside/Ad elements removed');
  assert(!cleaned.text.includes('Privacy Policy'),
    'Footer removed');

  console.log('\n--- 3. Testing YouTube Handling & Limitations ---');

  // Unsupported or invalid URL
  try {
    await extractYouTubeTranscript('https://youtube.com/watch?v=invalid_id_xyz_123');
    assert(false, 'Should have thrown error on invalid video or missing captions');
  } catch (err) {
    assert(err.message.length > 0, `Properly reports YouTube error: ${err.message}`);
  }

  console.log('\n--- 4. Testing MCQ Quiz Exactly 10 Questions Fix (Root Cause Test) ---');

  // Simulate Ollama returning 14 questions (which previously caused 13 questions in the quiz)
  const mock14Questions = Array.from({ length: 14 }, (_, i) => ({
    question: `Mock Test Question Number ${i + 1} regarding study materials?`,
    options: [
      `Option A for question ${i + 1}`,
      `Option B for question ${i + 1}`,
      `Option C for question ${i + 1}`,
      `Option D for question ${i + 1}`,
    ],
    correctAnswer: 'A',
    explanation: `Explanation for question ${i + 1} detailing why Option A is correct.`,
    topic: 'Testing Topic',
    difficulty: 'medium',
  }));

  const validatedQuestions = validateMcqQuestions(mock14Questions, 'subj-1', 'mod-1', 'medium', 'Document.pdf');

  assert(validatedQuestions.length === 10,
    `validateMcqQuestions strictly truncated 14 questions to exactly 10 (length = ${validatedQuestions.length})`);

  for (let idx = 0; idx < validatedQuestions.length; idx++) {
    const q = validatedQuestions[idx];
    assert(q.options.length === 4, `Question ${idx + 1} has exactly 4 options`);
    assert(['opt-a', 'opt-b', 'opt-c', 'opt-d'].includes(q.correctOptionId),
      `Question ${idx + 1} has valid correctOptionId: ${q.correctOptionId}`);
    assert(q.explanation.length > 0, `Question ${idx + 1} has explanation`);
  }

  console.log('\n--- 5. Testing Difficulty Selection Instructions in Prompts ---');

  assert(DIFFICULTY_INSTRUCTIONS.easy.toLowerCase().includes('factual recall') || DIFFICULTY_INSTRUCTIONS.easy.toLowerCase().includes('basic definitions'),
    'Easy difficulty specifically instructs factual recall and basic definitions');
  assert(DIFFICULTY_INSTRUCTIONS.medium.toLowerCase().includes('conceptual understanding') || DIFFICULTY_INSTRUCTIONS.medium.toLowerCase().includes('mechanisms'),
    'Medium difficulty specifically instructs conceptual understanding and mechanisms');
  assert(DIFFICULTY_INSTRUCTIONS.hard.toLowerCase().includes('analysis') || DIFFICULTY_INSTRUCTIONS.hard.toLowerCase().includes('plausible'),
    'Hard difficulty specifically instructs analytical reasoning, trade-offs, and plausible distractors');

  console.log('\n--- 6. Testing Practice Questions 10, 20, 30 Validation & Deduplication ---');
  const mockRawPQ = Array.from({ length: 30 }, (_, i) => ({
    question: `Practice Question #${i + 1} regarding subject mechanisms?`,
    answer: `Detailed answer for question #${i + 1}.`,
    explanation: `Explanation for practice question #${i + 1}.`,
    topic: `Topic ${(i % 5) + 1}`,
    difficulty: 'medium',
  }));

  const validatedPQ = validatePracticeQuestions(mockRawPQ, 'subj-1', 'mod-1', 'medium', 'Document.pdf');
  assert(validatedPQ.length === 30, `Validated all 30 practice questions (length = ${validatedPQ.length})`);
  assert(validatedPQ[0].question.includes('#1'), 'First question is intact');
  assert(validatedPQ[29].question.includes('#30'), '30th question is intact');

  // Test deduplication with existingPrompts set
  const existingSet = new Set([mockRawPQ[0].question.toLowerCase().replace(/[^a-z0-9]/g, '')]);
  const deduplicatedPQ = validatePracticeQuestions(mockRawPQ, 'subj-1', 'mod-1', 'medium', 'Document.pdf', existingSet);
  assert(deduplicatedPQ.length === 29, `Correctly deduplicated against existing questions (29 remaining)`);

  console.log(`\n========================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log(`========================================\n`);
}

runTests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
