/* File → text extraction (PDF, DOCX, TXT). Libraries are lazy-loaded from cdnjs only when needed;
 * files are read locally and never uploaded anywhere. */
(function (root) {
  'use strict';

  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const MAMMOTH = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
  const MAX_BYTES = 10 * 1024 * 1024;

  const loading = new Map();
  function loadScript(src) {
    if (loading.has(src)) return loading.get(src);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading.delete(src); reject(new Error('Could not load the file reader. Check your connection, or paste the text instead.')); };
      document.head.appendChild(s);
    });
    loading.set(src, p);
    return p;
  }

  async function pdfToText(buffer) {
    await loadScript(PDFJS);
    const pdfjs = root.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let out = '';
      let lastY = null;
      for (const item of content.items) {
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
        out += item.str;
        if (item.hasEOL) out += '\n';
        else if (item.str && !/\s$/.test(item.str)) out += ' ';
        lastY = y;
      }
      pages.push(out.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' '));
    }
    return pages.join('\n\n');
  }

  async function docxToText(buffer) {
    await loadScript(MAMMOTH);
    const result = await root.mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  async function fileToText(file) {
    if (!file) throw new Error('No file selected.');
    if (file.size > MAX_BYTES) throw new Error('That file is larger than 10 MB. Please use a smaller file or paste the text.');
    const name = (file.name || '').toLowerCase();
    const buffer = await file.arrayBuffer();
    let text;
    if (name.endsWith('.pdf') || file.type === 'application/pdf') text = await pdfToText(buffer);
    else if (name.endsWith('.docx')) text = await docxToText(buffer);
    else if (name.endsWith('.doc')) throw new Error('Old .doc files are not supported. Save it as .docx or PDF, or paste the text.');
    else text = new TextDecoder('utf-8').decode(buffer);
    text = text.trim();
    if (!text) throw new Error('No text found in that file. If it is a scanned PDF, paste the text instead.');
    return text;
  }

  root.GapParsers = { fileToText };
})(window);
