import { describe, expect, it } from 'vitest';
import { AMP, WIDTH } from '../src/constants';
import { draw } from '../src/draw';
import {
  edgePath,
  INFLATE,
  intersects,
  labelBox,
  pointToSegment,
} from '../src/geometry';
import type { DiagramEdge, DiagramNode, Point } from '../src/types';

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

describe('INFLATE', () => {
  // Two assertions on purpose. The first fails if the checker ever stops
  // tracking the constants - a hard-coded 2.1 left behind by a change to
  // either one. The second fails if the constants move at all, which is what
  // forces a look at the documentation quoting this number, and at whether
  // every clearance in this repository's own diagrams still holds.
  it('tracks the constants it comes from, and is 2.1 with the current ones', () => {
    expect(INFLATE).toBe(AMP / 2 + WIDTH / 2);
    expect(INFLATE).toBeCloseTo(2.1);
  });
});

describe('edgePath', () => {
  // Anchors by hand: 'a' right is (40 + 160, 60 + 40 / 2); 'b' top is
  // (300 + 100 / 2, 200).
  const NODES: DiagramNode[] = [
    { id: 'a', shape: 'box', x: 40, y: 60, w: 160, h: 40 },
    { id: 'b', shape: 'box', x: 300, y: 200, w: 100, h: 60 },
  ];
  const BY_ID = new Map(NODES.map((n) => [n.id, n]));
  const EDGE: DiagramEdge = {
    from: ['a', 'r'],
    to: ['b', 't'],
    via: [
      [250, 80],
      [250, 140],
    ],
  };
  const IDEAL: Point[] = [
    [200, 80],
    [250, 80],
    [250, 140],
    [350, 200],
  ];

  it('is the anchor it leaves, the via points in order, and the anchor it lands on', () => {
    expect(edgePath(EDGE, BY_ID)).toEqual(IDEAL);
  });

  it('is just the two anchors when no corners are given', () => {
    expect(edgePath({ from: ['a', 'r'], to: ['b', 't'] }, BY_ID)).toEqual([
      [200, 80],
      [350, 200],
    ]);
  });

  it('says nothing about an edge naming a node that does not exist', () => {
    expect(
      edgePath({ from: ['a', 'r'], to: ['ghost', 'l'] }, BY_ID),
    ).toBeNull();
    expect(
      edgePath({ from: ['ghost', 'r'], to: ['b', 'l'] }, BY_ID),
    ).toBeNull();
  });

  // The anti-drift test. The checker measures a line it computes itself; if
  // `draw` ever assembled a different one - a routing point, a changed anchor
  // - every clearance the checker reports would be about a line nobody draws.
  //
  // The pen jitters x and y independently by up to AMP / 2 each, so a point
  // can land AMP / 2 * sqrt(2) away and no further. Leg ends are damped to
  // 40% of that. The bound is under 2px against a drift that would be tens.
  it('names the same points the renderer draws through', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    draw(svg, { nodes: NODES, edges: [EDGE] });

    const d = svg.querySelector('path')?.getAttribute('d') ?? '';
    const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const drawn: Point[] = [];
    for (let i = 0; i < numbers.length; i += 2)
      drawn.push([numbers[i] as number, numbers[i + 1] as number]);
    expect(drawn.length).toBeGreaterThan(IDEAL.length);

    for (const [x, y] of IDEAL) {
      const nearest = Math.min(
        ...drawn.map(([dx, dy]) => Math.hypot(dx - x, dy - y)),
      );
      expect(nearest).toBeLessThanOrEqual((AMP / 2) * Math.SQRT2);
    }
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
