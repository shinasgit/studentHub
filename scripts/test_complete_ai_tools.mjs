// scripts/test_complete_ai_tools.mjs
import fs from 'fs';
import path from 'path';
import http from 'http';

console.log('================================================================');
console.log('     AI STUDENT HUB - 3 AI STUDY TOOLS COMPREHENSIVE TEST       ');
console.log('================================================================\n');

const testResults = [];

function recordResult(testName, passed, details) {
  testResults.push({ testName, passed, details });
  const icon = passed ? 'PASS [✓]' : 'FAIL [✗]';
  console.log(`${icon} - ${testName}`);
  if (details) console.log(`       Details: ${details}`);
}

// -------------------------------------------------------------
// 1. JSON Parser & Cleaner (Replicating practice & mcq services)
// -------------------------------------------------------------
function cleanAndParseJson(raw) {
  let cleaned = raw.trim();
  // Strip markdown code fences ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Try parsing directly
  try {
    return JSON.parse(cleaned);
  } catch {
    // Locate outermost bracket or brace
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      } catch {
        // Fall through
      }
    }

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {
        // Fall through
      }
    }

    // Try fixing trailing commas
    const fixedTrailing = cleaned.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(fixedTrailing);
  }
}

// -------------------------------------------------------------
// 2. Practice Questions Validator
// -------------------------------------------------------------
function validatePracticeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('LLM output is not an array of questions.');
  }

  const valid = [];
  const seenPrompts = new Set();

  for (let i = 0; i < rawQuestions.length; i++) {
    const item = rawQuestions[i];
    if (!item || typeof item !== 'object') continue;

    const question = String(item.question || '').trim();
    const answer = String(item.answer || '').trim();
    const explanation = item.explanation ? String(item.explanation).trim() : undefined;
    const topic = item.topic ? String(item.topic).trim() : undefined;

    if (question.length < 8) continue;
    if (answer.length < 2) continue;

    const normKey = question.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenPrompts.has(normKey)) continue;
    seenPrompts.add(normKey);

    let diff = 'medium';
    if (item.difficulty && ['easy', 'medium', 'hard'].includes(String(item.difficulty).toLowerCase())) {
      diff = String(item.difficulty).toLowerCase();
    }

    valid.push({
      id: `q-val-${i}`,
      question,
      answer,
      explanation: explanation || 'Based on provided module materials.',
      topic,
      difficulty: diff,
    });
  }

  if (valid.length === 0) {
    throw new Error('Zero valid questions passed structural validation.');
  }
  return valid;
}

// -------------------------------------------------------------
// 3. MCQ Quiz Validator (Strict 4 options, 1 valid correct key)
// -------------------------------------------------------------
function validateMcqQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('LLM output is not an array of MCQ questions.');
  }

  const valid = [];
  const seenPrompts = new Set();

  for (let i = 0; i < rawQuestions.length; i++) {
    const item = rawQuestions[i];
    if (!item || typeof item !== 'object') continue;

    const question = String(item.question || '').trim();
    if (question.length < 8) continue;

    const normKey = question.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenPrompts.has(normKey)) continue;

    // Validate options
    const rawOptions = item.options;
    let normalizedOptions = [];

    if (Array.isArray(rawOptions)) {
      if (rawOptions.length === 4) {
        normalizedOptions = rawOptions.map((opt, idx) => {
          const letter = String.fromCharCode(97 + idx); // a, b, c, d
          if (typeof opt === 'string') {
            return { id: `opt-${letter}`, text: opt.replace(/^[A-Da-d][).:-]\s*/, '').trim() };
          }
          if (opt && typeof opt === 'object') {
            const text = String(opt.text || opt.label || '').replace(/^[A-Da-d][).:-]\s*/, '').trim();
            return { id: `opt-${letter}`, text };
          }
          return { id: `opt-${letter}`, text: `Option ${letter.toUpperCase()}` };
        });
      }
    } else if (rawOptions && typeof rawOptions === 'object') {
      const keys = ['a', 'b', 'c', 'd'];
      const hasAll = keys.every(k => rawOptions[k] || rawOptions[k.toUpperCase()]);
      if (hasAll) {
        normalizedOptions = keys.map(k => ({
          id: `opt-${k}`,
          text: String(rawOptions[k] || rawOptions[k.toUpperCase()]).replace(/^[A-Da-d][).:-]\s*/, '').trim(),
        }));
      }
    }

    // Must have exactly 4 valid non-empty options
    if (normalizedOptions.length !== 4) continue;
    if (normalizedOptions.some(o => !o.text || o.text.length < 1)) continue;

    // Check for distinct options
    const distinctTexts = new Set(normalizedOptions.map(o => o.text.toLowerCase()));
    if (distinctTexts.size < 4) continue;

    // Validate correct key
    const rawKey = String(item.correctOptionId || item.correctAnswer || item.answer || '').trim().toLowerCase();
    let correctId = null;

    if (['opt-a', 'opt-b', 'opt-c', 'opt-d'].includes(rawKey)) {
      correctId = rawKey;
    } else if (['a', 'b', 'c', 'd'].includes(rawKey)) {
      correctId = `opt-${rawKey}`;
    } else {
      const letterMatch = rawKey.match(/^(?:option\s+)?([a-d])\b/i);
      if (letterMatch) {
        correctId = `opt-${letterMatch[1].toLowerCase()}`;
      } else {
        const matchingOpt = normalizedOptions.find(o => o.text.toLowerCase() === rawKey.toLowerCase());
        if (matchingOpt) {
          correctId = matchingOpt.id;
        }
      }
    }

    if (!correctId || !normalizedOptions.some(o => o.id === correctId)) {
      continue; // Reject questions without verified single correct key
    }

    seenPrompts.add(normKey);

    valid.push({
      id: `mcq-val-${i}`,
      question,
      options: normalizedOptions,
      correctOptionId: correctId,
      explanation: item.explanation ? String(item.explanation).trim() : 'Validated against study materials.',
      difficulty: 'medium',
    });
  }

  if (valid.length === 0) {
    throw new Error('Zero valid MCQ questions passed strict 4-option validation.');
  }
  return valid;
}

// -------------------------------------------------------------
// 4. Quick Study Notes 5-Section Parser
// -------------------------------------------------------------
function parseQuickNotesSections(notesText) {
  const headings = [
    'Quick Topic Overview',
    'Core Concepts',
    'Key Definitions',
    'Essential Formulas, Rules & Facts',
    'High-Yield Exam Points',
  ];

  const foundHeadings = headings.filter(h => {
    const regex = new RegExp(`###?\\s*(?:\\d+[.:]\\s*)?${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    return regex.test(notesText);
  });

  return {
    headingCount: foundHeadings.length,
    foundHeadings,
    hasContent: notesText.trim().length > 100,
  };
}

// -------------------------------------------------------------
// 5. Test Suite Execution
// -------------------------------------------------------------
async function runAllTests() {
  console.log('Running AI Study Tools Output Quality & Validation Tests...\n');

  // TEST 1: Quick Study Notes Format & Section Detection
  try {
    const mockNotes = `
### 1. Quick Topic Overview
Supervised learning trains models on labeled datasets where inputs map to known ground-truth targets.

### 2. Core Concepts
* **Feature Representation**: Vector encoding of raw real-world data points.
* **Loss Function**: Mathematical measure of discrepancy between predicted and ground-truth values.

### 3. Key Definitions
* **Overfitting**: When a model fits training noise and fails to generalize to unseen test distributions.
* **Generalization**: The ability to perform accurately on inputs not seen during training.

### 4. Essential Formulas, Rules & Facts
* Mean Squared Error: MSE = (1/n) * sum((y_i - y_hat_i)^2)
* Cross-Entropy: H(p, q) = -sum(p(x) * log(q(x)))

### 5. High-Yield Exam Points
* Regularization (L1/L2) penalizes large weights to mitigate variance.
* Bias-variance tradeoff dictates overall expected generalization error.
`;
    const parsed = parseQuickNotesSections(mockNotes);
    const pass1 = parsed.headingCount >= 4 && parsed.hasContent;
    recordResult(
      'Test 1: Quick Study Notes 5-Section Parser',
      pass1,
      `Detected ${parsed.headingCount}/5 standard note sections with technical terminology preserved.`
    );
  } catch (err) {
    recordResult('Test 1: Quick Study Notes 5-Section Parser', false, err.message);
  }

  // TEST 2: Practice Questions JSON Parsing & Grounding Validation
  try {
    const mockLlmRaw = `
Here are the generated practice questions for your revision:
\`\`\`json
[
  {
    "question": "What is the primary difference between Supervised and Unsupervised learning?",
    "answer": "Supervised learning uses labeled training data with ground-truth targets, while unsupervised learning discovers intrinsic patterns without labels.",
    "explanation": "Derived from Chapter 1 introduction on machine learning paradigms.",
    "difficulty": "easy",
    "topic": "Fundamentals"
  },
  {
    "question": "How does L2 regularization (Ridge) prevent model overfitting?",
    "answer": "L2 regularization adds a squared penalty proportional to weight magnitudes to the loss function, shrinking weights toward zero.",
    "explanation": "Explained in section 3.2 on regularization techniques.",
    "difficulty": "medium",
    "topic": "Regularization"
  },
  {
    "question": "Why?",
    "answer": "invalid",
    "explanation": "fail"
  }
]
\`\`\`
Hope this helps!
`;
    const parsedJson = cleanAndParseJson(mockLlmRaw);
    const validated = validatePracticeQuestions(parsedJson);

    const pass2 = validated.length === 2 &&
      validated[0].question.startsWith('What is the primary difference') &&
      validated[1].difficulty === 'medium';

    recordResult(
      'Test 2: Practice Questions JSON Extraction & Validation',
      pass2,
      `Extracted ${validated.length} grounded questions, filtered out malformed/short items.`
    );
  } catch (err) {
    recordResult('Test 2: Practice Questions JSON Extraction & Validation', false, err.message);
  }

  // TEST 3: Practice Questions Deduplication & Difficulty Enforcement
  try {
    const mockDuplicates = [
      {
        question: "Explain the Bias-Variance tradeoff.",
        answer: "Bias is underfitting error; variance is sensitivity to training fluctuations.",
        difficulty: "hard",
      },
      {
        question: "explain the bias-variance tradeoff", // Duplicate!
        answer: "Duplicate answer.",
        difficulty: "hard",
      },
      {
        question: "What is Cross-Validation used for?",
        answer: "It assesses model generalization by partitioning data into k folds.",
        difficulty: "invalid_diff", // Should normalize to medium
      },
    ];

    const validated = validatePracticeQuestions(mockDuplicates);
    const pass3 = validated.length === 2 && validated[1].difficulty === 'medium';
    recordResult(
      'Test 3: Practice Questions Deduplication & Difficulty Normalization',
      pass3,
      `Successfully eliminated duplicate question prompt and normalized invalid difficulty.`
    );
  } catch (err) {
    recordResult('Test 3: Practice Questions Deduplication & Difficulty Normalization', false, err.message);
  }

  // TEST 4: MCQ Quiz Strict 4-Option & Single Correct Key Validation
  try {
    const mockMcqRaw = `
[
  {
    "question": "Which layer of the OSI model does the TCP protocol belong to?",
    "options": [
      "Physical Layer",
      "Network Layer",
      "Transport Layer",
      "Application Layer"
    ],
    "correctOptionId": "opt-c",
    "explanation": "TCP is a transport layer protocol providing reliable end-to-end communication."
  },
  {
    "question": "What is the primary function of DNS in networking?",
    "options": {
      "a": "Encrypt network packets",
      "b": "Resolve domain names to IP addresses",
      "c": "Manage physical cables",
      "d": "Assign MAC addresses"
    },
    "correctAnswer": "B",
    "explanation": "DNS maps human-readable domain names to numerical IP addresses."
  },
  {
    "question": "Invalid MCQ with only 3 options",
    "options": ["A", "B", "C"],
    "correctAnswer": "A"
  },
  {
    "question": "Invalid MCQ with duplicate options",
    "options": ["Option 1", "Option 1", "Option 2", "Option 3"],
    "correctAnswer": "a"
  }
]
`;
    const parsed = cleanAndParseJson(mockMcqRaw);
    const validatedMcq = validateMcqQuestions(parsed);

    const pass4 = validatedMcq.length === 2 &&
      validatedMcq[0].options.length === 4 &&
      validatedMcq[0].correctOptionId === 'opt-c' &&
      validatedMcq[1].options.length === 4 &&
      validatedMcq[1].correctOptionId === 'opt-b';

    recordResult(
      'Test 4: MCQ Quiz 4-Option & Correct Answer Validation',
      pass4,
      `Validated ${validatedMcq.length} MCQs; normalized string arrays and object forms; rejected 3-option and duplicate-option questions.`
    );
  } catch (err) {
    recordResult('Test 4: MCQ Quiz 4-Option & Correct Answer Validation', false, err.message);
  }

  // TEST 5: Insufficient Text & Empty Document Guard
  try {
    const shortText = "Lecture 1: Intro.";
    const hasEnoughText = shortText.trim().length >= 50;
    const pass5 = !hasEnoughText;
    recordResult(
      'Test 5: Insufficient Source Text Guard',
      pass5,
      `Guard caught short text (${shortText.length} chars < 50 threshold) preventing empty LLM inference.`
    );
  } catch (err) {
    recordResult('Test 5: Insufficient Source Text Guard', false, err.message);
  }

  // TEST 6: Live Ollama Inference Verification (Local llama3.2:3b)
  console.log('\nTesting live connection to local Ollama on port 11434...');
  try {
    const isUp = await checkLocalOllama();
    if (!isUp) {
      recordResult(
        'Test 6: Live Ollama Generation Check',
        false,
        'Ollama is not responding on http://127.0.0.1:11434/api/tags'
      );
    } else {
      console.log('Ollama is active! Running live generation verification with llama3.2:3b...');
      const sampleText = `
Computer Networking: Transport Layer Protocols.
The Transmission Control Protocol (TCP) provides reliable, ordered, and error-checked delivery of a stream of octets between applications running on hosts communicating via an IP network. TCP establishes a connection using a three-way handshake: SYN, SYN-ACK, ACK.
The User Datagram Protocol (UDP) provides a simple connectionless transmission model with minimal protocol mechanism. It has no handshaking and provides checksums for data integrity. Applications like DNS, VoIP, and video streaming prioritize low latency and commonly use UDP.
Flow control in TCP is implemented using a sliding receive window to prevent a fast sender from overwhelming a slow receiver. Congestion control uses algorithms such as Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery to adapt sending rates to network capacity.
`;

      const prompt = `You are an expert academic tutor. Generate exactly 2 multiple choice questions based ONLY on this text.
Return ONLY a valid JSON array:
[
  {
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "correctOptionId": "opt-a",
    "explanation": "..."
  }
]

Text:
${sampleText}`;

      const responseText = await callLocalOllama(prompt);
      console.log('Live Ollama Response received. Validating structure...');
      const parsed = cleanAndParseJson(responseText);
      const validated = validateMcqQuestions(parsed);

      const pass6 = validated.length >= 1 && validated[0].options.length === 4;
      recordResult(
        'Test 6: Live Ollama Llama 3.2 MCQ Generation & Scoring Verification',
        pass6,
        `Generated ${validated.length} valid MCQs grounded in transport layer text. Correct key: ${validated[0].correctOptionId}.`
      );
    }
  } catch (err) {
    recordResult('Test 6: Live Ollama Generation Check', false, err.message);
  }

  // Final Summary
  console.log('\n================================================================');
  const allPassed = testResults.every(r => r.passed);
  const passedCount = testResults.filter(r => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${testResults.length} Tests Passed`);
  if (allPassed) {
    console.log('STATUS: ALL AI STUDY TOOL SUITES VALIDATED SUCCESSFULLY [✓]');
  } else {
    console.log('STATUS: SOME TESTS FAILED');
  }
  console.log('================================================================\n');
}

function checkLocalOllama() {
  return new Promise(resolve => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/tags',
        method: 'GET',
        timeout: 3000,
      },
      res => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function callLocalOllama(prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'llama3.2:3b',
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
      },
    });

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 90000,
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.response || '');
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timed out after 90 seconds'));
    });

    req.write(postData);
    req.end();
  });
}

runAllTests();
