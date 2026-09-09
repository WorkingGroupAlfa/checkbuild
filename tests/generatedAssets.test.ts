import path from 'node:path';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sequenceManifest } from '../src/lib/assetManifest';

describe('generated sequence assets', () => {
  const localAssetPath = (url: string) => path.join(process.cwd(), 'public', url.split('?')[0]);

  it('uses content hashes for every resource served with immutable caching', async () => {
    for (const frame of sequenceManifest.frames) {
      const sources = [frame.beautySmall, frame.beautySmallFallback, frame.beautyMedium, frame.beautyMediumFallback, frame.beautyHi, frame.hitMap, ...Object.values(frame.regions).map(region => region.alphaMask)];
      for (const source of sources) {
        const hash = createHash('sha256').update(await fs.readFile(localAssetPath(source))).digest('hex').slice(0, 16);
        expect(source, source).toMatch(new RegExp('\\.' + hash + '\\.[a-z]+$'));
      }
    }
  });

  it('encodes every selectable floor, and no excluded floor, in every hit map', async () => {
    for (const frame of sequenceManifest.frames) {
      const hitMapPath = localAssetPath(frame.hitMap);
      const { data, info } = await sharp(hitMapPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const encodedLevels = new Set<number>();
      for (let pixel = 0; pixel < data.length; pixel += info.channels) {
        if (data[pixel + 1] === 71 && data[pixel + 2] === 1 && data[pixel + 3] > 0) encodedLevels.add(data[pixel]);
      }
      expect(encodedLevels, `frame ${frame.id}`).toEqual(new Set(sequenceManifest.levels.map(Number)));
    }
  });

  it('maps the fourteen upper floor bands and excludes the lowest band', () => {
    expect(sequenceManifest.levels).toEqual(['16', '15', '14', '13', '12', '11', '10', '09', '08', '07', '06', '05', '04', '03']);
    for (const frame of sequenceManifest.frames) {
      expect(new Set(Object.keys(frame.regions))).toEqual(new Set(sequenceManifest.levels));
      expect(frame.regions['03'].componentCount).toBeGreaterThanOrEqual(2);
      for (const level of sequenceManifest.levels.slice(0, -1)) expect(frame.regions[level].componentCount).toBe(1);
    }
  });

  it('has matching geometry metadata for every frame and selectable level', () => {
    expect(sequenceManifest.frames).toHaveLength(31);
    for (const frame of sequenceManifest.frames) {
      for (const level of sequenceManifest.levels) {
        const region = frame.regions[level];
        expect(region.bounds).toHaveLength(4);
        expect(region.pixelCount).toBeGreaterThan(3_000);
      }
    }
  });

  it('keeps all alpha masks limited to their mapped floor component groups', async () => {
    for (const frame of sequenceManifest.frames) {
      for (const level of sequenceManifest.levels) {
        const region = frame.regions[level];
        const maskPath = localAssetPath(region.alphaMask);
        const { data, info } = await sharp(maskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let opaquePixels = 0;
        for (let index = 3; index < data.length; index += info.channels) {
          if (data[index] > 0) opaquePixels += 1;
        }
        expect(opaquePixels, `frame ${frame.id}, Level ${level}`).toBe(region.pixelCount);
      }
    }
  }, 30_000);

  it('decodes every runtime beauty image and rejects blank derivatives', async () => {
    for (const frame of sequenceManifest.frames) {
      for (const source of [frame.beautySmall, frame.beautyMedium, frame.beautyHi]) {
        const imagePath = localAssetPath(source);
        const metadata = await sharp(imagePath).metadata();
        expect(metadata.width, source).toBeGreaterThanOrEqual(800);
        expect(metadata.height, source).toBeGreaterThanOrEqual(1000);
        const stats = await sharp(imagePath).resize(32, 40).stats();
        expect(stats.entropy, source).toBeGreaterThan(3);
        expect(stats.isOpaque, source).toBe(true);
      }
    }
  }, 30_000);
});
