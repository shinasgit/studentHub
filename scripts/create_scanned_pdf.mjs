// scripts/create_scanned_pdf.mjs
import fs from 'fs';
import path from 'path';

// Simple 5x7 font for ASCII characters 32..126
const FONT_5X7 = {
  ' ': [0, 0, 0, 0, 0],
  'A': [0x7E, 0x11, 0x11, 0x11, 0x7E],
  'B': [0x7F, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7F, 0x41, 0x41, 0x22, 0x1C],
  'E': [0x7F, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
  'G': [0x3E, 0x41, 0x49, 0x49, 0x7A],
  'H': [0x7F, 0x08, 0x08, 0x08, 0x7F],
  'I': [0x00, 0x41, 0x7F, 0x41, 0x00],
  'J': [0x20, 0x40, 0x41, 0x3F, 0x01],
  'K': [0x7F, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7F, 0x02, 0x0C, 0x02, 0x7F],
  'N': [0x7F, 0x04, 0x08, 0x10, 0x7F],
  'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
  'P': [0x7F, 0x09, 0x09, 0x09, 0x06],
  'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E],
  'R': [0x7F, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7F, 0x01, 0x01],
  'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
  'V': [0x1F, 0x20, 0x40, 0x20, 0x1F],
  'W': [0x7F, 0x20, 0x18, 0x20, 0x7F],
  'X': [0x63, 0x14, 0x08, 0x14, 0x63],
  'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
  'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
  '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
  '1': [0x00, 0x42, 0x7F, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
};

function renderTextToGrayscaleBitmap(lines, scale = 4) {
  const charW = 6 * scale; // 5 + 1 spacing
  const charH = 10 * scale; // 7 + 3 spacing
  let maxLen = 0;
  for (const l of lines) {
    if (l.length > maxLen) maxLen = l.length;
  }
  
  const width = Math.max(300, (maxLen + 4) * charW);
  const height = Math.max(200, (lines.length + 3) * charH);
  
  // Allocate white image (255)
  const buffer = Buffer.alloc(width * height, 255);
  
  let startY = 20 * scale;
  for (const line of lines) {
    let startX = 20 * scale;
    const upper = line.toUpperCase();
    for (let c = 0; c < upper.length; c++) {
      const char = upper[c];
      const glyph = FONT_5X7[char] || FONT_5X7[' '];
      for (let col = 0; col < 5; col++) {
        const colBits = glyph[col];
        for (let row = 0; row < 7; row++) {
          if ((colBits & (1 << row)) !== 0) {
            // Draw scale x scale pixel block (black: 0)
            for (let dy = 0; dy < scale; dy++) {
              for (let dx = 0; dx < scale; dx++) {
                const px = startX + col * scale + dx;
                const py = startY + row * scale + dy;
                if (px < width && py < height) {
                  buffer[py * width + px] = 0;
                }
              }
            }
          }
        }
      }
      startX += charW;
    }
    startY += charH;
  }
  
  return { width, height, buffer };
}

function createScannedPdfWithImage(imageInfo) {
  const { width, height, buffer } = imageInfo;
  const objects = [];
  
  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // Object 2: Pages root
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  
  // Page 3 references content 4 and image 5
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj'
  );
  
  // Content stream: place image scaled across page
  const imgStream = 'q\n500 0 0 400 56 300 cm\n/Im1 Do\nQ\n';
  const imgStreamLen = Buffer.byteLength(imgStream, 'utf-8');
  objects.push(`4 0 obj\n<< /Length ${imgStreamLen} >>\nstream\n${imgStream}endstream\nendobj`);
  
  // Object 5: Image XObject
  const imgHeader = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${buffer.length} >>\nstream\n`;
  const imgFooter = '\nendstream\nendobj';
  
  let header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const chunks = [Buffer.from(header, 'latin1')];
  const offsets = [0];
  let curOffset = chunks[0].length;
  
  for (let i = 0; i < objects.length; i++) {
    offsets.push(curOffset);
    const chunk = Buffer.from(objects[i] + '\n', 'latin1');
    chunks.push(chunk);
    curOffset += chunk.length;
  }
  
  // Object 5 with binary buffer
  offsets.push(curOffset);
  const obj5HeaderBuf = Buffer.from(imgHeader, 'latin1');
  const obj5FooterBuf = Buffer.from(imgFooter + '\n', 'latin1');
  chunks.push(obj5HeaderBuf);
  chunks.push(buffer);
  chunks.push(obj5FooterBuf);
  curOffset += obj5HeaderBuf.length + buffer.length + obj5FooterBuf.length;
  
  const startXref = curOffset;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, 'latin1'));
  
  return Buffer.concat(chunks);
}

function createMixedPdf(textPageLines, imageInfo) {
  const { width, height, buffer } = imageInfo;
  const objects = [];
  
  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // 2: Pages root
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>\nendobj');
  
  // Page 1: normal selectable text (Page ID: 3, Contents: 4)
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj'
  );
  
  let p1Stream = 'BT\n/F1 14 Tf\n';
  let y = 700;
  for (const line of textPageLines) {
    const esc = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    p1Stream += `50 ${y} Td\n(${esc}) Tj\n-50 -${y} Td\n`;
    y -= 25;
  }
  p1Stream += 'ET\n';
  const p1Len = Buffer.byteLength(p1Stream, 'utf-8');
  objects.push(`4 0 obj\n<< /Length ${p1Len} >>\nstream\n${p1Stream}endstream\nendobj`);
  
  // Page 2: scanned image only (Page ID: 5, Contents: 6, Image: 7)
  objects.push(
    '5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 7 0 R >> >> /Contents 6 0 R >>\nendobj'
  );
  
  const p2Stream = 'q\n500 0 0 400 56 300 cm\n/Im1 Do\nQ\n';
  const p2Len = Buffer.byteLength(p2Stream, 'utf-8');
  objects.push(`6 0 obj\n<< /Length ${p2Len} >>\nstream\n${p2Stream}endstream\nendobj`);
  
  // Object 7: Image XObject
  const imgHeader = `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${buffer.length} >>\nstream\n`;
  const imgFooter = '\nendstream\nendobj';
  
  let header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const chunks = [Buffer.from(header, 'latin1')];
  const offsets = [0];
  let curOffset = chunks[0].length;
  
  for (let i = 0; i < objects.length; i++) {
    offsets.push(curOffset);
    const chunk = Buffer.from(objects[i] + '\n', 'latin1');
    chunks.push(chunk);
    curOffset += chunk.length;
  }
  
  // Object 7 binary
  offsets.push(curOffset);
  const obj7HeaderBuf = Buffer.from(imgHeader, 'latin1');
  const obj7FooterBuf = Buffer.from(imgFooter + '\n', 'latin1');
  chunks.push(obj7HeaderBuf);
  chunks.push(buffer);
  chunks.push(obj7FooterBuf);
  curOffset += obj7HeaderBuf.length + buffer.length + obj7FooterBuf.length;
  
  const startXref = curOffset;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, 'latin1'));
  
  return Buffer.concat(chunks);
}

const fixturesDir = path.resolve('test_fixtures');

// Render scanned bitmap text
const imageInfo = renderTextToGrayscaleBitmap([
  'SCANNED DOCUMENT TEST',
  'COURSE: ARTIFICIAL INTELLIGENCE',
  'MODULE 3: NEURAL NETWORKS',
  'BACKPROPAGATION AND GRADIENT DESCENT'
], 3);

// Generate scanned PDF
const scannedPdf = createScannedPdfWithImage(imageInfo);
fs.writeFileSync(path.join(fixturesDir, 'scanned_printed.pdf'), scannedPdf);

// Generate mixed PDF (Page 1 text, Page 2 image)
const mixedPdf = createMixedPdf(
  [
    'PAGE 1: SELECTABLE DIGITAL TEXT',
    'Topic: Digital Electronics Logic Gates',
    'AND, OR, NOT, NAND, NOR, XOR, XNOR gates.'
  ],
  imageInfo
);
fs.writeFileSync(path.join(fixturesDir, 'mixed_document.pdf'), mixedPdf);

console.log('Successfully generated scanned and mixed test PDFs:');
console.log(' - scanned_printed.pdf (', scannedPdf.length, 'bytes, image', imageInfo.width, 'x', imageInfo.height, ')');
console.log(' - mixed_document.pdf (', mixedPdf.length, 'bytes )');
