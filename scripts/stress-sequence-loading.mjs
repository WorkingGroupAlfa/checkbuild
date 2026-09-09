import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({
  executablePath: process.env.EDGE_EXECUTABLE ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.addInitScript(() => {
    localStorage.setItem('fortis-cookie-choice', 'necessary');
    localStorage.setItem('collins-rotated', '1');
    window.__sequenceAudit = { decodes: 0, history: 0, hi: [], abortedHi: 0 };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function (...args) {
      window.__sequenceAudit.decodes++;
      return decode.apply(this, args);
    };
    const replace = history.replaceState;
    history.replaceState = function (...args) {
      window.__sequenceAudit.history++;
      return replace.apply(this, args);
    };
    const originalFetch = window.fetch;
    window.fetch = async function (source, options) {
      const hi = String(source).includes('/beauty/hi/');
      if (hi) {
        const viewer = document.querySelector('.sequence-viewer');
        window.__sequenceAudit.hi.push({
          source: String(source),
          target: viewer?.dataset.targetFrame,
          displayed: viewer?.dataset.displayedFrame,
          dragging: viewer?.classList.contains('is-dragging'),
        });
      }
      try { return await originalFetch.call(this, source, options); }
      catch (error) { if (hi && error.name === 'AbortError') window.__sequenceAudit.abortedHi++; throw error; }
    };
  });
  let blockNormal = false, missingMasks = false, missingTarget = false, slowHi = false;
  const normalRequests = [], hiRequests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/generated/**', async route => {
    const url = route.request().url();
    const hi = url.includes('/beauty/hi/');
    if (hi) {
      hiRequests.push(url);
      if (slowHi) await new Promise(resolve => setTimeout(resolve, 1800));
    } else normalRequests.push(url);
    if ((!hi && blockNormal) || (missingMasks && /level_\d+\./.test(url)) ||
        (missingTarget && url.includes('/beauty/') && /frame_000\./.test(url))) {
      await route.fulfill({ status: 503, body: 'Simulated unavailable asset' });
      return;
    }
    await route.continue();
  });

  async function open(query) {
    await page.goto(baseUrl + '/?' + query + '#available-spaces', { waitUntil: 'domcontentloaded' });
    await page.locator('.sequence-viewer').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.beauty-frame.is-active img')?.currentSrc.startsWith('blob:'));
  }
  async function rotate(target, steps = 42, expected = target) {
    const viewer = page.locator('.sequence-viewer');
    const box = await viewer.boundingBox();
    assert(box);
    const current = Number(await viewer.getAttribute('data-target-frame'));
    const delta = (current - target) * 8;
    const x = delta < 0 ? box.x + box.width * 0.8 : box.x + box.width * 0.2;
    const y = box.y + box.height * 0.54;
    const historyBefore = await page.evaluate(() => window.__sequenceAudit.history);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta, y, { steps });
    const historyDuring = await page.evaluate(() => window.__sequenceAudit.history);
    assert.equal(historyDuring, historyBefore, 'URL must not be written during a drag');
    await page.mouse.up();
    const released = performance.now();
    await page.waitForFunction(frame => document.querySelector('.sequence-viewer')?.dataset.displayedFrame === String(frame), expected, { timeout: 12000 });
    const lag = performance.now() - released;
    await page.waitForTimeout(250);
    assert.equal(new URL(page.url()).searchParams.get('angle'), String(target * 4 - 60));
    assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'performance');
    assert.equal(new URL(page.url()).hash, '#available-spaces');
    const historyAfter = await page.evaluate(() => window.__sequenceAudit.history);
    assert(historyAfter - historyBefore <= 1, 'Expected at most one URL update per gesture');
    return lag;
  }

  await open('angle=0&level=12&utm_source=performance');
  await rotate(0);
  await rotate(30);
  await page.waitForTimeout(2200);
  const idleBefore = await page.evaluate(() => window.__sequenceAudit.decodes);
  await page.waitForTimeout(1500);
  const idleDecodes = await page.evaluate(() => window.__sequenceAudit.decodes) - idleBefore;
  assert.equal(idleDecodes, 0, 'No decode/fallback loop may run while idle');
  results.idleDecodes = idleDecodes;

  // Routing disables the browser HTTP cache. Successful rotation with all
  // normal requests blocked proves that the viewer owns its downloaded bytes.
  blockNormal = true;
  const requestsBefore = normalRequests.length;
  const lag = [];
  for (const target of [0, 30, 0, 30]) lag.push(await rotate(target));
  assert.equal(normalRequests.length, requestsBefore, 'Warm rotation must not re-request beauty or mask assets');
  assert(Math.max(...lag) < 1000, 'Warm rotation fell more than a second behind input');
  results.warmAfterReleaseMs = lag.map(Math.round);
  results.warmRequests = normalRequests.length - requestsBefore;
  const high = await page.evaluate(() => window.__sequenceAudit.hi);
  assert(high.every(item => item.target === item.displayed && !item.dragging), 'High resolution started for an unsettled frame');
  results.settledHighResolution = high.length;

  blockNormal = false;
  slowHi = true;
  await open('angle=0&level=12&utm_source=performance');
  await page.waitForFunction(() => window.__sequenceAudit.hi.length > 0);
  const box = await page.locator('.sequence-viewer').boundingBox();
  await page.mouse.move(box.x + box.width * 0.07, box.y + box.height * 0.85);
  await page.mouse.down();
  await page.waitForFunction(() => window.__sequenceAudit.abortedHi > 0);
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.__sequenceAudit.hi.length), 1, 'No high resolution while pointer is held');
  await page.mouse.up();
  results.highResolutionCancelled = true;
  slowHi = false;

  missingMasks = true;
  await open('angle=0&level=12&utm_source=performance');
  await rotate(0);
  await rotate(30);
  assert.equal(await page.evaluate(() => {
    const canvas = document.querySelector('.viewer-overlay');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  }), false, 'A missing mask must not dim the entire building');
  results.missingMasksRotate = true;
  missingMasks = false;

  missingTarget = true;
  await open('angle=0&utm_source=performance');
  await rotate(0, 42, 1);
  await page.getByRole('button', { name: 'View unavailable. Try again' }).waitFor();
  missingTarget = false;
  await page.getByRole('button', { name: 'View unavailable. Try again' }).click();
  await page.waitForFunction(() => document.querySelector('.sequence-viewer')?.dataset.displayedFrame === '0');
  results.failedTargetRecovered = true;

  await open('fallback=1&level=12&utm_source=performance');
  await page.locator('.sequence-viewer').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.sequence-viewer').getAttribute('data-displayed-frame'), '15');
  results.fallback = true;
  assert.deepEqual(errors, []);
  await page.close();

  const saver = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const saverRequests = [];
  await saver.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    localStorage.setItem('fortis-cookie-choice', 'necessary');
  });
  saver.on('request', request => { if (request.url().includes('/beauty/')) saverRequests.push(request.url()); });
  await saver.goto(baseUrl + '/?level=12', { waitUntil: 'domcontentloaded' });
  await saver.waitForTimeout(2500);
  assert(saverRequests.every(url => !url.includes('/hi/')), 'Data saver must not load high resolution');
  assert(saverRequests.length <= 8, 'Data saver must not preload the full sequence');
  results.dataSaverRequests = saverRequests.length;
  await saver.locator('.sequence-viewer').scrollIntoViewIfNeeded();
  const touch = await saver.context().newCDPSession(saver);
  const mobileBox = await saver.locator('.sequence-viewer').boundingBox();
  const touchX = mobileBox.x + mobileBox.width * 0.75;
  const touchY = mobileBox.y + mobileBox.height * 0.28;
  const scrollBefore = await saver.evaluate(() => scrollY);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
  for (let step = 1; step <= 15; step++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX - step * 7, y: touchY }] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await saver.waitForFunction(() => document.querySelector('.sequence-viewer')?.dataset.displayedFrame === '30');
  assert(Math.abs(await saver.evaluate(() => scrollY) - scrollBefore) < 3, 'Horizontal swipe must not scroll vertically');
  const verticalX = mobileBox.x + mobileBox.width * 0.1;
  const verticalY = mobileBox.y + mobileBox.height * 0.55;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: verticalX, y: verticalY }] });
  for (let step = 1; step <= 8; step++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: verticalX, y: verticalY - step * 15 }] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await saver.waitForTimeout(300);
  assert.equal(await saver.locator('.sequence-viewer').getAttribute('data-target-frame'), '30');
  assert(await saver.evaluate(() => scrollY) > scrollBefore + 20, 'Vertical swipe must retain normal page scrolling');
  results.mobileSwipeAndScroll = true;
  await saver.close();
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
