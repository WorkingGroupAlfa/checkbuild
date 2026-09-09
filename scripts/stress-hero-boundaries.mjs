import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';

const baseUrl = process.argv.find(value => /^https?:/.test(value)) ?? 'http://127.0.0.1:4173';
const useWebKit = process.argv.includes('--webkit');
const engine = useWebKit ? 'webkit' : 'chromium';
const browser = useWebKit
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const sizes = [[375, 667], [390, 844], [430, 932], [844, 390], [1440, 1000], [1900, 940]];
const sections = ['.project-overview--site-only', '.project-stats', '.project-selector'];
const results = [];
await fs.mkdir('.tmp', { recursive: true });

async function inspect(page) {
  return page.evaluate(selectors => {
    const rect = selector => {
      const { top, right, bottom, left, height } = document.querySelector(selector).getBoundingClientRect();
      return { top, right, bottom, left, height };
    };
    return { story: rect('.project-video-story'), layer: rect('.project-video-story__background'), sections: selectors.map(rect), scrollY, width: innerWidth, documentWidth: document.documentElement.scrollWidth };
  }, sections);
}
async function scroll(page, y) {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function assertBoundaries(state, label) {
  assert.ok(state.layer.bottom <= state.story.bottom + 1, `${label}: background extends past the story by ${state.layer.bottom - state.story.bottom}px`);
  assert.ok(state.layer.top >= state.story.top - 1, `${label}: background escapes the top of the story`);
  assert.ok(state.layer.left >= -1 && state.layer.right <= state.width + 1, `${label}: background escapes horizontally`);
  assert.ok(state.documentWidth <= state.width + 1, `${label}: horizontal document overflow`);
  let previousBottom = state.story.bottom;
  for (const section of state.sections) {
    assert.ok(section.top >= previousBottom - 1, `${label}: following sections overlap`);
    previousBottom = section.bottom;
  }
}

try {
  for (const [width, height] of sizes) {
    const label = `${engine}-${width}x${height}`;
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 900 });
    await page.addInitScript(() => localStorage.setItem('fortis-cookie-choice', 'necessary'));
    if (useWebKit) {
      // Windows WebKit cannot load media/fonts in this environment. Check layout
      // with the poster and system fonts; Chromium also checks the playing video.
      await page.route('**/hero-scroll.mp4', route => route.abort());
      await page.route('**/*.woff2', route => route.abort());
    }
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.project-overview__site-copy h2');
    if (!useWebKit) await page.evaluate(() => document.fonts.ready);
    if (!useWebKit) await page.waitForFunction(() => document.querySelector('video')?.dataset.ready === 'true');
    const initial = await inspect(page);
    const end = initial.story.bottom + initial.scrollY;
    const positions = [0, end - height, end - height / 2, end - 80, end + 20, ...initial.sections.map(rect => rect.top + initial.scrollY - 100)];
    for (const y of [...positions, ...positions.toReversed()]) {
      await scroll(page, y);
      assertBoundaries(await inspect(page), label);
    }
    await page.setViewportSize({ width, height: height + 120 });
    for (const y of [end - height / 2, end + 20]) {
      await scroll(page, y);
      assertBoundaries(await inspect(page), `${label} resized`);
    }
    await page.setViewportSize({ width, height });
    const heading = page.locator('.project-overview__site-copy h2');
    assert.equal(await heading.innerText(), 'The site');
    const headingY = await heading.evaluate(element => element.getBoundingClientRect().top + scrollY - 150);
    await scroll(page, headingY);
    const unobscured = await heading.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return !!hit?.closest('.project-overview--site-only');
    });
    assert.ok(unobscured, `${label}: The site is covered by another layer`);
    if (!useWebKit) await page.screenshot({ path: `.tmp/boundary-${label}-site.png` });
    await scroll(page, await page.locator('.project-selector').evaluate(element => element.getBoundingClientRect().top + scrollY - 100));
    if (!useWebKit) await page.screenshot({ path: `.tmp/boundary-${label}-selector.png` });
    results.push({ viewport: `${width}x${height}`, boundaryOverflow: 0, siteVisible: true, resize: true });
    await page.close();
  }
  await fs.writeFile(`.tmp/validation-hero-boundaries-${engine}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ engine, results }, null, 2));
} finally {
  await browser.close();
}