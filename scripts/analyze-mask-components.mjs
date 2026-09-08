import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'images');
const names = (await fs.readdir(sourceDir))
  .filter((name) => /^mask \(\d+\)\.(?:png|webp)$/i.test(name))
  .sort((left, right) => Number(left.match(/\d+/)[0]) - Number(right.match(/\d+/)[0]));

function components(data, width, height, channels) {
  const classes = new Uint8Array(width * height);
  for (let pixel = 0, offset = 0; pixel < classes.length; pixel += 1, offset += channels) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (r > 80 && r - g > 35 && r - b > 35) classes[pixel] = 1;
    else if (g > 80 && g - r > 35 && g - b > 35) classes[pixel] = 2;
  }
  const visited = new Uint8Array(classes.length);
  const queue = new Int32Array(classes.length);
  const found = [];
  const minimumPixels = Math.max(3000, Math.floor(classes.length * 0.0004));
  for (let start = 0; start < classes.length; start += 1) {
    const color = classes[start];
    if (!color || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    visited[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = (index / width) | 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      const neighbours = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
      for (const next of neighbours) {
        if (next >= 0 && !visited[next] && classes[next] === color) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (tail >= minimumPixels) found.push({ color, pixels: tail, bounds: [minX, minY, maxX, maxY], centroid: [Math.round(sumX / tail), Math.round(sumY / tail)] });
  }
  return found.sort((left, right) => left.centroid[1] - right.centroid[1]);
}

const report = [];
for (let frame = 0; frame < names.length; frame += 1) {
  const { data, info } = await sharp(path.join(sourceDir, names[frame])).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const found = components(data, info.width, info.height, info.channels);
  report.push({ frame, source: names[frame], count: found.length, bands: found.map((region, rank) => ({ rank, ...region })) });
}

const inspected = new Set([0, Math.floor(report.length / 2), report.length - 1]);
console.log(JSON.stringify({ counts: report.map(({ frame, count }) => ({ frame, count })), inspected: report.filter(({ frame }) => inspected.has(frame)) }, null, 2));
