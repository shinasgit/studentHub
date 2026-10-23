// scripts/test_pdf_generator.mjs
import fs from 'fs';
import path from 'path';

function createPdfWithPages(pagesData) {
  const objects = [];
  
  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  
  // Object 2: Pages root (we'll fill Kids after creating page objects)
  const numPages = pagesData.length;
  const pageObjIds = [];
  let nextId = 3;
  
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(nextId);
    nextId += 2; // one for Page, one for Contents
  }
  
  const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${numPages} >>\nendobj`);
  
  for (let i = 0; i < numPages; i++) {
    const pageId = pageObjIds[i];
    const contentId = pageId + 1;
    const pageContent = pagesData[i].textLines || [];
    
    // Build stream
    let streamBody = 'BT\n/F1 14 Tf\n';
    let y = 720;
    for (const line of pageContent) {
      // Escape parentheses in text
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      streamBody += `50 ${y} Td\n(${escaped}) Tj\n-50 -${y} Td\n`; // reset and move
      y -= 25;
    }
    streamBody += 'ET\n';
    
    const streamLen = Buffer.byteLength(streamBody, 'utf-8');
    
    // Page object
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentId} 0 R >>\nendobj`
    );
    
    // Content stream object
    objects.push(
      `${contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamBody}endstream\nendobj`
    );
  }
  
  // Construct entire PDF and compute xref offsets
  let header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let offset = Buffer.byteLength(header, 'latin1');
  const offsets = [0]; // object 0
  let body = '';
  
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset + Buffer.byteLength(body, 'latin1'));
    body += objects[i] + '\n';
  }
  
  const startXref = offset + Buffer.byteLength(body, 'latin1');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  
  return Buffer.from(header + body + xref + trailer, 'latin1');
}

// Ensure fixtures dir exists
const fixturesDir = path.resolve('test_fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. Normal text PDF
const normalPdf = createPdfWithPages([
  {
    textLines: [
      'COMPUTER NETWORKS - LECTURE 1',
      'Topic: OSI Reference Model Architecture',
      'The Open Systems Interconnection model defines seven abstraction layers:',
      '1. Physical Layer: Transmission of raw bitstream over physical media',
      '2. Data Link Layer: Node-to-node data transfer and error detection (Ethernet, MAC)',
      '3. Network Layer: Packet forwarding and routing through intermediate routers (IP, ICMP)',
      '4. Transport Layer: End-to-end communication and reliability (TCP, UDP)',
      '5. Session Layer: Dialogue control and token management',
      '6. Presentation Layer: Data formatting, encryption, and compression',
      '7. Application Layer: End-user protocols (HTTP, DNS, FTP, SMTP)'
    ]
  },
  {
    textLines: [
      'COMPUTER NETWORKS - LECTURE 2',
      'Topic: Transport Layer Protocols',
      'Transmission Control Protocol (TCP) provides connection-oriented, reliable transmission.',
      'User Datagram Protocol (UDP) provides connectionless, low-latency transmission.',
      'TCP three-way handshake: SYN -> SYN-ACK -> ACK.'
    ]
  }
]);
fs.writeFileSync(path.join(fixturesDir, 'normal_text.pdf'), normalPdf);

// 2. Empty or nearly empty PDF
const emptyPdf = createPdfWithPages([
  { textLines: [] }
]);
fs.writeFileSync(path.join(fixturesDir, 'empty_document.pdf'), emptyPdf);

// 3. Corrupted / unsupported PDF
const corruptedPdf = Buffer.from('%PDF-1.4\ncorrupted header << /invalid corrupt data bytes \xFF\xFE\x00\x00', 'utf-8');
fs.writeFileSync(path.join(fixturesDir, 'corrupted_unsupported.pdf'), corruptedPdf);

// 4. Large multi-page PDF (8 pages)
const largePages = [];
for (let p = 1; p <= 8; p++) {
  largePages.push({
    textLines: [
      `OPERATING SYSTEMS STUDY GUIDE - CHAPTER ${p}`,
      `Section ${p}.1: Process Synchronization and Deadlocks`,
      `This is page ${p} of the comprehensive Operating Systems revision module.`,
      `Key concept ${p}: Mutex locks, binary semaphores, and monitors provide mutual exclusion.`,
      `Condition variables allow threads to synchronize based on state changes.`,
      `Page ${p} verification marker: OS_PAGE_${p}_VALIDATED`
    ]
  });
}
const largePdf = createPdfWithPages(largePages);
fs.writeFileSync(path.join(fixturesDir, 'large_multipage.pdf'), largePdf);

console.log('Successfully generated test PDF files in test_fixtures/:');
console.log(' - normal_text.pdf (', normalPdf.length, 'bytes )');
console.log(' - empty_document.pdf (', emptyPdf.length, 'bytes )');
console.log(' - corrupted_unsupported.pdf (', corruptedPdf.length, 'bytes )');
console.log(' - large_multipage.pdf (', largePdf.length, 'bytes )');
