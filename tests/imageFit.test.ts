import { describe, expect, it } from 'vitest';
import { getContainRect, pointerToSource } from '../src/lib/imageFit';

describe('image contain coordinate mapping', () => {
  it('accounts for horizontal letterboxing', () => {
    const contain = getContainRect(1000, 1000, 800, 1000);
    expect(contain).toEqual({ x: 100, y: 0, width: 800, height: 1000, scale: 1 });
    const domRect = { left: 20, top: 30 } as DOMRect;
    expect(pointerToSource(520, 530, domRect, contain, 800, 1000)).toEqual({ x: 400, y: 500 });
    expect(pointerToSource(50, 530, domRect, contain, 800, 1000)).toBeNull();
  });

  it('reverses a centroid-based zoom before mapping', () => {
    const contain = getContainRect(800, 1000, 800, 1000);
    const domRect = { left: 0, top: 0 } as DOMRect;
    const point = pointerToSource(560, 500, domRect, contain, 800, 1000, 1.6, [400, 500]);
    expect(point).toEqual({ x: 500, y: 500 });
  });
});
