import { describe, expect, it } from 'vitest';
import { intersects, labelBox, pointToSegment } from '../src/geometry';

// Every expectation here is worked out by hand from the rule it encodes. A
// test that recomputes the implementation's own arithmetic proves the code
// runs, not that it is right.
describe('labelBox', () => {
  // Three lines at size 10: the block is (3 - 1) * 10 * 1.28 + 10 = 35.6 tall
  // and, at 0.5 advance, "wide" (4 chars) makes it 4 * 10 * 0.5 = 20 across.
  const LINES = ['a', 'wide', 'x'];

  it('centres the block on y, because the baseline is the middle', () => {
    const box = labelBox(100, 50, LINES, 10, 'middle', 0.5);
    expect(box.h).toBeCloseTo(35.6);
    expect(box.y).toBeCloseTo(50 - 35.6 / 2);
  });

  it('takes its width from the longest line', () => {
    expect(labelBox(100, 50, LINES, 10, 'middle', 0.5).w).toBeCloseTo(20);
  });

  it('places x by the anchor', () => {
    expect(labelBox(100, 50, LINES, 10, 'start', 0.5).x).toBeCloseTo(100);
    expect(labelBox(100, 50, LINES, 10, 'middle', 0.5).x).toBeCloseTo(90);
    expect(labelBox(100, 50, LINES, 10, 'end', 0.5).x).toBeCloseTo(80);
  });

  // One line is the common case and the one an off-by-one in the line count
  // would break: height is exactly the font size, with no leading at all.
  it('gives a single line exactly its font size in height', () => {
    expect(labelBox(0, 0, ['one'], 13.5, 'middle', 0.55).h).toBe(13.5);
  });

  // Reachable from hand-authored data, and the answer that keeps every rule
  // quiet about text that draws nothing.
  it('gives no width to no lines', () => {
    expect(labelBox(0, 0, [], 10, 'middle', 0.5).w).toBe(0);
  });
});

describe('intersects', () => {
  const BOX = { x: 0, y: 0, w: 10, h: 10 };

  it('sees an overlapping corner', () => {
    expect(intersects(BOX, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('sees one box wholly inside another, either way round', () => {
    const inner = { x: 2, y: 2, w: 3, h: 3 };
    expect(intersects(BOX, inner)).toBe(true);
    expect(intersects(inner, BOX)).toBe(true);
  });

  // Flush is a placement, not a collision - and it is the case that decides
  // whether the comparison is < or <=.
  it('does not count boxes that only touch along an edge', () => {
    expect(intersects(BOX, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(intersects(BOX, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it('separates on either axis alone', () => {
    expect(intersects(BOX, { x: 20, y: 0, w: 5, h: 5 })).toBe(false);
    expect(intersects(BOX, { x: 0, y: 20, w: 5, h: 5 })).toBe(false);
  });
});

describe('pointToSegment', () => {
  const A: [number, number] = [0, 0];
  const B: [number, number] = [10, 0];

  it('drops a perpendicular when the foot lands on the segment', () => {
    expect(pointToSegment([4, 5], A, B)).toBe(5);
  });

  // 3-4-5 either side: past an end, the answer is the distance to that end,
  // not to the infinite line, which would say 4 in both cases.
  it('measures to the nearer end when the foot falls outside', () => {
    expect(pointToSegment([-3, 4], A, B)).toBe(5);
    expect(pointToSegment([13, -4], A, B)).toBe(5);
  });

  it('treats a zero-length segment as the point it collapses to', () => {
    expect(pointToSegment([2, 5], [2, 2], [2, 2])).toBe(3);
  });

  it('is zero on the segment itself', () => {
    expect(pointToSegment([7, 0], A, B)).toBe(0);
  });
});
