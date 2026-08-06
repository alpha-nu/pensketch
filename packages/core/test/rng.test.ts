import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/index';

// Written out rather than compared against a second run of the same code: the
// whole package descends from this sequence, so a generator that was changed
// but still looked random would pass any self-referential check.
const SEED_1_FIRST_FIVE = [
  0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
  0.9810509674716741, 0.9683778982143849,
];

const take = (rng: () => number, count: number): number[] =>
  Array.from({ length: count }, () => rng());

describe('mulberry32', () => {
  it('replays a known sequence for a known seed', () => {
    expect(take(mulberry32(1), 5)).toEqual(SEED_1_FIRST_FIVE);
  });

  it('gives two generators on the same seed the same sequence', () => {
    expect(take(mulberry32(11), 20)).toEqual(take(mulberry32(11), 20));
  });

  it('diverges immediately on a neighbouring seed', () => {
    expect(mulberry32(7)()).not.toBe(mulberry32(8)());
  });

  it('stays within the unit interval', () => {
    const values = take(mulberry32(99), 500);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});
