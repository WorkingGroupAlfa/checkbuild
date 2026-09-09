import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const results = {};
await fs.mkdir('.tmp', { recursive: true });

async function open(options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...options });
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('fortis-cookie-choice', 'necessary');
    window.__hero = { plays: 0, seeks: 0, overlaps: 0, denyPlay: false };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__hero.plays++;
      if (window.__hero.denyPlay) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
      return play.call(this);
    };
    const currentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', { ...currentTime, set(value) {
      window.__hero.seeks++;
      if (this.seeking) window.__hero.overlaps++;
      currentTime.set.call(this, value);
    } });
  });
  return page;
}

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('video')?.dataset.ready === 'true');
}

async function posterVisible(page) {
  await page.waitForFunction(() => {
    const poster = document.querySelector('.project-video-story__poster');
    const video = document.querySelector('video');
    return poster?.naturalWidth > 0 && video && getComputedStyle(video).opacity === '0';
  });
}

async function settled(page, progress) {
  await page.evaluate(progress => {
    const story = document.querySelector('.project-video-story');
    const layer = document.querySelector('.project-video-story__background');
    window.scrollTo({ top: story.getBoundingClientRect().top + scrollY + progress * (story.offsetHeight - layer.clientHeight), behavior: 'instant' });
  }, progress);
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    const story = document.querySelector('.project-video-story');
    const layer = document.querySelector('.project-video-story__background');
    const progress = Math.max(0, Math.min(1, -story.getBoundingClientRect().top / (story.offsetHeight - layer.clientHeight)));
    return video.paused && !video.seeking && Math.abs(video.currentTime - progress * (video.duration - 0.035)) < 0.04;
  });
  return page.evaluate(() => {
    const video = document.querySelector('video');
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 18;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, 32, 18);
    const pixels = context.getImageData(0, 0, 32, 18).data;
    const luminance = Array.from({ length: 576 }, (_, i) => (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3);
    return { time: video.currentTime, spread: Math.max(...luminance) - Math.min(...luminance), fingerprint: Array.from(pixels).reduce((sum, value, i) => (sum + value * (i + 1)) % 1000000007, 0), layerTop: document.querySelector('.project-video-story__background').getBoundingClientRect().top };
  });
}

try {
  for (const [label, options] of [['mobile', {}], ['desktop', { viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false }]]) {
    const page = await open(options);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await ready(page);
    const first = await settled(page, 0.1);
    const last = await settled(page, 0.9);
    assert.ok(first.spread > 40 && last.spread > 40, 'Video must contain an image, not a blank surface');
    assert.notEqual(first.fingerprint, last.fingerprint, 'Scrolling must change decoded pixels');
    assert.ok(Math.abs(first.layerTop) <= 1 && Math.abs(last.layerTop) <= 1, 'Background must stay sticky');
    await page.evaluate(async () => {
      const story = document.querySelector('.project-video-story');
      const range = story.offsetHeight - document.querySelector('.project-video-story__background').clientHeight;
      for (let i = 0; i < 50; i++) {
        window.scrollTo({ top: range * (i < 25 ? i / 25 : (50 - i) / 25), behavior: 'instant' });
        await new Promise(requestAnimationFrame);
      }
    });
    await settled(page, 0.3);
    const before = await page.evaluate(() => ({ ...window.__hero }));
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({ ...window.__hero }));
    assert.equal(after.overlaps, 0);
    assert.equal(before.seeks, after.seeks, 'An idle hero must not keep seeking');
    await settled(page, 0);
    await page.screenshot({ path: `.tmp/hero-${label}-fixed.png` });
    assert.deepEqual(page.errors, []);
    results[label] = { distinctFrames: true, sticky: true, overlappingSeeks: after.overlaps, idleSeeks: after.seeks - before.seeks };
    await page.close();
  }

  const denied = await open();
  await denied.addInitScript(() => { window.__hero.denyPlay = true; });
  await denied.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await posterVisible(denied);
  const before = await denied.evaluate(() => window.__hero.plays);
  await denied.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }));
  await denied.waitForTimeout(150);
  assert.equal(await denied.evaluate(() => window.__hero.plays), before, 'Denied autoplay must not be retried on every scroll');
  await denied.evaluate(() => { window.__hero.denyPlay = false; });
  await denied.touchscreen.tap(100, 200);
  await ready(denied);
  await settled(denied, 0.65);
  assert.deepEqual(denied.errors, []);
  results.touchRecovery = true;
  await denied.close();

  const delayed = await open();
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await delayed.route('**/hero-scroll.mp4', async route => { await held; await route.continue(); });
  await delayed.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await posterVisible(delayed);
  await delayed.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await posterVisible(delayed);
  await delayed.screenshot({ path: '.tmp/hero-delayed-poster.png' });
  release();
  await ready(delayed);
  await delayed.waitForFunction(() => document.querySelector('video').currentTime > 1 && !document.querySelector('video').seeking);
  assert.deepEqual(delayed.errors, []);
  results.delayedMediaRecovery = true;
  await delayed.close();

  const failed = await open();
  await failed.route('**/hero-scroll.mp4', route => route.abort());
  await failed.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await posterVisible(failed);
  await failed.touchscreen.tap(100, 200);
  await posterVisible(failed);
  assert.deepEqual(failed.errors, []);
  results.failedMediaPoster = true;
  await failed.close();

  const reduced = await open({ reducedMotion: 'reduce' });
  await reduced.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await posterVisible(reduced);
  await reduced.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
  await reduced.touchscreen.tap(100, 200);
  assert.equal(await reduced.evaluate(() => window.__hero.plays), 0);
  await reduced.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(reduced);
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await posterVisible(reduced);
  assert.deepEqual(reduced.errors, []);
  results.reducedMotion = true;
  await reduced.close();

  await fs.writeFile('.tmp/validation-hero.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}