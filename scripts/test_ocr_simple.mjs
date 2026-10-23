// scripts/test_ocr_simple.mjs
import { createWorker } from 'tesseract.js';
import { renderTextToGrayscaleBitmap, createBmpBuffer } from './font.mjs';

async function testOcr() {
  console.log('Testing Tesseract.js initialization and recognition...');
  
  // Render clean text
  const textLines = ['COMPUTER SCIENCE', 'DATABASE SYSTEM'];
  const { width, height, buffer } = renderTextToGrayscaleBitmap(textLines, 4);
  const bmp = createBmpBuffer(width, height, buffer);
  
  console.log(`Generated test BMP image: ${width}x${height}, ${bmp.length} bytes`);
  
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        process.stdout.write(`\rOCR Progress: ${(m.progress * 100).toFixed(0)}% `);
      }
    }
  });

  try {
    const res = await worker.recognize(bmp);
    console.log('\nOCR Complete!');
    console.log('Extracted OCR text:');
    console.log('---------------------------------');
    console.log(res.data.text.trim());
    console.log('---------------------------------');
    
    const containsCS = res.data.text.toUpperCase().includes('COMPUTER') || res.data.text.toUpperCase().includes('SCIENCE');
    console.log('OCR Validation passed:', containsCS ? 'YES' : 'NO');
  } finally {
    await worker.terminate();
  }
}

testOcr().catch(err => {
  console.error('OCR test error:', err);
  process.exit(1);
});
