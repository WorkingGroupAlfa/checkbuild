import { describe, expect, it } from 'vitest';
import { decodeHitPixel } from '../src/lib/maskHitTest';

describe('generated hit-map color decoding', () => {
  it('returns the encoded level', () => {
    expect(decodeHitPixel(new Uint8ClampedArray([10, 71, 1, 255]))).toBe(10);
  });

  it('ignores transparent and unrelated pixels', () => {
    expect(decodeHitPixel(new Uint8ClampedArray([10, 71, 1, 0]))).toBeNull();
    expect(decodeHitPixel(new Uint8ClampedArray([10, 70, 1, 255]))).toBeNull();
  });
});
