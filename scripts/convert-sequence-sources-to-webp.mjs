import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'images');
const sourceNames = (await fs.readdir(sourceDir))
  .filter((name) => /^(?:1|mask) \(\d+\)\.png$/i.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!sourceNames.length) {
  console.log('No PNG sequence sources found. The sequence is already WebP.');
  process.exit(0);
}

let pngBytes = 0;
let webpBytes = 0;

async function retryBusy(operation) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

for (const name of sourceNames) {
  const source = path.join(sourceDir, name);
  const target = path.join(sourceDir, name.replace(/\.png$/i, '.webp'));
  const isMask = /^mask /i.test(name);
  const sourceMetadata = await sharp(source).metadata();

  const converted = await sharp(source)
    .webp(isMask
      ? { lossless: true, effort: 6, alphaQuality: 100 }
      : { quality: 92, effort: 6, smartSubsample: true })
    .toBuffer();

  const convertedMetadata = await sharp(converted).metadata();
  if (
    convertedMetadata.format !== 'webp'
    || convertedMetadata.width !== sourceMetadata.width
    || convertedMetadata.height !== sourceMetadata.height
  ) {
    throw new Error(`WebP validation failed for ${name}.`);
  }

  if (isMask) {
    const [sourcePixels, convertedPixels] = await Promise.all([
      sharp(source).ensureAlpha().raw().toBuffer(),
      sharp(converted).ensureAlpha().raw().toBuffer(),
    ]);
    if (!sourcePixels.equals(convertedPixels)) {
      throw new Error(`Lossless mask validation failed for ${name}.`);
    }
  }

  const sourceStat = await fs.stat(source);
  await retryBusy(() => fs.rm(target, { force: true }));
  await retryBusy(() => fs.writeFile(target, converted));
  await retryBusy(() => fs.rm(source));
  pngBytes += sourceStat.size;
  webpBytes += converted.byteLength;
  console.log(`${name} -> ${path.basename(target)}`);
}

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`Converted ${sourceNames.length} files: ${megabytes(pngBytes)} -> ${megabytes(webpBytes)}.`);
