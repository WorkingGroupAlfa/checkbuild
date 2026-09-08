import { describe, expect, it } from 'vitest';
import { interactiveSpaces, spaceByLevel, spaces } from '../src/data/spaces';

describe('floor data', () => {
  it('keeps all fourteen facade levels interactive', () => {
    const expected = Array.from({ length: 14 }, (_, index) => 16 - index);
    expect(interactiveSpaces.map(({ level }) => level)).toEqual(expected);
    expect([...spaceByLevel.keys()]).toEqual(expected);
  });

  it('keeps the supplied seven-level availability index unchanged', () => {
    expect(spaces.map(({ level }) => level)).toEqual([16, 15, 14, 12, 10, 9, 8]);
  });

  it('provides a selectable unit preview for every currently offered floor', () => {
    for (const space of spaces.filter(({ status }) => status === 'available' || status === 'under-offer')) {
      const selectable = space.suites?.filter(({ status }) => status === 'available' || status === 'under-offer') ?? [];
      expect(selectable.length, `Level ${space.displayLevel}`).toBeGreaterThan(0);
      for (const unit of selectable) {
        expect(unit.area).toMatch(/m²$/);
        expect(unit.description).toBeTruthy();
      }
    }
  });
});
