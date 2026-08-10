import { describe, expect, it } from 'vitest';
import { AMP, ARC_STEPS, WIDTH } from '../src/constants';
import { draw } from '../src/draw';
import {
  boxToSegment,
  edgePath,
  INFLATE,
  intersects,
  labelBox,
  pointToSegment,
} from '../src/geometry';
import { loopPoints } from '../src/sample';
import type { DiagramEdge, DiagramNode, Point, Side } from '../src/types';
import { nth } from './helpers';

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

// A loop's geometry lives in `sample.ts` rather than in `geometry.ts`, which
// imports `anchor` and so cannot be imported back by the renderer that draws
// one. Where the points land is this file's question either way.
describe('loopPoints', () => {
  const SIDES: Side[] = ['r', 'l', 't', 'b'];
  // The node behind these numbers is the state-machine example's `pin`: its
  // right edge is x = 250 and its vertical middle is y = 196.
  const MID: Point = [250, 196];
  const OUT = 60;
  const SPAN = 24;
  const loop = (side: Side) => loopPoints(MID, side, OUT, SPAN);

  const first = (side: Side) => nth(loop(side), 0);
  const last = (side: Side) => {
    const pts = loop(side);
    return nth(pts, pts.length - 1);
  };

  // Which way each side's loop bulges, and which way its two anchors run
  // along the side. Written out rather than derived: these four pairs are the
  // claim the arc table is supposed to satisfy, and deriving them from the
  // same reasoning that built the table would test nothing.
  const OUTWARD: Record<Side, Point> = {
    r: [1, 0],
    l: [-1, 0],
    t: [0, -1],
    b: [0, 1],
  };
  const ALONG: Record<Side, Point> = {
    r: [0, 1],
    l: [0, 1],
    t: [1, 0],
    b: [1, 0],
  };

  // By hand off the drawing: a right-side loop leaves 12 px above the side's
  // midpoint and returns 12 px below it. Note that `r` and `l` share both
  // anchors, as do `t` and `b` - the pair is a side's chord, and which way the
  // arc bulges off it is asserted separately, below.
  const ENDS: Record<Side, [Point, Point]> = {
    r: [
      [250, 184],
      [250, 208],
    ],
    l: [
      [250, 184],
      [250, 208],
    ],
    t: [
      [238, 196],
      [262, 196],
    ],
    b: [
      [238, 196],
      [262, 196],
    ],
  };

  it('leaves one anchor and returns to the other, for every side', () => {
    for (const side of SIDES)
      expect([first(side), last(side)]).toEqual(ENDS[side]);
  });

  // One statement of the whole anchor rule: each anchor is the side's midpoint
  // displaced half a SPAN along the side and by nothing at all across it. A
  // tolerance would let a loop start a hair inside the node or in the gap
  // beside it, and none is needed - but the margin is narrower than it looks.
  // The largest stray term is the l row's returning anchor, 60 * cos(-3 * PI /
  // 2) at 1.10e-14, against half the gap between representable numbers near
  // 250, which is 1.42e-14. A factor of 1.29, not the order of magnitude a
  // reader would assume, and a property of these coordinates rather than of
  // the code: at LOOP_OUT 78 the l anchor stops landing exactly, t and b at
  // 117, r at 233. A failure here means the numbers above moved.
  it('puts both anchors on the side, SPAN apart and centred on the midpoint', () => {
    for (const side of SIDES) {
      const [ax, ay] = ALONG[side];
      const from = (d: number): Point => [MID[0] + ax * d, MID[1] + ay * d];

      // It leaves the upper - or left - anchor and returns to the lower one,
      // which is the ordering that makes every side read the same way.
      expect(first(side)).toEqual(from(-SPAN / 2));
      expect(last(side)).toEqual(from(SPAN / 2));
    }
  });

  // The assertion that separates `r` from `l` and `t` from `b`. Each pair
  // shares both anchors, so every expectation above passes unchanged if two
  // rows of the table are swapped or a sweep runs the wrong way round.
  it('bulges to the outward side and never crosses back through it', () => {
    for (const side of SIDES) {
      const [ox, oy] = OUTWARD[side];
      const reach = loop(side).map(
        ([x, y]) => (x - MID[0]) * ox + (y - MID[1]) * oy,
      );
      for (const d of reach) expect(d).toBeGreaterThanOrEqual(0);
      // The anchors are the only points on the side; a loop that stayed flat
      // would satisfy the line above and nothing else.
      expect(Math.max(...reach)).toBeGreaterThan(0);
    }
  });

  it('reaches exactly OUT from the side, and no point further', () => {
    for (const side of SIDES) {
      const [ox, oy] = OUTWARD[side];
      const [ax, ay] = ALONG[side];

      for (const [x, y] of loop(side)) {
        const reach = (x - MID[0]) * ox + (y - MID[1]) * oy;
        const along = (x - MID[0]) * ax + (y - MID[1]) * ay;
        expect(reach).toBeLessThanOrEqual(OUT);
        // Every point sits on the ellipse whose radius away from the side is
        // OUT and whose radius along it is half of SPAN. That pins the reach
        // at the apex without needing a sample there: the ellipse is furthest
        // from the side where it crosses the midpoint, and that distance is
        // OUT by construction. Swapping the two radii moves every point off
        // this curve.
        expect((reach / OUT) ** 2 + (along / (SPAN / 2)) ** 2).toBeCloseTo(1);
      }
    }
  });

  it('samples the loop at the density every other curve is drawn at', () => {
    for (const side of SIDES) {
      // A half turn, so half of ARC_STEPS chords and one more vertex than
      // that. The chord rule is the slacker of the two here - 60 px of radius
      // over PI radians asks for 8 chords of SEG_LEN, against the angle
      // rule's 13 - so this count is the angle rule's alone.
      expect(loop(side)).toHaveLength(ARC_STEPS / 2 + 1);

      // Which leaves the apex between two samples rather than on one: 13
      // chords is odd, so the middle of the sweep falls half a chord -
      // PI / ARC_STEPS - from the nearest vertex either side of it. That is
      // 60 * cos(PI / 26) = 59.5625 out, and it is why the test above asserts
      // the curve's reach rather than any one point's.
      const [ox, oy] = OUTWARD[side];
      const reach = loop(side).map(
        ([x, y]) => (x - MID[0]) * ox + (y - MID[1]) * oy,
      );
      expect(Math.max(...reach)).toBeCloseTo(
        OUT * Math.cos(Math.PI / ARC_STEPS),
      );
    }
  });

  // Every assertion above is at one midpoint, one `out` and one `span`, and
  // three of the four arguments can be ignored entirely without any of them
  // noticing: hard-coding MID, or deriving the reach from `span`, both give
  // the right answer for these numbers alone. A loop has to follow the node
  // it belongs to, which is the reason this takes a point at all.
  it('follows its midpoint, and its two radii, wherever they are', () => {
    const mid: Point = [-40, 12.5];
    const out = 17;
    const span = 90;
    const points = loopPoints(mid, 'r', out, span);

    const [first, last] = [nth(points, 0), nth(points, points.length - 1)];
    expect(first).toEqual([mid[0], mid[1] - span / 2]);
    expect(last).toEqual([mid[0], mid[1] + span / 2]);
    // Reach and span are independent: here the loop is shallower than it is
    // tall, the opposite of the defaults, so a rule deriving one from the
    // other lands somewhere else entirely.
    expect(Math.max(...points.map(([x]) => x - mid[0]))).toBeCloseTo(
      out * Math.cos(Math.PI / ARC_STEPS),
    );
  });
});

describe('boxToSegment', () => {
  const BOX = { x: 0, y: 0, w: 10, h: 10 };

  it('is zero for a segment straight through the box', () => {
    expect(boxToSegment(BOX, [-5, 5], [15, 5])).toBe(0);
  });

  it('is zero for a segment that ends inside the box', () => {
    expect(boxToSegment(BOX, [5, 5], [50, 50])).toBe(0);
  });

  it('measures a parallel run to the nearest side', () => {
    expect(boxToSegment(BOX, [0, -4], [10, -4])).toBe(4);
    expect(boxToSegment(BOX, [15, 0], [15, 10])).toBe(5);
  });

  // Both ends past the corner: the nearest pair is the box's corner against
  // the segment, which neither endpoint-to-box distance would find.
  it('measures from a corner when the segment passes beyond one', () => {
    expect(boxToSegment(BOX, [14, 0], [24, 0])).toBe(4);
    expect(boxToSegment(BOX, [13, -4], [13, 14])).toBe(3);
  });

  // A vertical segment that never reaches the box's rows: the answer is to
  // the segment's own end, not to the infinite line.
  it('measures to the end of a segment stopping short', () => {
    expect(boxToSegment(BOX, [0, -8], [0, -4])).toBe(4);
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
