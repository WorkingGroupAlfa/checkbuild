import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
await fs.mkdir('.tmp', { recursive: true });

async function verify(viewport, label) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: label === 'mobile' ? 2 : 1 });
  await page.addInitScript(() => localStorage.setItem('fortis-cookie-choice', 'necessary'));
  await page.goto(`${baseUrl}/?level=10&angle=32`, { waitUntil: 'domcontentloaded' });
  const viewer = page.locator('.sequence-viewer');
  await viewer.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.beauty-frame.is-active img')?.naturalWidth > 0);
  await page.locator('.unit-option', { hasText: 'Unit 10.01' }).waitFor();
  await viewer.screenshot({ path: `.tmp/unit-options-${label}.png` });

  await page.locator('.unit-option', { hasText: 'Unit 10.01' }).click();
  await page.locator('.unit-plan-viewer').waitFor();
  await page.getByRole('heading', { name: 'Unit 10.01', exact: true }).waitFor();
  await page.locator('.unit-plan-viewer').screenshot({ path: `.tmp/unit-plan-${label}.png` });

  await page.getByRole('button', { name: 'Inquire selected' }).click();
  await page.locator('.enquiry-panel[role="dialog"]').waitFor();
  const dialogText = await page.locator('.enquiry-panel[role="dialog"]').innerText();
  if (!dialogText.includes('Unit 10.01')) throw new Error(`${label}: enquiry did not retain the selected unit.`);
  await page.getByRole('button', { name: 'Close enquiry' }).click();

  await page.getByRole('button', { name: 'Back to Level 10' }).click();
  await page.locator('.unit-option', { hasText: 'Unit 10.01' }).waitFor();
  await page.getByRole('button', { name: 'Back to building' }).click();
  await page.waitForFunction(() => !document.querySelector('.sequence-viewer')?.classList.contains('is-zoomed'));
  await page.close();
}

await verify({ width: 1440, height: 1050 }, 'desktop');
await verify({ width: 390, height: 844 }, 'mobile');
await browser.close();
console.log(JSON.stringify({ desktop: 'passed', mobile: 'passed' }, null, 2));
