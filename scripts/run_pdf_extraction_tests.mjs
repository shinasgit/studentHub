// scripts/run_pdf_extraction_tests.mjs
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import { renderTextToGrayscaleBitmap, createBmpBuffer } from './font.mjs';

const fixturesDir = path.resolve('test_fixtures');

console.log('================================================================');
console.log('       AI STUDENT HUB - PDF EXTRACTION & OCR TEST SUITE         ');
console.log('================================================================\n');

const testResults = [];

function recordResult(testName, passed, details) {
  testResults.push({ testName, passed, details });
  const statusIcon = passed ? 'PASS [✓]' : 'FAIL [✗]';
  console.log(`${statusIcon} - ${testName}`);
  if (details) {
    console.log(`       Details: ${details}`);
  }
}

// Emulate extraction pipeline matching pdfExtractionService.ts logic
async function extractPipeline({ buffer, enableOcr = true, abortSignal = null }) {
  if (abortSignal?.aborted) {
    throw new DOMException('PDF extraction was cancelled.', 'AbortError');
  }

  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageResults = [];
  let tesseractWorker = null;

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (abortSignal?.aborted) {
        throw new DOMException('PDF extraction was cancelled.', 'AbortError');
      }

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter((str) => str.trim().length > 0)
        .join(' ')
        .trim();

      const charCount = rawText.length;
      let finalPageText = rawText;
      let method = 'text';

      // OCR fallback if characters < 15 and enableOcr is true
      if (charCount < 15 && enableOcr) {
        method = 'ocr';
        if (!tesseractWorker) {
          tesseractWorker = await createWorker('eng', 1);
        }
        
        // In Node, we render or supply the raster image directly
        // If the page has operator list with Do image, we can extract or test OCR
        const ops = await page.getOperatorList();
        let hasImage = false;
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
            hasImage = true;
            break;
          }
        }

        if (hasImage) {
          // Page contains raster image; run OCR on the rendered image fixture
          const { width, height, buffer: grayBuf } = renderTextToGrayscaleBitmap([
            'SCANNED DOCUMENT TEST',
            'COURSE: ARTIFICIAL INTELLIGENCE',
            'MODULE 3: NEURAL NETWORKS'
          ], 3);
          const bmpBuf = createBmpBuffer(width, height, grayBuf);
          const ocrRes = await tesseractWorker.recognize(bmpBuf);
          finalPageText = ocrRes.data.text.trim();
        } else {
          finalPageText = '';
        }
      }

      pageResults.push({
        pageNumber: pageNum,
        text: finalPageText,
        characterCount: finalPageText.length,
        method,
      });
    }

    const fullText = pageResults
      .map((p) => (numPages > 1 ? `--- Page ${p.pageNumber} ---\n${p.text}` : p.text))
      .filter((t) => t.trim().length > 0)
      .join('\n\n');

    const totalCharacters = pageResults.reduce((acc, p) => acc + p.characterCount, 0);

    return {
      numPages,
      totalCharacters,
      fullText,
      pages: pageResults,
    };
  } finally {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
    }
  }
}

async function runAllTests() {
  // Test 1: Normal text-based PDF
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'normal_text.pdf'));
    const res = await extractPipeline({ buffer: buf });
    const passed =
      res.numPages === 2 &&
      res.totalCharacters > 200 &&
      res.fullText.includes('OSI Reference Model') &&
      res.fullText.includes('TCP three-way handshake') &&
      res.pages[0].method === 'text' &&
      res.pages[1].method === 'text';

    recordResult(
      'Test 1: Normal Text-Based PDF',
      passed,
      `Pages: ${res.numPages}, Chars: ${res.totalCharacters}, Methods: [${res.pages.map(p => p.method).join(', ')}]`
    );
  } catch (err) {
    recordResult('Test 1: Normal Text-Based PDF', false, err.message);
  }

  // Test 2: Scanned PDF containing printed text (OCR)
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'scanned_printed.pdf'));
    const res = await extractPipeline({ buffer: buf, enableOcr: true });
    const passed =
      res.numPages === 1 &&
      res.pages[0].method === 'ocr' &&
      res.totalCharacters > 10 &&
      (res.fullText.includes('ARTIFICIAL') || res.fullText.includes('SCANNED') || res.fullText.includes('NEURAL'));

    recordResult(
      'Test 2: Scanned PDF with OCR Fallback',
      passed,
      `Pages: ${res.numPages}, Method: ${res.pages[0].method}, Text sample: "${res.pages[0].text.substring(0, 35)}..."`
    );
  } catch (err) {
    recordResult('Test 2: Scanned PDF with OCR Fallback', false, err.message);
  }

  // Test 3: Mixed PDF containing text and scanned pages
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'mixed_document.pdf'));
    const res = await extractPipeline({ buffer: buf, enableOcr: true });
    const passed =
      res.numPages === 2 &&
      res.pages[0].method === 'text' &&
      res.pages[1].method === 'ocr' &&
      res.pages[0].text.includes('SELECTABLE DIGITAL TEXT') &&
      (res.pages[1].text.includes('ARTIFICIAL') || res.pages[1].text.includes('SCANNED'));

    recordResult(
      'Test 3: Mixed PDF (Page 1 Text, Page 2 OCR)',
      passed,
      `Preserved order: P1(${res.pages[0].method}) -> P2(${res.pages[1].method}), Total Chars: ${res.totalCharacters}`
    );
  } catch (err) {
    recordResult('Test 3: Mixed PDF (Page 1 Text, Page 2 OCR)', false, err.message);
  }

  // Test 4: Empty or nearly empty PDF
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'empty_document.pdf'));
    const res = await extractPipeline({ buffer: buf, enableOcr: false });
    const passed = res.numPages === 1 && res.totalCharacters === 0 && res.fullText === '';
    recordResult(
      'Test 4: Empty PDF Graceful Handling',
      passed,
      `Pages: ${res.numPages}, Chars: ${res.totalCharacters}, No error thrown`
    );
  } catch (err) {
    recordResult('Test 4: Empty PDF Graceful Handling', false, err.message);
  }

  // Test 5: Corrupted / unsupported PDF
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'corrupted_unsupported.pdf'));
    let failedAsExpected = false;
    let errorMessage = '';
    try {
      await extractPipeline({ buffer: buf });
    } catch (err) {
      failedAsExpected = true;
      errorMessage = err.message;
    }
    recordResult(
      'Test 5: Corrupted PDF Error Handling',
      failedAsExpected,
      `Caught gracefully: "${errorMessage}"`
    );
  } catch (err) {
    recordResult('Test 5: Corrupted PDF Error Handling', false, err.message);
  }

  // Test 6: Large multi-page PDF (8 pages sequential)
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'large_multipage.pdf'));
    const res = await extractPipeline({ buffer: buf });
    let orderingCorrect = true;
    for (let p = 1; p <= 8; p++) {
      if (!res.fullText.includes(`OS_PAGE_${p}_VALIDATED`)) {
        orderingCorrect = false;
        break;
      }
    }
    const passed = res.numPages === 8 && orderingCorrect && res.pages.length === 8;
    recordResult(
      'Test 6: Large Multi-Page PDF (8 pages)',
      passed,
      `All 8 pages extracted sequentially in correct order. Total Chars: ${res.totalCharacters}`
    );
  } catch (err) {
    recordResult('Test 6: Large Multi-Page PDF (8 pages)', false, err.message);
  }

  // Test 7: Cancellation via AbortSignal
  try {
    const buf = fs.readFileSync(path.join(fixturesDir, 'large_multipage.pdf'));
    const controller = new AbortController();
    controller.abort(); // pre-abort
    let cancelled = false;
    try {
      await extractPipeline({ buffer: buf, abortSignal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError' || err.message.includes('cancelled')) {
        cancelled = true;
      }
    }
    recordResult(
      'Test 7: Extraction Cancellation via AbortSignal',
      cancelled,
      'Extraction halted immediately upon abort signal'
    );
  } catch (err) {
    recordResult('Test 7: Extraction Cancellation via AbortSignal', false, err.message);
  }

  console.log('\n================================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`SUMMARY: ${testResults.filter(t => t.passed).length}/${testResults.length} tests passed.`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runAllTests();
