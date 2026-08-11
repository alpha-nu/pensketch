import { describe, expect, it } from 'vitest';
import { BRACE_DEPTH, BRACE_R } from '../src/constants';
import { pen } from '../src/pen';
import { bracePoints } from '../src/sample';
import type { DiagramBrace, Point } from '../src/types';
import { makeSvg, nth, pathsOf } from './helpers';

// The span design.md D5 recorded its prototype against, and the numbers it
// recorded. They are asserted here rather than described: a design document
// that says what the geometry will be, and geometry that does something else,
// is two designs with one name, and this is the cheapest place to find out.
const SPAN: DiagramBrace = {
  from: [200, 40],
  to: [200, 240],
};

const extent = (points: Point[], axis: 0 | 1) => [
  Math.min(...points.map((p) => p[axis])),
  Math.max(...points.map((p) => p[axis])),
];

describe('bracePoints()', () => {
  it('reproduces the numbers design.md D5 recorded', () => {
    const points = bracePoints(SPAN);
    expect(extent(points, 0)).toEqual([174, 200]);
    expect(extent(points, 1)).toEqual([40, 240]);
    // The tip is the one point at the full depth, and it is the vertical
    // middle. Travel is +y, so right of travel is -x and the default depth of
    // 26 puts it at x = 174.
    const tip = points.filter(([x]) => x === 174);
    expect(tip).toEqual([[174, 140]]);
  });

  // Not "some points": four, and the same four a caller would write by hand.
  // A bracket that sampled an arc of radius zero would still look right and
  // would cost a caller who counts points the difference.
  it('draws a square bracket as four points and no curve', () => {
    expect(bracePoints({ ...SPAN, kind: 'square' })).toEqual([
      [200, 40],
      [174, 40],
      [174, 240],
      [200, 240],
    ]);
  });

  it('flips the tip to the other side when depth is negative', () => {
    const right = bracePoints({ ...SPAN, depth: BRACE_DEPTH });
    const left = bracePoints({ ...SPAN, depth: -BRACE_DEPTH });
    expect(extent(right, 0)).toEqual([174, 200]);
    expect(extent(left, 0)).toEqual([200, 226]);
    // Mirrored about the span rather than merely on the other side of it: the
    // sign is one minus in the caller's data, so the shape has to be the same
    // shape or the field is two fields.
    expect(left.map(([x, y]) => [400 - x, y])).toEqual(right);
  });

  // Rotation invariance, which is what "perpendicular to the span" has to mean
  // if `depth` is to carry the same meaning on a diagonal as on an axis. The
  // tip sits `depth` from the midpoint of the span, measured square to it.
  it('measures depth square to the span, whichever way the span lies', () => {
    // A 3-4-5 span, so the unit vector along it is exact in binary and the
    // arithmetic below is the geometry rather than a tolerance.
    const points = bracePoints({ from: [0, 0], to: [300, 400] });
    // Not the point furthest from the midpoint - on a 500 px span that is an
    // end, 250 away, and it would be the answer whatever depth did. The tip is
    // the point furthest from the span's own line, which is what depth means.
    const off = ([x, y]: Point) => x * -0.8 + y * 0.6;
    const tip = points.reduce((a, p) => (off(p) > off(a) ? p : a));
    expect(off(tip)).toBeCloseTo(BRACE_DEPTH, 10);
    expect(tip[0]).toBeCloseTo(150 - BRACE_DEPTH * 0.8, 10);
    expect(tip[1]).toBeCloseTo(200 + BRACE_DEPTH * 0.6, 10);
  });

  // The shallow case, where the corner is bigger than the whole depth. Left
  // alone it drew every brace shallower than BRACE_R at BRACE_R instead - the
  // caller's number replaced by one of this library's, in a library whose
  // caller cannot see the result.
  it.each([2, 8, 13, 26, 40])('draws the depth asked for: %i', (depth) => {
    const xs = bracePoints({ ...SPAN, depth }).map(([x]) => x);
    expect(200 - Math.min(...xs)).toBeCloseTo(depth, 10);
    expect(Math.max(...xs)).toBeCloseTo(200, 10);
  });

  it('grows the tip rather than the corners when depth grows', () => {
    // The two corners at the ends keep BRACE_R whatever the depth, so the runs
    // they turn onto sit at the same offset from the span and only the tip's
    // pair grows. Four points sit at that offset: where each run begins and
    // where each ends.
    for (const depth of [BRACE_DEPTH, BRACE_DEPTH * 3]) {
      const off = bracePoints({ ...SPAN, depth }).map(([x]) => 200 - x);
      expect(Math.max(...off)).toBeCloseTo(depth, 10);
      expect(off.filter((m) => Math.abs(m - BRACE_R) < 1e-9)).toHaveLength(4);
    }
  });

  // D3, and the reason this is one function rather than six pen calls. Six
  // strokes emit twelve paths, so this fails on the implementation it exists
  // to rule out - checked by drawing one, not by reasoning about it.
  it('goes through one stroke, so a whole brace is two paths', () => {
    const one = makeSvg();
    pen(one, { seed: 3 }).stroke(bracePoints(SPAN));
    expect(pathsOf(one)).toHaveLength(2);

    const six = makeSvg();
    const p = pen(six, { seed: 3 });
    const points = bracePoints(SPAN);
    // Cut anywhere: any split into separate strokes doubles the path count,
    // and the shared point is drawn twice at two different jitters.
    for (let i = 0; i < 6; i++)
      p.stroke(points.slice(i * 5, i * 5 + 6) as Point[]);
    expect(pathsOf(six)).toHaveLength(12);

    // And the line really is continuous: no gap between consecutive points
    // wider than the chords the sampler is allowed to draw. A joint that
    // parted would show up here as one long leg rather than as a wobble.
    const drawn = pathsOf(one);
    const d = nth(drawn, 0).getAttribute('d') ?? '';
    expect(d.startsWith('M')).toBe(true);
  });
});
