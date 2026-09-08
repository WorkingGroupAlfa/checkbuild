import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const imageDir = path.join(root, 'images');
const outDir = path.join(root, '.tmp', 'asset-previews');
await fs.mkdir(outDir, { recursive: true });

const files = await fs.readdir(imageDir);
const sequenceNumber = (name) => Number(name.match(/\((\d+)\)\.[^.]+$/i)?.[1] ?? 0);
const beauty = files
  .filter((name) => /^1 \(\d+\)\.(?:png|webp)$/i.test(name))
  .sort((a, b) => sequenceNumber(a) - sequenceNumber(b));
const masks = files
  .filter((name) => /^mask \(\d+\)\.(?:png|webp)$/i.test(name))
  .sort((a, b) => sequenceNumber(a) - sequenceNumber(b));

const picks = [0, 7, 15, 23, 30];
for (const i of picks) {
  await sharp(path.join(imageDir, beauty[i]))
    .resize({ width: 480 })
    .jpeg({ quality: 75 })
    .toFile(path.join(outDir, `beauty-${String(i + 1).padStart(2, '0')}.jpg`));
  await sharp(path.join(imageDir, masks[i]))
    .resize({ width: 480, kernel: sharp.kernel.nearest })
    .webp({ lossless: true, effort: 6 })
    .toFile(path.join(outDir, `mask-${String(i + 1).padStart(2, '0')}.webp`));
}

const { data, info } = await sharp(path.join(imageDir, masks[15]))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const colors = new Map();
for (let i = 0; i < data.length; i += info.channels) {
  const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
  colors.set(key, (colors.get(key) ?? 0) + 1);
}
const topColors = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

console.log(JSON.stringify({ beauty, masks, topColors, previews: outDir }, null, 2));
