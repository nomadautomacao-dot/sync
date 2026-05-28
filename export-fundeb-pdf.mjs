#!/usr/bin/env node
// export-fundeb-pdf.mjs — Specialized export for the FUNDEB presentation
// Forces all reveal elements visible before capturing each slide

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';

const SERVE_DIR = process.argv[2];
const HTML_FILE = process.argv[3];
const OUTPUT_PDF = process.argv[4];
const VP_WIDTH = 1920;
const VP_HEIGHT = 1080;

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const server = createServer((req, res) => {
  const decodedUrl = decodeURIComponent(req.url);
  let filePath = join(SERVE_DIR, decodedUrl === '/' ? HTML_FILE : decodedUrl);
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

const port = await new Promise((resolve) => {
  server.listen(0, () => resolve(server.address().port));
});
console.log(`  Server on port ${port}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: VP_WIDTH, height: VP_HEIGHT } });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2000);

// FORCE ALL ANIMATIONS OFF GLOBALLY before any capture
await page.evaluate(() => {
  // Inject a <style> that forces everything visible
  const style = document.createElement('style');
  style.textContent = `
    .reveal, .reveal-left, .reveal-scale, .reveal-blur,
    [class*="reveal"] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      visibility: visible !important;
      filter: none !important;
      animation: none !important;
    }
    .slide .reveal, .slide .reveal-left {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .bar-fill {
      animation: none !important;
      transition: none !important;
    }
    * {
      transition-delay: 0s !important;
      animation-delay: 0s !important;
    }
  `;
  document.head.appendChild(style);
});

const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`  Found ${slideCount} slides`);

const TEMP_DIR = process.argv[5] || '/tmp/fundeb-screenshots';
mkdirSync(TEMP_DIR, { recursive: true });
const screenshotPaths = [];

for (let i = 0; i < slideCount; i++) {
  await page.evaluate((index) => {
    const slides = document.querySelectorAll('.slide');
    slides.forEach((slide, idx) => {
      if (idx === index) {
        slide.style.display = '';
        slide.style.opacity = '1';
        slide.style.visibility = 'visible';
        slide.style.position = 'relative';
        slide.style.transform = 'none';
        slide.style.pointerEvents = 'auto';
        slide.classList.add('active', 'visible');

        // Force ALL children with reveal class
        slide.querySelectorAll('.reveal, .reveal-left, [class*="reveal"]').forEach(el => {
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.visibility = 'visible';
          el.style.filter = 'none';
          el.style.transition = 'none';
          el.style.transitionDelay = '0s';
        });
      } else {
        slide.style.display = 'none';
        slide.classList.remove('active', 'visible');
      }
    });
  }, i);

  await page.waitForTimeout(400);

  const screenshotPath = join(TEMP_DIR, `slide-${String(i + 1).padStart(3, '0')}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  screenshotPaths.push(screenshotPath);
  console.log(`  Captured slide ${i + 1}/${slideCount}`);
}

await browser.close();
server.close();

// Combine into PDF
console.log('  Assembling PDF...');
const browser2 = await chromium.launch();
const pdfPage = await browser2.newPage();

const imagesHtml = screenshotPaths.map((p) => {
  const imgData = readFileSync(p).toString('base64');
  return `<div class="page"><img src="data:image/png;base64,${imgData}" /></div>`;
}).join('\n');

const pdfHtml = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  @page { size: ${VP_WIDTH}px ${VP_HEIGHT}px; margin: 0; }
  .page { width: ${VP_WIDTH}px; height: ${VP_HEIGHT}px; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  img { width: ${VP_WIDTH}px; height: ${VP_HEIGHT}px; display: block; object-fit: contain; }
</style></head><body>${imagesHtml}</body></html>`;

await pdfPage.setContent(pdfHtml, { waitUntil: 'load' });
await pdfPage.pdf({
  path: OUTPUT_PDF,
  width: `${VP_WIDTH}px`,
  height: `${VP_HEIGHT}px`,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser2.close();
screenshotPaths.forEach(p => unlinkSync(p));
console.log(`  ✓ PDF saved to: ${OUTPUT_PDF}`);
