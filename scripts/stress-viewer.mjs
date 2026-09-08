import { chromium } from 'playwright-core';

const baseUrl = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'http://127.0.0.1:5173';
const adverse = process.argv.includes('--adverse');
const failWebp = process.argv.includes('--fail-webp');
const selectedLevel = Number(process.argv.find((argument) => argument.startsWith('--level='))?.split('=')[1] ?? 12);
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: adverse ? 2 : 1 });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

if (adverse) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}
if (adverse || failWebp) {
  await page.route('**/generated/beauty/**', async (route) => {
    if (failWebp && new URL(route.request().url()).pathname.endsWith('.webp')) {
      await route.abort('failed');
      return;
    }
    const delay = 35 + (route.request().url().length * 17) % 180;
    if (adverse) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.continue();
  });
}

await page.goto(`${baseUrl}/?level=${selectedLevel}&angle=0`, { waitUntil: 'domcontentloaded' });
await page.locator('.sequence-viewer').scrollIntoViewIfNeeded();
await page.locator('.beauty-frame.is-active img').waitFor({ state: 'visible' });
await page.waitForFunction(() => document.querySelector('.beauty-frame.is-active img')?.naturalWidth > 0);

await page.evaluate(() => {
  window.__viewerAudit = { samples: 0, failures: [], frames: new Set(), lastFrame: null, maxFrameJump: 0 };
  const sample = () => {
    const audit = window.__viewerAudit;
    const active = document.querySelector('.beauty-frame.is-active');
    const outgoing = document.querySelector('.beauty-frame.is-outgoing');
    const activeImage = active?.querySelector('img');
    const outgoingImage = outgoing?.querySelector('img');
    const activeOpacity = active ? Number(getComputedStyle(active).opacity) : 0;
    const outgoingOpacity = outgoing ? Number(getComputedStyle(outgoing).opacity) : 0;
    const activeReady = Boolean(activeImage?.complete && activeImage.naturalWidth > 0);
    const outgoingReady = Boolean(outgoingImage?.complete && outgoingImage.naturalWidth > 0);
    audit.samples += 1;
    if (active?.dataset.frame) {
      audit.frames.add(active.dataset.frame);
      if (audit.lastFrame !== null && audit.lastFrame !== active.dataset.frame) {
        audit.maxFrameJump = Math.max(audit.maxFrameJump, Math.abs(Number(active.dataset.frame) - Number(audit.lastFrame)));
      }
      audit.lastFrame = active.dataset.frame;
    }
    if (!activeReady || (activeOpacity < 0.94 && !(outgoingReady && outgoingOpacity > 0.94))) {
      audit.failures.push({
        time: performance.now(),
        active: active?.dataset.frame ?? null,
        activeReady,
        activeOpacity,
        activeSrc: activeImage?.currentSrc ?? null,
        outgoing: outgoing?.dataset.frame ?? null,
        outgoingReady,
        outgoingOpacity,
      });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});

const viewer = await page.locator('.sequence-viewer').boundingBox();
if (!viewer) throw new Error('Viewer did not render.');
const centerY = viewer.y + viewer.height * 0.54;
for (let pass = 0; pass < 8; pass += 1) {
  const from = pass % 2 === 0 ? viewer.x + viewer.width * 0.78 : viewer.x + viewer.width * 0.22;
  const to = pass % 2 === 0 ? viewer.x + viewer.width * 0.22 : viewer.x + viewer.width * 0.78;
  await page.mouse.move(from, centerY);
  await page.mouse.down();
  await page.mouse.move(to, centerY, { steps: 42 });
  await page.mouse.up();
  await page.waitForTimeout(pass % 3 === 0 ? 950 : 90);
}
await page.waitForTimeout(1200);

const audit = await page.evaluate(() => ({
  samples: window.__viewerAudit.samples,
  failures: window.__viewerAudit.failures,
  frames: [...window.__viewerAudit.frames],
  maxFrameJump: window.__viewerAudit.maxFrameJump,
  finalLayers: [...document.querySelectorAll('.beauty-frame')].map((element) => ({
    role: element.className,
    frame: element.dataset.frame,
    ready: element.querySelector('img')?.naturalWidth > 0,
    src: element.querySelector('img')?.currentSrc,
  })),
}));

console.log(JSON.stringify({ audit, consoleErrors }, null, 2));
await browser.close();
const unexpectedErrors = failWebp ? consoleErrors.filter((error) => !error.includes('Failed to load resource')) : consoleErrors;
if (audit.failures.length || audit.maxFrameJump > 1 || unexpectedErrors.length) process.exitCode = 1;
