import { describe, expect, it } from 'vitest';
import { ARC_MIN_CHORD, BRACE_DEPTH, BRACE_R } from '../src/constants';
import type { DiagramBrace, Point } from '../src/index';
import { pen } from '../src/pen';
import { arcPoints, bracePoints, carriesFace, hatchClip } from '../src/sample';
import { makeSvg, pathsOf } from './helpers';

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
  //
  // The path count is the whole of the continuity test, and that is not a gap
  // in it. Within one `stroke`, `pass` cuts every leg to SEG_LEN and carries
  // the last point of each into the next, so the line cannot part; across two
  // it re-jitters the shared point and reads as a break at a tangent join.
  // Measuring the leg lengths in the emitted `d` would assert something `pass`
  // guarantees for every stroke ever drawn, which is a test that cannot fail.
  it('goes through one stroke, so a whole brace is two paths', () => {
    const one = makeSvg();
    pen(one, { seed: 3 }).stroke(bracePoints(SPAN));
    expect(pathsOf(one)).toHaveLength(2);

    const six = makeSvg();
    const p = pen(six, { seed: 3 });
    const points = bracePoints(SPAN);
    // Cut into six wherever the list happens to end, sharing a point at each
    // seam: any split into separate strokes doubles the path count, and the
    // shared point is drawn twice at two different jitters.
    const cut = Math.floor((points.length - 1) / 6);
    for (let i = 0; i < 6; i++)
      p.stroke(points.slice(i * cut, i * cut + cut + 1) as Point[]);
    expect(pathsOf(six)).toHaveLength(12);
  });
});

// The rule `draw` resolves a depth behind, and the one the checker has to
// sweep a box behind. Stated here because it is the shared one: a second copy
// of it in the checker is the copy that drifts, and nothing but a test says
// so until the day the two disagree.
// `shape` is optional on a node, and `draw` defaults it to `'box'` at three
// call sites. Two of those three - into `carriesFace` and into `hatchClip` -
// are required by the signatures and change no byte today, because both
// functions single out `'pill'` and `'diamond'` and treat every other string
// alike. That is the property the byte-identity of an omitted shape actually
// rests on, and it is not visible from either call site, so it is pinned
// here: the day one of them grows an `=== 'box'` branch this fails, and the
// two defaults stop being belt and start being load-bearing.
describe('the shapes neither primitive singles out', () => {
  const w = 60;
  const h = 40;

  it('answers for a box exactly as it does for any other unnamed shape', () => {
    for (const other of ['rhombus', 'group', 'BOX', '']) {
      expect(carriesFace(other, w, h)).toBe(carriesFace('box', w, h));
      expect(hatchClip(other, 0, 0, w, h)).toEqual(
        hatchClip('box', 0, 0, w, h),
      );
    }
  });

  it('does single out the two it is supposed to', () => {
    expect(hatchClip('pill', 0, 0, w, h)).not.toEqual(
      hatchClip('box', 0, 0, w, h),
    );
    expect(hatchClip('diamond', 0, 0, w, h)).not.toEqual(
      hatchClip('box', 0, 0, w, h),
    );
    // A pill under the chord bound is the one size where `carriesFace` parts
    // company with the box answer.
    expect(carriesFace('pill', 10, 8)).toBe(false);
    expect(carriesFace('box', 10, 8)).toBe(true);
  });
});

describe('carriesFace()', () => {
  it('refuses an outline that encloses no area, on every shape', () => {
    for (const shape of ['box', 'pill', 'diamond']) {
      expect(carriesFace(shape, 0, 40)).toBe(false);
      expect(carriesFace(shape, 60, 0)).toBe(false);
      // Not a number is not an area either, which is where the pen puts it:
      // `Math.sign(NaN)` is `NaN` and no segment dots positive with the
      // extrusion vector.
      expect(carriesFace(shape, Number.NaN, 40)).toBe(false);
    }
  });

  it('accepts a mirrored dimension, because the pen draws those faces', () => {
    // A negative dimension flips the outline rather than emptying it: the
    // signed area comes back negative, `extrude` reads the winding off its
    // sign, and the faces are drawn. Asked as "is the area nought", never as
    // "is it positive" - rendered at -60 x 40 and 60 x -40, both slabs.
    for (const shape of ['box', 'pill', 'diamond']) {
      expect(carriesFace(shape, -60, 40)).toBe(true);
      expect(carriesFace(shape, 60, -40)).toBe(true);
      // Both at once is the case a node written from its far corner makes,
      // and the one that was wrong. With one dimension positive `Math.max`
      // in `arcPoints` still picked a positive radius, so the pill's
      // sampling survived by luck and only the far-corner spelling collapsed
      // it - which is why the two assertions above passed while a mirrored
      // 300 x 120 pill drew no faces at all.
      expect(carriesFace(shape, -60, -40)).toBe(true);
    }
  });

  // The bound is on the extent the outline covers, not on the numbers it was
  // written with. A pill written from its far corner traces the same ellipse
  // backwards, so it has the same chords and the same area, and it carries a
  // face exactly when its upright spelling does - at the boundary from either
  // side, on either axis, and at every ordinary size.
  //
  // This is asserted as a symmetry and not as an agreement with the pen,
  // because the pen agreed all along: `arcPoints` read `Math.max(rx, ry)` as
  // written, both radii came back negative, the run went negative and the
  // sweep collapsed to `MIN_STEPS` - two chords, one diameter, no area. The
  // predicate said no faces and the pen drew none, in perfect agreement and
  // both wrong, which is why a test comparing the two could never catch it.
  it('reads the pill bound off the extent, not the spelling', () => {
    const bound = (3 * ARC_MIN_CHORD) / Math.PI;
    const sizes: [number, number][] = [
      [8, 8],
      [10, 8],
      [11.45, 11.45],
      [11.9, 11.9],
      [bound - 1e-9, 4],
      [bound, 4],
      [4, bound],
      [150, 50],
      [300, 120],
    ];
    for (const shape of ['box', 'pill', 'diamond'])
      for (const [w, h] of sizes)
        expect([shape, w, h, carriesFace(shape, -w, -h)]).toEqual([
          shape,
          w,
          h,
          carriesFace(shape, w, h),
        ]);
  });

  // One level down, where the defect actually was. A negative radius traces
  // the same ellipse and must be cut into the same number of chords; read as
  // written it was cut into two, whatever its size.
  it('samples an arc of negative radii as finely as positive ones', () => {
    const full = (rx: number, ry: number) =>
      arcPoints(0, 0, rx, ry, 0, 2 * Math.PI).length;
    expect(full(-150, -60)).toBe(full(150, 60));
    expect(full(-150, -60)).toBeGreaterThan(3);
    // The floor is still a floor: a radius small enough to collapse the sweep
    // collapses it from either spelling.
    expect(full(-1, -1)).toBe(full(1, 1));
    expect(full(-1, -1)).toBe(3);
  });

  it('takes the pill at three chords of the sampling floor', () => {
    // `arcPoints` floors a full sweep at two chords, whose ends are one
    // diameter; the third is the first that encloses anything. A full sweep
    // reaches it when `max(w, h) * PI` covers three chords of ARC_MIN_CHORD -
    // 11.4592 px, and the bound is inclusive.
    const bound = (3 * ARC_MIN_CHORD) / Math.PI;
    expect(carriesFace('pill', bound, 4)).toBe(true);
    expect(carriesFace('pill', bound - 1e-9, 4)).toBe(false);
    // The larger dimension carries it, so this is not "both dimensions under
    // ARC_MIN_CHORD": a 1 x 11.46 pill has its third chord and an 11.45 x
    // 11.45 one has not.
    expect(carriesFace('pill', 4, bound)).toBe(true);
    expect(carriesFace('pill', 1, 11.46)).toBe(true);
    expect(carriesFace('pill', 11.45, 11.45)).toBe(false);
  });

  // The predicate has to answer where the ink is, not merely answer
  // consistently, so this asks the pen itself over the sweep the rule was
  // read off - the boundary on either side, both dimensions, the mirrored
  // case, the degenerate ones, and one ordinary size per shape. Nothing here
  // goes through `draw`: `draw` reads the predicate, so a render is the rule
  // agreeing with itself. A pen call is the outline.
  it('answers exactly where the pen draws faces', () => {
    const bound = (3 * ARC_MIN_CHORD) / Math.PI;
    const drawsFaces = (
      shape: 'box' | 'pill' | 'diamond',
      w: number,
      h: number,
    ) => {
      const paths = (opts?: { depth: number }) => {
        const svg = makeSvg();
        const p = pen(svg, { seed: 7 });
        const trace =
          shape === 'box' ? p.rect : shape === 'pill' ? p.pill : p.diamond;
        trace(40, 40, w, h, opts);
        return pathsOf(svg).length;
      };
      return paths({ depth: 12 }) > paths();
    };
    const sizes: [number, number][] = [
      [0, 40],
      [40, 0],
      [Number.NaN, 40],
      [-60, 40],
      [-60, -40],
      [-11.45, -11.45],
      [-150, -50],
      [10, 8],
      [8, 8],
      [11.45, 11.45],
      [11.9, 11.9],
      [bound - 1e-9, 4],
      [bound, 4],
      [4, bound],
      [150, 50],
    ];
    for (const shape of ['box', 'pill', 'diamond'] as const)
      for (const [w, h] of sizes)
        expect([shape, w, h, drawsFaces(shape, w, h)]).toEqual([
          shape,
          w,
          h,
          carriesFace(shape, w, h),
        ]);
  });

  it('takes a box and a diamond at any size at all', () => {
    // Four literal corners, no arc to collapse: the sizes that empty a pill's
    // outline leave these two enclosing an area.
    for (const shape of ['box', 'diamond'])
      for (const s of [0.001, 1, 8, 11.45, 150])
        expect(carriesFace(shape, s, s)).toBe(true);
  });
});
