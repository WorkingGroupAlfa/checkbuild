import { chromium } from 'playwright-core';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const levels = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });

await page.goto(`${baseUrl}/?angle=0`, { waitUntil: 'domcontentloaded' });
await page.locator('.sequence-viewer').scrollIntoViewIfNeeded();
await page.waitForFunction(() => {
  const canvas = document.querySelector('.hit-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 1 || canvas.height <= 1) return false;
  const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
  for (let pixel = 0; pixel < pixels.length; pixel += 4) {
    if (pixels[pixel + 1] === 71 && pixels[pixel + 2] === 1) return true;
  }
  return false;
});

const points = await page.evaluate((expectedLevels) => {
  const canvas = document.querySelector('.hit-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Hit canvas was not created.');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const matches = (x, y, level) => pixels[(y * canvas.width + x) * 4] === level;
  return expectedLevels.map((level) => {
    for (let y = 2; y < canvas.height - 2; y += 1) {
      for (let x = 2; x < canvas.width - 2; x += 1) {
        if (matches(x, y, level) && matches(x - 2, y, level) && matches(x + 2, y, level) && matches(x, y - 2, level) && matches(x, y + 2, level)) {
          return { level, x: (x + 0.5) / canvas.width, y: (y + 0.5) / canvas.height };
        }
      }
    }
    throw new Error(`No stable hit point for Level ${level}.`);
  });
}, levels);

const verified = [];
for (const point of points) {
  const viewer = await page.locator('.sequence-viewer').boundingBox();
  if (!viewer) throw new Error('Viewer is not visible.');
  await page.mouse.click(viewer.x + viewer.width * point.x, viewer.y + viewer.height * point.y);
  await page.getByRole('heading', { name: `Level ${String(point.level).padStart(2, '0')}`, exact: true }).waitFor();
  verified.push(point.level);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sequence-viewer')?.classList.contains('is-zoomed'));
}

console.log(JSON.stringify({ verified, count: verified.length }, null, 2));
await browser.close();
if (verified.length !== levels.length) process.exitCode = 1;
