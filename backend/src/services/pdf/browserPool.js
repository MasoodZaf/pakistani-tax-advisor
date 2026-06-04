/**
 * Shared Puppeteer browser pool (PERF-01).
 *
 * Launching a fresh Chromium per PDF request is the single biggest OOM risk on
 * the one-VPS deployment: near the 30-Sep deadline a burst of downloads spawns
 * a browser process each (~100-200MB), and the box falls over. Instead we keep
 * ONE long-lived browser and hand out a fresh page per request (cheap), behind
 * a small concurrency cap so a spike queues rather than exhausting memory.
 */

const puppeteer = require('puppeteer');
const logger = require('../../utils/logger');

const MAX_CONCURRENT = parseInt(process.env.PDF_MAX_CONCURRENCY, 10) || 2;

let _browser = null;
let _launching = null;

let _active = 0;
const _waiters = [];

function _isLive(b) {
  // Puppeteer exposes isConnected() (older) / connected (newer). Treat unknown as live.
  if (!b) return false;
  if (typeof b.isConnected === 'function') return b.isConnected();
  if (typeof b.connected === 'boolean') return b.connected;
  return true;
}

async function getBrowser() {
  if (_isLive(_browser)) return _browser;
  if (_launching) return _launching;
  _launching = puppeteer
    .launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    .then((b) => {
      _browser = b;
      _launching = null;
      // If Chromium crashes/disconnects, drop the handle so the next request relaunches.
      b.on('disconnected', () => { if (_browser === b) _browser = null; });
      logger.info('PDF browser pool: launched shared Chromium');
      return b;
    })
    .catch((e) => {
      _launching = null;
      throw e;
    });
  return _launching;
}

function _acquireSlot() {
  if (_active < MAX_CONCURRENT) {
    _active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => _waiters.push(resolve));
}

function _releaseSlot() {
  const next = _waiters.shift();
  if (next) next();        // hand the slot straight to the next waiter
  else _active -= 1;
}

/**
 * Render HTML to a PDF Buffer using the shared browser, capped at
 * MAX_CONCURRENT concurrent renders. Always returns a real Buffer.
 */
async function renderPdf(htmlContent, pdfOptions = {}) {
  await _acquireSlot();
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    const buf = await page.pdf(pdfOptions);
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  } finally {
    if (page) await page.close().catch(() => {});
    _releaseSlot();
  }
}

/** Close the shared browser (graceful shutdown). Safe to call when none exists. */
async function closeBrowser() {
  const b = _browser;
  _browser = null;
  if (b) await b.close().catch(() => {});
}

module.exports = { renderPdf, closeBrowser };
