import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';

it('ships the hero MP4 index before its unchanged video payload for progressive loading', () => {
  const bytes = fs.readFileSync('public/fortis/470-collins/hero-scroll.mp4');
  const boxes: { type: string; offset: number; size: number; header: number }[] = [];
  for (let offset = 0; offset < bytes.length;) {
    let size = bytes.readUInt32BE(offset);
    const header = size === 1 ? 16 : 8;
    if (size === 1) size = Number(bytes.readBigUInt64BE(offset + 8));
    expect(size).toBeGreaterThanOrEqual(header);
    expect(offset + size).toBeLessThanOrEqual(bytes.length);
    boxes.push({ type: bytes.toString('ascii', offset + 4, offset + 8), offset, size, header });
    offset += size;
  }
  expect(boxes.map(box => box.type)).toEqual(['ftyp', 'moov', 'mdat']);
  const media = boxes[2];
  const payload = bytes.subarray(media.offset + media.header, media.offset + media.size);
  // Original media payload: the fast-start remux must not re-encode any frames.
  expect(createHash('sha256').update(payload).digest('hex')).toBe('48e6316e92c8bdd1413bb71214380c6fcccf8a053989447d71e1eb64bf306078');
});