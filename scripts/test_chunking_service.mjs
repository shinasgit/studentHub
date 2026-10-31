// Test Suite for RAG Stage 2: Text Chunking System
// Run with: npx vite-node scripts/test_chunking_service.mjs

import {
  estimateTokenCount,
  normalizeExtractedText,
  splitIntoSentences,
  chunkDocument,
  chunkMultipleDocuments,
  validateChunks,
  DEFAULT_CHUNK_SIZE_TOKENS,
  DEFAULT_CHUNK_OVERLAP_TOKENS,
} from '../src/services/chunkingService.ts';

console.log('\n=============================================================');
console.log('🧪 RAG STAGE 2: TEXT CHUNKING SYSTEM AUTOMATED TEST SUITE');
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

// =================================================================
// 1. TOKEN ESTIMATION TEST
// =================================================================
console.log('--- 1. Testing Token Counting Strategy ---');
const sampleShort = 'What is a computer network?';
const sampleTokens = estimateTokenCount(sampleShort);
assert(sampleTokens >= 5 && sampleTokens <= 8, `Short sentence estimated token count is reasonable: ${sampleTokens} tokens`);

const technicalText = 'The counterpropagation artificial neural network utilizes backpropagation with multidimensional gradient descent.';
const techTokens = estimateTokenCount(technicalText);
assert(techTokens >= 20 && techTokens <= 35, `Technical compound words properly account for subword fragmentation: ${techTokens} tokens`);

// =================================================================
// 2. SHORT TEXT TEST
// =================================================================
console.log('\n--- 2. Testing Short Text Chunking ---');
const shortDoc = {
  text: 'A computer network is a system of interconnected computing devices that can exchange data and share resources with each other.',
  subjectId: 'cs-101',
  moduleId: 'mod-1',
  resourceId: 'res-intro',
  resourceName: 'Intro.pdf',
  pageNumber: 1,
};

const shortResult = chunkDocument(shortDoc, { chunkSizeTokens: 500, chunkOverlapTokens: 75 });
assert(shortResult.totalChunks === 1, `Short text produces exactly 1 chunk (got ${shortResult.totalChunks})`);
assert(shortResult.chunks[0].chunkIndex === 0, 'Chunk index is 0');
assert(shortResult.chunks[0].totalChunks === 1, 'Chunk totalChunks is 1');
assert(shortResult.chunks[0].text === shortDoc.text, 'Short text is fully preserved verbatim');
assert(shortResult.chunks[0].subjectId === 'cs-101', 'subjectId preserved in metadata');
assert(shortResult.chunks[0].resourceName === 'Intro.pdf', 'resourceName preserved in metadata');

const valShort = validateChunks(shortResult.chunks);
assert(valShort.isValid, `Short text chunks pass validation: ${valShort.errors.join(', ')}`);

// =================================================================
// 3. LONG TEXT TEST
// =================================================================
console.log('\n--- 3. Testing Long Text Chunking ---');
// Generate a multi-paragraph long document (~1500 tokens)
const paragraphs = [];
for (let p = 1; p <= 12; p++) {
  paragraphs.push(
    `Paragraph ${p}: Computer networks rely on protocols to establish standard communication rules. ` +
    `Layer ${p % 7 + 1} provides abstraction for specific operational tasks such as routing, packet switching, error correction, and flow control. ` +
    `Modern architectures implement transmission control protocol over internet protocol to guarantee reliable byte streams across unreliable networks. ` +
    `Bandwidth, latency, jitter, and throughput serve as fundamental metrics for analyzing overall operational health and quality of service.`
  );
}
const longText = paragraphs.join('\n\n');
const longDoc = {
  text: longText,
  resourceId: 'res-long-doc',
  resourceName: 'LongNetworkingGuide.pdf',
};

const longResult = chunkDocument(longDoc, { chunkSizeTokens: 250, chunkOverlapTokens: 50 });
assert(longResult.totalChunks >= 3, `Long text produces multiple chunks: ${longResult.totalChunks} chunks`);
assert(longResult.averageChunkTokens <= 300, `Average chunk tokens (${longResult.averageChunkTokens}) is within target range`);

// Verify all chunks have non-empty text and sequential indexes
let orderValid = true;
for (let i = 0; i < longResult.chunks.length; i++) {
  if (longResult.chunks[i].chunkIndex !== i || longResult.chunks[i].totalChunks !== longResult.totalChunks) {
    orderValid = false;
  }
}
assert(orderValid, 'All chunk indices are strictly sequential (0 to N-1)');

const valLong = validateChunks(longResult.chunks);
assert(valLong.isValid, `Long text chunks pass validation: ${valLong.errors.join(', ')}`);

// =================================================================
// 4. MULTIPLE PARAGRAPHS & BOUNDARY PRESERVATION
// =================================================================
console.log('\n--- 4. Testing Paragraph & Heading Boundaries ---');
const sectionText = `
# Chapter 1: Network Fundamentals

A network consists of connected devices communicating via standard transmission mediums.

## 1.1 Topologies

Network topology describes the physical or logical arrangement of connected nodes. Common topologies include star, bus, ring, and mesh designs.

## 1.2 The OSI Reference Model

The OSI model defines a seven-layer conceptual framework. Each layer performs distinct network functions.
`.trim();

const sectionResult = chunkDocument({ text: sectionText, resourceId: 'res-ch1' }, { chunkSizeTokens: 100, chunkOverlapTokens: 20 });
assert(sectionResult.totalChunks >= 1, `Structured section produced ${sectionResult.totalChunks} chunk(s)`);
assert(sectionResult.chunks[0].text.includes('# Chapter 1: Network Fundamentals'), 'Main heading is preserved at start of chunk');
assert(sectionResult.chunks.every(c => !c.text.endsWith('# Chapter 1: Network Fundamentals')), 'Headings do not get stranded at the bottom of a chunk');

// =================================================================
// 5. MULTIPLE PAGES & EMPTY PAGES PRESERVATION
// =================================================================
console.log('\n--- 5. Testing Multiple Pages & Empty Pages Support ---');
const mockPages = [
  {
    pageNumber: 1,
    text: 'Page 1 Title: Principles of Operating Systems.\n\nAn operating system acts as an intermediary between the computer user and computer hardware.',
    charCount: 135,
    extractionMethod: 'text',
  },
  {
    pageNumber: 2,
    text: '', // Empty page (e.g. blank page in textbook)
    charCount: 0,
    extractionMethod: 'empty',
  },
  {
    pageNumber: 3,
    text: '   \n\n\t  ', // Whitespace-only page
    charCount: 7,
    extractionMethod: 'empty',
  },
  {
    pageNumber: 4,
    text: 'Page 4: Memory Management.\n\nVirtual memory separates user logical memory from physical memory. Paging and segmentation are key techniques.',
    charCount: 130,
    extractionMethod: 'text',
  },
];

const pageResult = chunkDocument({
  pages: mockPages,
  subjectId: 'cs-os-201',
  resourceId: 'res-os-pdf',
  resourceName: 'OperatingSystems.pdf',
}, { chunkSizeTokens: 300, chunkOverlapTokens: 50 });

assert(pageResult.totalChunks === 2, `Skipped empty/whitespace pages and produced exactly 2 chunks for pages 1 and 4 (got ${pageResult.totalChunks})`);
assert(pageResult.chunks[0].pageNumber === 1, `Chunk 0 pageNumber is 1 (got ${pageResult.chunks[0].pageNumber})`);
assert(pageResult.chunks[1].pageNumber === 4, `Chunk 1 pageNumber is 4 (got ${pageResult.chunks[1].pageNumber})`);
assert(!pageResult.chunks.some(c => !c.text.trim()), 'No empty chunks were produced from blank pages');

// =================================================================
// 6. OCR-EXTRACTED TEXT TEST
// =================================================================
console.log('\n--- 6. Testing Scanned PDF OCR Text Normalization ---');
const rawOcrText = `
This is a scanned docu-\nment with hyphen-\nated words across line\nbreaks.

The algo-\nrithm processes multi-\nple inputs with dis-\ntributed nodes.
`;

const ocrDoc = {
  text: rawOcrText,
  resourceId: 'res-scanned-ocr',
  resourceName: 'ScannedExam2023.pdf',
  extractionMethod: 'ocr',
  isScanned: true,
  pageNumber: 1,
};

const ocrResult = chunkDocument(ocrDoc);
assert(ocrResult.totalChunks === 1, 'OCR text successfully chunked');
assert(ocrResult.chunks[0].text.includes('document'), 'Hyphenated "docu-ment" repaired to "document"');
assert(ocrResult.chunks[0].text.includes('hyphenated'), 'Hyphenated "hyphen-ated" repaired to "hyphenated"');
assert(ocrResult.chunks[0].text.includes('algorithm'), 'Hyphenated "algo-rithm" repaired to "algorithm"');
assert(ocrResult.chunks[0].text.includes('distributed'), 'Hyphenated "dis-tributed" repaired to "distributed"');
assert(ocrResult.chunks[0].metadata.extractionMethod === 'ocr', 'metadata.extractionMethod preserved as "ocr"');
assert(ocrResult.chunks[0].metadata.isScanned === true, 'metadata.isScanned preserved as true');

// =================================================================
// 7. EMPTY AND WHITESPACE-ONLY INPUT TEST
// =================================================================
console.log('\n--- 7. Testing Empty and Whitespace Text Handling ---');
const emptyResult1 = chunkDocument({ text: '' });
assert(emptyResult1.totalChunks === 0 && emptyResult1.chunks.length === 0, 'Empty string produces 0 chunks');

const emptyResult2 = chunkDocument({ text: '    \n\n\t   \r\n   ' });
assert(emptyResult2.totalChunks === 0 && emptyResult2.chunks.length === 0, 'Whitespace string produces 0 chunks');

const emptyResult3 = chunkDocument({ pages: [] });
assert(emptyResult3.totalChunks === 0 && emptyResult3.chunks.length === 0, 'Empty pages array produces 0 chunks');

// =================================================================
// 8. CHUNK OVERLAP TEST
// =================================================================
console.log('\n--- 8. Testing Chunk Overlap Verification ---');
const overlapSentences = [
  'Alpha protocol initiates the synchronization handshake between client and server.',
  'Beta layer encrypts the transmitted payload using authenticated cipher suites.',
  'Gamma algorithm calculates cyclic redundancy checksums to detect packet corruption.',
  'Delta controller routes packets dynamically through optimal network paths.',
  'Epsilon monitor records network telemetry to observe packet loss and latency.',
  'Zeta firewall filters unauthorized packets according to predefined security policies.',
];

const overlapText = overlapSentences.join('\n\n');
// Use small chunk size (40 tokens) with overlap (15 tokens) to force splits with clear overlap
const overlapResult = chunkDocument({ text: overlapText, resourceId: 'res-overlap' }, {
  chunkSizeTokens: 45,
  chunkOverlapTokens: 18,
  minChunkSizeTokens: 10,
});

assert(overlapResult.totalChunks >= 2, `Produced multiple chunks for overlap test (${overlapResult.totalChunks} chunks)`);

// Check that Chunk 1 starts with content that appeared in Chunk 0
const chunk0Text = overlapResult.chunks[0].text;
const chunk1Text = overlapResult.chunks[1].text;

// Find sentences from chunk0 that appear at the beginning of chunk1
let hasOverlap = false;
for (const s of overlapSentences) {
  if (chunk0Text.includes(s) && chunk1Text.includes(s)) {
    hasOverlap = true;
    break;
  }
}
assert(hasOverlap, 'Chunk 1 contains overlapping context from Chunk 0');

// =================================================================
// 9. METADATA PRESERVATION TEST
// =================================================================
console.log('\n--- 9. Testing Complete Metadata Preservation ---');
const fullMetaDoc = {
  text: 'Database Management Systems organize data into tables, schemas, queries, views, and reports. ACID properties ensure transaction reliability.',
  subjectId: 'cs-dbms-301',
  moduleId: 'mod-transactions',
  resourceId: 'res-acid-spec',
  resourceName: 'TransactionProperties.pdf',
  pageNumber: 7,
  extractionMethod: 'text',
  isScanned: false,
};

const metaResult = chunkDocument(fullMetaDoc);
assert(metaResult.chunks.length === 1, 'Chunk generated with metadata');
const c = metaResult.chunks[0];

assert(c.chunkId === 'res-acid-spec_chunk_0', `chunkId formatted correctly: ${c.chunkId}`);
assert(c.chunkIndex === 0, `chunkIndex is 0`);
assert(c.totalChunks === 1, `totalChunks is 1`);
assert(c.subjectId === 'cs-dbms-301', `subjectId is "cs-dbms-301"`);
assert(c.moduleId === 'mod-transactions', `moduleId is "mod-transactions"`);
assert(c.resourceId === 'res-acid-spec', `resourceId is "res-acid-spec"`);
assert(c.resourceName === 'TransactionProperties.pdf', `resourceName is "TransactionProperties.pdf"`);
assert(c.pageNumber === 7, `pageNumber is 7`);
assert(c.metadata.characterCount === c.text.length, `characterCount matches text length: ${c.characterCount}`);
assert(c.metadata.tokenCount === c.tokenCount, `tokenCount in metadata matches chunk tokenCount: ${c.tokenCount}`);

// =================================================================
// 10. MULTIPLE PDF FILES CHUNKING TEST
// =================================================================
console.log('\n--- 10. Testing Multiple PDF Files Chunking ---');
const multiDocResult = chunkMultipleDocuments([
  {
    text: 'File 1 Content: Data structures store and organize data for efficient algorithmic access.',
    resourceId: 'doc1',
    resourceName: 'DataStructures.pdf',
    subjectId: 'cs-200',
  },
  {
    text: 'File 2 Content: Algorithms define unambiguous finite sequences of computer-implementable instructions.',
    resourceId: 'doc2',
    resourceName: 'Algorithms.pdf',
    subjectId: 'cs-200',
  },
]);

assert(multiDocResult.documents.length === 2, 'Processed 2 document inputs');
assert(multiDocResult.totalChunks === 2, 'Produced 2 total chunks across both files');
assert(multiDocResult.allChunks[0].resourceName === 'DataStructures.pdf', 'First chunk belongs to DataStructures.pdf');
assert(multiDocResult.allChunks[1].resourceName === 'Algorithms.pdf', 'Second chunk belongs to Algorithms.pdf');

// =================================================================
// 11. EMBEDDED PAGE MARKER PARSING TEST
// =================================================================
console.log('\n--- 11. Testing Embedded "--- Page X ---" Markers ---');
const rawWithPageMarkers = `
--- Page 1 ---
Introduction to Compiler Design.
Lexical analysis converts source characters into tokens.

--- Page 2 ---
Syntax analysis parses tokens into abstract syntax trees.
Grammars define the formal language rules.
`.trim();

const pageMarkerResult = chunkDocument({
  text: rawWithPageMarkers,
  resourceId: 'res-compilers',
  resourceName: 'CompilerNotes.pdf',
});

assert(pageMarkerResult.totalChunks >= 2, `Parsed 2 pages from markers into chunks: ${pageMarkerResult.totalChunks}`);
assert(pageMarkerResult.chunks[0].pageNumber === 1, `First chunk extracted pageNumber 1 (got ${pageMarkerResult.chunks[0].pageNumber})`);
assert(pageMarkerResult.chunks[pageMarkerResult.chunks.length - 1].pageNumber === 2, `Second chunk extracted pageNumber 2 (got ${pageMarkerResult.chunks[pageMarkerResult.chunks.length - 1].pageNumber})`);

console.log('\n=============================================================');
console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉 STAGE 2 VERIFICATION COMPLETE: ALL CHUNKING TESTS PASSED!');
}
console.log('=============================================================\n');

if (failed > 0) {
  process.exit(1);
}
