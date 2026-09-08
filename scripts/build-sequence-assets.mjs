import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'images');
const publicRoot = path.join(root, 'public', 'generated');
const manifestPath = path.join(root, 'src', 'generated', 'sequence-manifest.json');
const reportPath = path.join(root, 'asset-report.json');
const selectableLevels = Array.from({ length: 14 }, (_, index) => 16 - index);
const warnings = [];
const assetVersion = Date.now().toString(36);

const sequenceNumber = (name) => Number(name.match(/\((\d+)\)\.[^.]+$/i)?.[1] ?? 0);
const fileSize = async (file) => (await fs.stat(file)).size;
const prettyBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const assetUrl = (...parts) => `/generated/${parts.join('/')}`;
const maskAssetUrl = (...parts) => `${assetUrl(...parts)}?v=${assetVersion}`;

await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.rm(publicRoot, { recursive: true, force: true });
await Promise.all([
  fs.mkdir(path.join(publicRoot, 'beauty', 'mobile'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'beauty', 'desktop'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'beauty', 'hi'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'masks'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'plans'), { recursive: true }),
]);

const allFiles = await fs.readdir(sourceDir, { recursive: true });
const sourceFiles = allFiles.filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
const beautyFiles = sourceFiles
  .filter((name) => /^1 \(\d+\)\.(?:png|webp)$/i.test(path.basename(name)))
  .sort((a, b) => sequenceNumber(a) - sequenceNumber(b));
const maskFiles = sourceFiles
  .filter((name) => /^mask \(\d+\)\.(?:png|webp)$/i.test(path.basename(name)))
  .sort((a, b) => sequenceNumber(a) - sequenceNumber(b));
const planLevelPattern = /(?:plan|floor)[_ ()-]*(?:level[_ -]*)?0?(3|4|5|6|7|8|9|10|11|12|13|14|15|16)/i;
const planCandidates = sourceFiles.filter((name) => planLevelPattern.test(name));
const idMappingCandidates = [path.join(sourceDir, 'ids.json'), path.join(root, 'assets', 'ids.json')];
let explicitIdDefinitions = null;
for (const candidate of idMappingCandidates) {
  try {
    const mapping = JSON.parse(await fs.readFile(candidate, 'utf8'));
    explicitIdDefinitions = Object.entries(mapping).map(([level, color], index) => {
      const match = String(color).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (!match) throw new Error(`Invalid color ${color} for Level ${level}.`);
      return { level: Number(level), colorClass: index + 1, rgb: match.slice(1).map((value) => Number.parseInt(value, 16)) };
    });
    console.log(`Using explicit floor IDs from ${path.relative(root, candidate)}.`);
    break;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (!beautyFiles.length) throw new Error('No beauty sequence was found in /images.');
if (beautyFiles.length !== maskFiles.length) {
  warnings.push(`Sequence count mismatch: ${beautyFiles.length} beauty renders and ${maskFiles.length} masks.`);
}
if (beautyFiles.some((name, i) => sequenceNumber(name) !== i + 1)) {
  warnings.push('Beauty export counters are non-contiguous; frames were paired to masks by verified visual sequence order.');
}

const pairCount = Math.min(beautyFiles.length, maskFiles.length);
const frontFrame = Math.floor((pairCount - 1) / 2);
const angleStep = pairCount > 1 ? 120 / (pairCount - 1) : 0;
const angles = Array.from({ length: pairCount }, (_, i) => Math.round((-60 + angleStep * i) * 100) / 100);
const sourceMetadata = await Promise.all(beautyFiles.slice(0, pairCount).map((name) => sharp(path.join(sourceDir, name)).metadata()));
const distinctDimensions = [...new Set(sourceMetadata.map(({ width, height }) => `${width}x${height}`))];
if (distinctDimensions.length !== 1) warnings.push(`Beauty source dimensions vary: ${distinctDimensions.join(', ')}.`);

function classifyPixels(data, channels) {
  const pixelCount = data.length / channels;
  const classes = new Uint8Array(pixelCount);
  for (let p = 0, i = 0; p < pixelCount; p += 1, i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (explicitIdDefinitions) {
      let closest = null;
      let closestDistance = 30 * 30;
      for (const definition of explicitIdDefinitions) {
        const distance = (r - definition.rgb[0]) ** 2 + (g - definition.rgb[1]) ** 2 + (b - definition.rgb[2]) ** 2;
        if (distance < closestDistance) { closestDistance = distance; closest = definition.colorClass; }
      }
      if (closest !== null) classes[p] = closest;
    } else if (r > 80 && r - g > 35 && r - b > 35) classes[p] = 1;
    else if (g > 80 && g - r > 35 && g - b > 35) classes[p] = 2;
  }
  return classes;
}

function findRegions(classes, width, height) {
  const visited = new Uint8Array(classes.length);
  const labels = new Uint8Array(classes.length);
  const queue = new Int32Array(classes.length);
  const regions = [];
  const minimumPixels = Math.max(3000, Math.floor(classes.length * 0.0004));

  for (let start = 0; start < classes.length; start += 1) {
    const colorClass = classes[start];
    if (!colorClass || visited[start]) continue;
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
      const left = index - 1;
      const right = index + 1;
      const up = index - width;
      const down = index + width;
      if (x > 0 && !visited[left] && classes[left] === colorClass) { visited[left] = 1; queue[tail++] = left; }
      if (x + 1 < width && !visited[right] && classes[right] === colorClass) { visited[right] = 1; queue[tail++] = right; }
      if (y > 0 && !visited[up] && classes[up] === colorClass) { visited[up] = 1; queue[tail++] = up; }
      if (y + 1 < height && !visited[down] && classes[down] === colorClass) { visited[down] = 1; queue[tail++] = down; }
    }

    if (tail >= minimumPixels) {
      const componentId = regions.length + 1;
      for (let index = 0; index < tail; index += 1) labels[queue[index]] = componentId;
      regions.push({
        componentId,
        colorClass,
        minX,
        minY,
        maxX,
        maxY,
        pixelCount: tail,
        centroid: [Math.round(sumX / tail), Math.round(sumY / tail)],
      });
    }
  }
  return { regions: regions.sort((a, b) => a.centroid[1] - b.centroid[1]), labels };
}

function combineRegions(regions) {
  if (!regions.length) return null;
  const pixelCount = regions.reduce((sum, region) => sum + region.pixelCount, 0);
  return {
    componentIds: regions.map((region) => region.componentId),
    colorClass: regions[0].colorClass,
    minX: Math.min(...regions.map((region) => region.minX)),
    minY: Math.min(...regions.map((region) => region.minY)),
    maxX: Math.max(...regions.map((region) => region.maxX)),
    maxY: Math.max(...regions.map((region) => region.maxY)),
    pixelCount,
    centroid: [
      Math.round(regions.reduce((sum, region) => sum + region.centroid[0] * region.pixelCount, 0) / pixelCount),
      Math.round(regions.reduce((sum, region) => sum + region.centroid[1] * region.pixelCount, 0) / pixelCount),
    ],
  };
}

function detectSelectableFloorBands(regions) {
  if (explicitIdDefinitions) return null;
  const intactUpperBands = regions.slice(0, 13).map((region) => combineRegions([region]));
  const expectedLastColor = intactUpperBands[12]?.colorClass === 1 ? 2 : 1;
  const fragmentedLastBand = combineRegions(regions.slice(13).filter((region) => region.colorClass === expectedLastColor));
  return fragmentedLastBand ? [...intactUpperBands, fragmentedLastBand] : intactUpperBands;
}

function regionForLevel(regions, floorBands, level) {
  if (explicitIdDefinitions) {
    const definition = explicitIdDefinitions.find((entry) => entry.level === level);
    const region = regions
      .filter((region) => region.colorClass === definition?.colorClass)
      .sort((a, b) => b.pixelCount - a.pixelCount)[0];
    return region ? combineRegions([region]) : null;
  }
  const index = 16 - level;
  return floorBands[index];
}

async function writeAlphaMask(labels, width, height, region, output) {
  const pad = 2;
  const left = Math.max(0, region.minX - pad);
  const top = Math.max(0, region.minY - pad);
  const right = Math.min(width - 1, region.maxX + pad);
  const bottom = Math.min(height - 1, region.maxY + pad);
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const pixels = Buffer.alloc(cropWidth * cropHeight * 4);
  const includedComponents = new Uint8Array(256);
  for (const componentId of region.componentIds) includedComponents[componentId] = 1;
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceY = top + y;
    for (let x = 0; x < cropWidth; x += 1) {
      const sourceX = left + x;
      const sourceIndex = sourceY * width + sourceX;
      if (!includedComponents[labels[sourceIndex]]) continue;
      const outIndex = (y * cropWidth + x) * 4;
      pixels[outIndex] = 255;
      pixels[outIndex + 1] = 255;
      pixels[outIndex + 2] = 255;
      pixels[outIndex + 3] = 255;
    }
  }
  await sharp(pixels, { raw: { width: cropWidth, height: cropHeight, channels: 4 } })
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toFile(output);
  return [left, top, cropWidth, cropHeight];
}

async function processMask(frameIndex, maskName) {
  const source = path.join(sourceDir, maskName);
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const classes = classifyPixels(data, info.channels);
  const { regions, labels } = findRegions(classes, info.width, info.height);
  const floorBands = detectSelectableFloorBands(regions);
  if (!explicitIdDefinitions && floorBands.length !== selectableLevels.length) {
    warnings.push(`Frame ${frameIndex + 1}: expected ${selectableLevels.length} selectable floor bands, found ${floorBands.length}.`);
  }
  const frameFolder = `frame_${String(frameIndex).padStart(3, '0')}`;
  const maskFolder = path.join(publicRoot, 'masks', frameFolder);
  await fs.mkdir(maskFolder, { recursive: true });
  const regionManifest = {};

  for (const level of selectableLevels) {
    const region = regionForLevel(regions, floorBands, level);
    if (!region) continue;
    const filename = `level_${String(level).padStart(2, '0')}.webp`;
    const bounds = await writeAlphaMask(labels, info.width, info.height, region, path.join(maskFolder, filename));
    regionManifest[String(level).padStart(2, '0')] = {
      level,
      bounds,
      centroid: region.centroid,
      pixelCount: region.pixelCount,
      componentCount: region.componentIds.length,
      alphaMask: maskAssetUrl('masks', frameFolder, filename),
    };
  }

  const hitWidth = 240;
  const hitHeight = Math.round(hitWidth * info.height / info.width);
  const hitPixels = Buffer.alloc(hitWidth * hitHeight * 4);
  const mapped = selectableLevels
    .map((level) => ({ level, region: regionForLevel(regions, floorBands, level) }))
    .filter(({ region }) => region);
  const componentLevels = new Uint8Array(regions.length + 1);
  for (const { level, region } of mapped) {
    for (const componentId of region.componentIds) componentLevels[componentId] = level;
  }
  for (let y = 0; y < hitHeight; y += 1) {
    const sourceY = Math.min(info.height - 1, Math.floor((y + 0.5) * info.height / hitHeight));
    for (let x = 0; x < hitWidth; x += 1) {
      const sourceX = Math.min(info.width - 1, Math.floor((x + 0.5) * info.width / hitWidth));
      const sourceIndex = sourceY * info.width + sourceX;
      const level = componentLevels[labels[sourceIndex]];
      if (!level) continue;
      const out = (y * hitWidth + x) * 4;
      hitPixels[out] = level;
      hitPixels[out + 1] = 71;
      hitPixels[out + 2] = 1;
      hitPixels[out + 3] = 255;
    }
  }
  const hitName = 'hit-map.webp';
  await sharp(hitPixels, { raw: { width: hitWidth, height: hitHeight, channels: 4 } })
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toFile(path.join(maskFolder, hitName));

  return {
    sourceWidth: info.width,
    sourceHeight: info.height,
    hitMap: maskAssetUrl('masks', frameFolder, hitName),
    hitMapWidth: hitWidth,
    hitMapHeight: hitHeight,
    regions: regionManifest,
    detectedBandCount: floorBands?.length ?? mapped.length,
    detectedComponentCount: regions.length,
  };
}

async function processBeauty(frameIndex, name) {
  const id = String(frameIndex).padStart(3, '0');
  const source = path.join(sourceDir, name);
  const mobileWebp = path.join(publicRoot, 'beauty', 'mobile', `frame_${id}.webp`);
  const mobileJpeg = path.join(publicRoot, 'beauty', 'mobile', `frame_${id}.jpg`);
  const desktopWebp = path.join(publicRoot, 'beauty', 'desktop', `frame_${id}.webp`);
  const desktopJpeg = path.join(publicRoot, 'beauty', 'desktop', `frame_${id}.jpg`);
  const hiWebp = path.join(publicRoot, 'beauty', 'hi', `frame_${id}.webp`);
  const pipeline = sharp(source).rotate();
  await Promise.all([
    pipeline.clone().resize({ width: 800, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(mobileWebp),
    pipeline.clone().resize({ width: 800, height: 1000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(mobileJpeg),
    pipeline.clone().resize({ width: 1200, height: 1500, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(desktopWebp),
    pipeline.clone().resize({ width: 1200, height: 1500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(desktopJpeg),
    pipeline.clone().resize({ width: 2400, height: 3000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toFile(hiWebp),
  ]);
  return {
    beautySmall: assetUrl('beauty', 'mobile', `frame_${id}.webp`),
    beautySmallFallback: assetUrl('beauty', 'mobile', `frame_${id}.jpg`),
    beautyMedium: assetUrl('beauty', 'desktop', `frame_${id}.webp`),
    beautyMediumFallback: assetUrl('beauty', 'desktop', `frame_${id}.jpg`),
    beautyHi: assetUrl('beauty', 'hi', `frame_${id}.webp`),
  };
}

const frames = new Array(pairCount);
const concurrency = 2;
let cursor = 0;
async function worker() {
  while (cursor < pairCount) {
    const index = cursor++;
    console.log(`Processing frame ${index + 1}/${pairCount}: ${beautyFiles[index]} + ${maskFiles[index]}`);
    const [beauty, mask] = await Promise.all([
      processBeauty(index, beautyFiles[index]),
      processMask(index, maskFiles[index]),
    ]);
    frames[index] = { id: index, angle: angles[index], ...beauty, ...mask };
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

const plans = {};
for (const candidate of planCandidates) {
  const levelMatch = candidate.match(planLevelPattern);
  if (!levelMatch) continue;
  const level = levelMatch[1].padStart(2, '0');
  const extension = path.extname(candidate).toLowerCase();
  const targetName = `level_${level}${extension}`;
  await fs.copyFile(path.join(sourceDir, candidate), path.join(publicRoot, 'plans', targetName));
  plans[level] = assetUrl('plans', targetName);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceDimensions: { width: sourceMetadata[0].width, height: sourceMetadata[0].height },
  frames,
  frontFrame,
  levels: selectableLevels.map((level) => String(level).padStart(2, '0')),
  plans,
  warnings,
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

async function folderBytes(folder) {
  const names = await fs.readdir(folder, { recursive: true });
  const sizes = await Promise.all(names.map(async (name) => {
    const target = path.join(folder, name);
    const stat = await fs.stat(target);
    return stat.isFile() ? stat.size : 0;
  }));
  return sizes.reduce((sum, size) => sum + size, 0);
}

const mobileWebpBytes = (await Promise.all(frames.map((frame) => fileSize(path.join(root, 'public', frame.beautySmall))))).reduce((a, b) => a + b, 0);
const desktopWebpBytes = (await Promise.all(frames.map((frame) => fileSize(path.join(root, 'public', frame.beautyMedium))))).reduce((a, b) => a + b, 0);
const highResBytes = await folderBytes(path.join(publicRoot, 'beauty', 'hi'));
const masksBytes = await folderBytes(path.join(publicRoot, 'masks'));
if (mobileWebpBytes > 12 * 1024 * 1024) warnings.push('Hard warning: mobile WebP sequence exceeds 12 MB.');
if (desktopWebpBytes > 12 * 1024 * 1024) warnings.push('Hard warning: desktop WebP sequence exceeds 12 MB.');

const report = {
  beautyFrames: beautyFiles.length,
  pairedMasks: pairCount,
  detectedAngles: angles,
  sourceImageDimensions: distinctDimensions,
  generatedMobileSequenceBytes: mobileWebpBytes,
  generatedDesktopSequenceBytes: desktopWebpBytes,
  totalMasksBytes: masksBytes,
  highResolutionBytes: highResBytes,
  detectedLevels: manifest.levels,
  detectedBandsPerFrame: frames.map((frame) => frame.detectedBandCount),
  detectedComponentsPerFrame: frames.map((frame) => frame.detectedComponentCount),
  missingFrameMaskPairs: beautyFiles.slice(pairCount).concat(maskFiles.slice(pairCount)),
  missingFloorPlans: manifest.levels.filter((level) => !plans[level]),
  warnings,
};
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log('\nAsset build report');
console.log(`Beauty frames: ${report.beautyFrames}`);
console.log(`Paired masks: ${report.pairedMasks}`);
console.log(`Angles: ${angles.join(', ')}`);
console.log(`Source dimensions: ${distinctDimensions.join(', ')}`);
console.log(`Mobile WebP sequence: ${prettyBytes(mobileWebpBytes)}`);
console.log(`Desktop WebP sequence: ${prettyBytes(desktopWebpBytes)}`);
console.log(`Masks: ${prettyBytes(masksBytes)}`);
console.log(`High resolution: ${prettyBytes(highResBytes)}`);
console.log(`Detected levels: ${manifest.levels.join(', ')}`);
console.log(`Missing pairs: ${report.missingFrameMaskPairs.length || 'none'}`);
console.log(`Missing plans: ${report.missingFloorPlans.join(', ') || 'none'}`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
