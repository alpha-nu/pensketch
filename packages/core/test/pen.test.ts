import { describe, expect, it } from 'vitest';
import type {
  LabelOptions,
  PenOptions,
  Point,
  StrokeOptions,
} from '../src/index';
import { constants, defaultTheme, mulberry32, pen } from '../src/index';
import { arcPoints } from '../src/sample';
import { makeSvg, nth, pathsOf, pointsOf, tagsOf, textsOf } from './helpers';

const {
  AMP,
  ARC_MIN_CHORD,
  ARC_STEPS,
  DASH,
  END_DAMP,
  HATCH_AMP,
  HATCH_GAP,
  HATCH_W,
  HEAD_AMP,
  HEAD_LEN,
  HEAD_SPREAD,
  LINE_H,
  MIN_STEPS,
  OVERSHOOT,
  PASS2_W,
  PILL_AMP,
  PILL_JX,
  PILL_STEPS,
  SEG_LEN,
  SIZE,
  WASH_RX,
} = constants;

// A point jittered at amplitude `a` lands within a/2 of where it was aimed,
// and the last point of a leg within a * END_DAMP / 2. Every tolerance below
// is one of those two bounds, so an assertion fails only if the renderer
// aimed somewhere else - never because a different draw of the dice was
// unlucky.
const spread = (amplitude: number) => amplitude / 2;
const damped = (amplitude: number) => (amplitude * END_DAMP) / 2;

function expectNear(actual: Point, expected: Point, within: number) {
  expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(within);
  expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(within);
}

const attr = (el: Element, name: string) => el.getAttribute(name);
const num = (el: Element, name: string) => Number(el.getAttribute(name));

describe('pen()', () => {
  it('draws from seed 1 when no seed is given', () => {
    const reference = mulberry32(1);
    const p = pen(makeSvg());
    expect([p.rng(), p.rng(), p.rng()]).toEqual([
      reference(),
      reference(),
      reference(),
    ]);
  });

  it('draws from the seed it is given', () => {
    const options: PenOptions = { seed: 4242 };
    const reference = mulberry32(4242);
    expect(pen(makeSvg(), options).rng()).toBe(reference());
  });

  it('appends to the svg it was handed, in call order', () => {
    const svg = makeSvg();
    const p = pen(svg);
    p.wash(0, 0, 10, 10);
    p.label(0, 0, 'x');
    expect(tagsOf(svg)).toEqual(['rect', 'text']);
  });
});

describe('stroke()', () => {
  it('lays down two passes, the second thinner and fainter', () => {
    const svg = makeSvg();
    pen(svg).stroke([
      [0, 0],
      [100, 0],
    ]);

    expect(tagsOf(svg)).toEqual(['path', 'path']);
    const [first, second] = [nth(pathsOf(svg), 0), nth(pathsOf(svg), 1)];
    // Literals, not the constants under test: the scenario names these
    // numbers, so deriving them from the same source asserts nothing.
    // The emitted strings, not rounded numbers: 1.6 * .75 is not exactly
    // 1.2 in binary floating point, and it is the emitted bytes that are the
    // contract.
    expect(attr(first, 'stroke-width')).toBe('1.6');
    expect(attr(second, 'stroke-width')).toBe('1.2000000000000002');
    expect(attr(first, 'opacity')).toBe('0.92');
    expect(attr(second, 'opacity')).toBe('0.5');
    for (const path of [first, second]) {
      expect(attr(path, 'stroke-linecap')).toBe('round');
      expect(attr(path, 'fill')).toBe('none');
      expect(attr(path, 'stroke')).toBe(defaultTheme.ink);
      expect(attr(path, 'stroke-dasharray')).toBeNull();
    }
    // Re-jittered per pass: identical `d` would be one line drawn twice.
    expect(attr(first, 'd')).not.toBe(attr(second, 'd'));
  });

  it('honours colour, width, amplitude and dotting', () => {
    const svg = makeSvg();
    const options: StrokeOptions = {
      color: 'rebeccapurple',
      dotted: true,
      width: 4,
      amplitude: 0,
    };
    pen(svg).stroke(
      [
        [0, 0],
        [SEG_LEN * 4, 0],
      ],
      options,
    );

    const [first, second] = [nth(pathsOf(svg), 0), nth(pathsOf(svg), 1)];
    expect(attr(first, 'stroke')).toBe('rebeccapurple');
    expect(num(first, 'stroke-width')).toBe(4);
    expect(num(second, 'stroke-width')).toBe(4 * PASS2_W);
    expect(attr(first, 'stroke-dasharray')).toBe(DASH);
    expect(attr(second, 'stroke-dasharray')).toBe(DASH);
    // Zero amplitude is zero jitter, so both passes trace the exact polyline:
    // four steps of SEG_LEN, which is where every jittered point starts from.
    expect(attr(first, 'd')).toBe('M0 0 L26 0 L52 0 L78 0 L104 0');
    expect(attr(second, 'd')).toBe(attr(first, 'd'));
  });

  it('cuts a leg into SEG_LEN steps but never fewer than MIN_STEPS', () => {
    const long = makeSvg();
    pen(long).stroke([
      [0, 0],
      [SEG_LEN * 4, 0],
    ]);
    expect(pointsOf(nth(pathsOf(long), 0))).toHaveLength(5);

    const short = makeSvg();
    pen(short).stroke([
      [0, 0],
      [5, 0],
    ]);
    expect(pointsOf(nth(pathsOf(short), 0))).toHaveLength(MIN_STEPS + 1);
  });

  it('damps the jitter at the end of each leg', () => {
    const svg = makeSvg();
    pen(svg).stroke([
      [0, 0],
      [SEG_LEN * 4, 0],
    ]);
    const points = pointsOf(nth(pathsOf(svg), 0));

    const last = nth(points, points.length - 1);
    expect(Math.abs(last[1])).toBeLessThanOrEqual(damped(AMP));
    // The damping is only at the joint: the points before it are free to
    // wander the full amplitude, and at least one of them does.
    const middle = points.slice(0, -1);
    expect(middle.some(([, y]) => Math.abs(y) > damped(AMP))).toBe(true);
  });
});

describe('arrow()', () => {
  it('adds two barbs of HEAD_LEN at plus and minus HEAD_SPREAD', () => {
    const svg = makeSvg();
    pen(svg).arrow([
      [0, 0],
      [100, 0],
    ]);

    const paths = pathsOf(svg);
    expect(paths).toHaveLength(6);
    // A shaft aimed straight along +x, so each barb trails back from the tip
    // at exactly HEAD_SPREAD above and below the horizontal.
    const back = HEAD_LEN * Math.cos(HEAD_SPREAD);
    const rise = HEAD_LEN * Math.sin(HEAD_SPREAD);
    for (const [index, expected] of [
      [2, [100 - back, rise]],
      [4, [100 - back, -rise]],
    ] as Array<[number, Point]>) {
      const barb = pointsOf(nth(paths, index));
      expectNear(nth(barb, 0), expected, spread(HEAD_AMP));
      expectNear(nth(barb, barb.length - 1), [100, 0], damped(HEAD_AMP));
    }
  });

  it('dots the shaft and never the barbs', () => {
    const svg = makeSvg();
    pen(svg).arrow(
      [
        [0, 0],
        [100, 0],
      ],
      { dotted: true },
    );

    const paths = pathsOf(svg);
    expect(paths.slice(0, 2).map((p) => attr(p, 'stroke-dasharray'))).toEqual([
      DASH,
      DASH,
    ]);
    expect(paths.slice(2).map((p) => attr(p, 'stroke-dasharray'))).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('aims the barbs along the last leg of a multi-point shaft', () => {
    const svg = makeSvg();
    pen(svg).arrow([
      [0, 0],
      [100, 0],
      [100, 100],
    ]);

    // The last leg points straight down, so the barbs trail upward from the
    // tip - the first two points of the shaft have no say in it.
    const barb = pointsOf(nth(pathsOf(svg), 2));
    expectNear(
      nth(barb, 0),
      [
        100 - HEAD_LEN * Math.sin(HEAD_SPREAD),
        100 - HEAD_LEN * Math.cos(HEAD_SPREAD),
      ],
      spread(HEAD_AMP),
    );
  });
});

describe('rect()', () => {
  it('draws four independent sides in reference order, each overshooting its corners', () => {
    const svg = makeSvg();
    pen(svg).rect(0, 0, 100, 50);

    const paths = pathsOf(svg);
    expect(paths).toHaveLength(8);
    const side = (index: number) => pointsOf(nth(paths, index * 2));
    const start = (index: number) => nth(side(index), 0);
    const end = (index: number) => nth(side(index), side(index).length - 1);
    const over = OVERSHOOT;

    // Top: left to right along y = 0, starting up to OVERSHOOT left of the
    // corner and ending up to OVERSHOOT past the right one.
    expect(start(0)[0]).toBeGreaterThanOrEqual(-over - spread(AMP));
    expect(start(0)[0]).toBeLessThanOrEqual(spread(AMP));
    expect(Math.abs(start(0)[1])).toBeLessThanOrEqual(spread(AMP));
    expect(end(0)[0]).toBeGreaterThanOrEqual(100 - damped(AMP));
    expect(end(0)[0]).toBeLessThanOrEqual(100 + over + damped(AMP));

    // Right: top to bottom along x = 100.
    expect(Math.abs(start(1)[0] - 100)).toBeLessThanOrEqual(spread(AMP));
    expect(start(1)[1]).toBeLessThanOrEqual(spread(AMP));
    expect(end(1)[1]).toBeGreaterThanOrEqual(50 - damped(AMP));

    // Bottom: right to left along y = 50.
    expect(start(2)[0]).toBeGreaterThan(end(2)[0]);
    expect(Math.abs(start(2)[1] - 50)).toBeLessThanOrEqual(spread(AMP));

    // Left: bottom to top along x = 0.
    expect(start(3)[1]).toBeGreaterThan(end(3)[1]);
    expect(Math.abs(start(3)[0])).toBeLessThanOrEqual(spread(AMP));
  });
});

describe('pill()', () => {
  it('walks PILL_STEPS segments around the box and closes the loop', () => {
    const svg = makeSvg();
    pen(svg).pill(0, 0, 100, 100);

    const paths = pathsOf(svg);
    expect(paths).toHaveLength(2);
    const points = pointsOf(nth(paths, 0));
    // Every segment of a 100 px pill is shorter than SEG_LEN, so each one is
    // the MIN_STEPS floor: the outline vertices are the even indices.
    expect(points).toHaveLength(PILL_STEPS * MIN_STEPS + 1);

    // Radius jitter plus outline jitter is the whole distance a vertex may
    // sit from its ideal place on the ellipse.
    const within = PILL_JX / 2 + spread(PILL_AMP);
    for (let i = 0; i <= PILL_STEPS; i++) {
      const a = (i / PILL_STEPS) * 2 * Math.PI;
      expectNear(
        nth(points, i * MIN_STEPS),
        [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)],
        within,
      );
    }
  });
});

describe('arc()', () => {
  // The strongest claim in this block, and the one the rest of it rests on:
  // arc draws nothing of its own and takes nothing out of the seeded sequence
  // beyond what stroke takes, so no diagram rendered before it existed can
  // have moved by a byte.
  it('is a stroke of the sampled points and nothing else', () => {
    const cx = 50;
    const cy = 50;
    const rx = 40;
    const ry = 30;
    const from = 0.3;
    const to = 2.4;
    // From the sampler, not from a copy of two of its three rules. This test
    // is about what `arc` does with the points and with its options; which
    // points they are is pinned below, by the tests that name each rule.
    const pts: Point[] = arcPoints(cx, cy, rx, ry, from, to);

    // Options no default would produce, handed to both: arc's seventh
    // argument is forwarded or it is not, and nothing else would notice.
    // Every other primitive is covered there by a golden drawn through
    // `draw`; arc has no caller yet, so this is the only thing watching.
    const opts: StrokeOptions = {
      color: 'red',
      dotted: true,
      width: 3,
      amplitude: 1,
    };
    const curved = makeSvg();
    pen(curved).arc(cx, cy, rx, ry, from, to, opts);
    const sampled = makeSvg();
    pen(sampled).stroke(pts, opts);

    // Whole elements, both passes, string for string. Equal to the last digit
    // is the only form of this assertion that rules out a stray rng() call,
    // which would shift every jittered coordinate after it without moving any
    // of them far; whole elements rather than `d` alone is what makes the
    // colour, the dashes and the widths part of the claim.
    expect(pathsOf(curved).map((path) => path.outerHTML)).toEqual(
      pathsOf(sampled).map((path) => path.outerHTML),
    );
  });

  it('samples the curve into straight chords and emits no curve command', () => {
    // Off the diagonal on purpose. With cx === cy an implementation that
    // swapped the two would place every point correctly, and the centre would
    // be tested by nothing in this file.
    // Radius 60, where the angle rule alone decides: below about 50 the chord
    // floor takes over and above about 108 the SEG_LEN ceiling does, and this
    // test is about the rule between them.
    const svg = makeSvg();
    pen(svg).arc(50, 90, 60, 60, 0, Math.PI);

    const paths = pathsOf(svg);
    expect(paths).toHaveLength(2);
    const first = nth(paths, 0);
    // Only M and L survive stripping the numbers out of `d`. An A or a C
    // would hand the shape back to the renderer, which draws it exactly, and
    // an exact curve is the one thing this pen must never emit.
    expect((attr(first, 'd') ?? '').replace(/[^A-Za-z]/g, '')).toMatch(/^ML+$/);

    // A half sweep takes half the chords of a full turn, so the density of a
    // partial arc is the density of a whole one.
    const chords = ARC_STEPS / 2;
    const points = pointsOf(first);
    // Every chord of a half circle of radius 60 is shorter than SEG_LEN, so
    // each one is the MIN_STEPS floor: the vertices are the even indices.
    expect(points).toHaveLength(chords * MIN_STEPS + 1);

    for (let i = 0; i <= chords; i++) {
      const a = (i / chords) * Math.PI;
      // Vertex 0 is the M point, jittered at the full amplitude; every later
      // one is a chord's final point and damped. The tighter bound is the
      // point of the assertion: arc puts the vertex on the true ellipse and
      // adds no radius jitter of its own the way pill does.
      expectNear(
        nth(points, i * MIN_STEPS),
        [50 + 60 * Math.cos(a), 90 + 60 * Math.sin(a)],
        i === 0 ? spread(AMP) : damped(AMP),
      );
    }
  });

  it('falls back on the MIN_STEPS floor for a sweep too small to earn one', () => {
    // Both density rules round down to nothing here - a fifth of a radian at
    // radius 40 is a two pixel arc - and the floor is the only thing deciding
    // the count. Without it the curve is described by a single chord, which
    // is a straight line with the ends in the right places.
    const svg = makeSvg();
    pen(svg).arc(50, 90, 40, 40, 0, 0.1);

    const points = pointsOf(nth(pathsOf(svg), 0));
    expect(points).toHaveLength(MIN_STEPS * MIN_STEPS + 1);
  });

  it('sweeps clockwise on screen when the sweep is positive', () => {
    // A quarter turn from the +x axis, once each way. The last sample is the
    // one the sign decides: it is the only vertex whose angle is exactly the
    // `to` it was given, so it lands on the circle rather than a chord's worth
    // inside it, and a plain jitter bound is the whole tolerance.
    const quarter = (to: number) => {
      const svg = makeSvg();
      pen(svg).arc(50, 90, 40, 40, 0, to);
      return pointsOf(nth(pathsOf(svg), 0));
    };
    const clockwise = quarter(Math.PI / 2);
    const widdershins = quarter(-Math.PI / 2);

    // A positive sweep travels clockwise on screen, because y grows downward
    // in SVG: a quarter turn from the +x axis is below the centre, not above
    // it. A reader who assumes otherwise puts the loop on the wrong side of
    // the node. An implementation that took the magnitude and ignored the
    // sign would put both of these in the same place.
    expectNear(
      nth(clockwise, clockwise.length - 1),
      [50, 90 + 40],
      damped(AMP),
    );
    expectNear(
      nth(widdershins, widdershins.length - 1),
      [50, 90 - 40],
      damped(AMP),
    );

    // The two are the same arc drawn the other way round, so they are sampled
    // into the same number of pieces. Only the count says so: an
    // implementation that dropped the magnitude from the density rule would
    // still land the last point exactly on `to`, and would collapse every
    // anticlockwise arc to the floor without moving an endpoint.
    expect(widdershins).toHaveLength(clockwise.length);
  });

  it('lands a full sweep on the angles pill walks for the same box', () => {
    const svg = makeSvg();
    pen(svg).arc(50, 50, 50, 50, 0, 2 * Math.PI);

    const points = pointsOf(nth(pathsOf(svg), 0));
    // ARC_STEPS equals PILL_STEPS, so a full turn is chord for chord what
    // pill walks, each one again under SEG_LEN and cut at the MIN_STEPS floor.
    expect(points).toHaveLength(PILL_STEPS * MIN_STEPS + 1);

    // The same ellipse at the same angles, not the same drawing: pill jitters
    // both radii per point and strokes at PILL_AMP, so the two lines wobble
    // differently along one path.
    for (let i = 0; i <= PILL_STEPS; i++) {
      // Deliberately the expression the pill test uses for pill(0, 0, 100,
      // 100), so a drift in either sampling shows up as the two tests
      // disagreeing. What holds the angles to the last bit is the first test
      // in this block; this one holds them to a jitter bound.
      const a = (i / PILL_STEPS) * 2 * Math.PI;
      expectNear(
        nth(points, i * MIN_STEPS),
        [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)],
        i === 0 ? spread(AMP) : damped(AMP),
      );
    }
  });

  // The mirror of the rule below, and the one that keeps a small arc from
  // being drawn finer than the hand drawing it. `ARC_STEPS` counts a full turn
  // and knows nothing of the radius, so a quarter turn takes its share at any
  // size: at radius 13 that is a 3 px chord, which `pass` halves again and
  // jitters 2.6 px across. Measured on the markup before this bound existed, a
  // brace's corners drew gaps down to 0.19 px.
  it('stops short of the angle rule rather than draw finer than the jitter', () => {
    const svg = makeSvg();
    // A brace's corner: a quarter turn at BRACE_R, where the angle rule alone
    // asks for seven chords across 20 px of arc.
    pen(svg).arc(0, 0, 13, 13, Math.PI, Math.PI / 2);
    const points = pointsOf(nth(pathsOf(svg), 0));

    const run = 13 * (Math.PI / 2);
    expect(Math.round((ARC_STEPS * (Math.PI / 2)) / (2 * Math.PI))).toBe(7);
    // Two, because the floor would allow one and MIN_STEPS never goes below
    // two: a degenerate arc is still a pair of chords.
    expect(Math.floor(run / ARC_MIN_CHORD)).toBe(1);
    expect(points).toHaveLength(MIN_STEPS * MIN_STEPS + 1);

    // And the shape survives it. A chord departs its arc by r(1 - cos(t / 2)),
    // which here is 13 * (1 - cos(22.5 degrees)) = 0.99 px - under the 1.3 the
    // jitter moves the point anyway, so there was nothing to buy by sampling
    // finer and a scribble to pay for it.
    expect(13 * (1 - Math.cos(Math.PI / 8))).toBeLessThan(AMP / 2);
  });

  it('samples past the angle rule rather than let a chord outrun SEG_LEN', () => {
    // Above about 108 px, a chord at ARC_STEPS to the turn would be longer
    // than the segment a straight leg is cut into, and the arc would be the
    // coarsest line in the picture. The chord rule takes over there. This is
    // the case group 3 produces: a connector bowed shallowly across a wide
    // diagram is a large radius through a small sweep.
    // An ellipse rather than a circle, and the long radius second: the
    // longest chord sits at the end of the shorter radius, where the longer
    // one sets the speed, so a rule reaching for either radius by name rather
    // than for the larger of the two would under-sample this.
    const rx = 60;
    const ry = 200;
    const sampled = (a: number, b: number, to: number) => {
      const svg = makeSvg();
      pen(svg).arc(50, 90, a, b, 0, to);
      return pointsOf(nth(pathsOf(svg), 0));
    };
    const points = sampled(rx, ry, 2 * Math.PI);

    const chords = Math.ceil((Math.max(rx, ry) * 2 * Math.PI) / SEG_LEN);
    expect(chords).toBeGreaterThan(PILL_STEPS);
    // The same ellipse stood on its side has the same chords, so neither
    // radius can be the one the rule reaches for.
    expect(sampled(ry, rx, 2 * Math.PI)).toHaveLength(chords * MIN_STEPS + 1);
    // Drawn the other way round it is the same arc, so the chord rule has to
    // reach the same count from a negative sweep. It is the only rule of the
    // two whose arithmetic could quietly give up on one - a negative count
    // loses to the angle rule instead of beating it, and every large
    // anticlockwise arc would fall back to being the coarsest line in the
    // picture with no endpoint out of place to show for it.
    expect(sampled(rx, ry, -2 * Math.PI)).toHaveLength(points.length);
    expect(points).toHaveLength(chords * MIN_STEPS + 1);

    // The point of the rule, asserted as the rule rather than as its count:
    // every gap between sampled vertices is within a leg's segment length.
    for (let i = 1; i <= chords; i++) {
      const [x0, y0] = nth(points, (i - 1) * MIN_STEPS);
      const [x1, y1] = nth(points, i * MIN_STEPS);
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThanOrEqual(
        SEG_LEN + spread(AMP) * 2,
      );
    }
  });
});

describe('diamond()', () => {
  it('joins the four edge midpoints and returns to the first', () => {
    const svg = makeSvg();
    pen(svg).diamond(0, 0, 100, 60);

    const paths = pathsOf(svg);
    expect(paths).toHaveLength(2);
    const points = pointsOf(nth(paths, 0));
    expect(points).toHaveLength(4 * MIN_STEPS + 1);

    const corners: Point[] = [
      [50, 0],
      [100, 30],
      [50, 60],
      [0, 30],
      [50, 0],
    ];
    corners.forEach((corner, i) => {
      expectNear(nth(points, i * MIN_STEPS), corner, spread(AMP));
    });
  });
});

describe('hatch()', () => {
  // A 100x50 box is wide enough that the diagonals run off both the top-left
  // and the bottom-right of it, so one sweep exercises both clipping arms.
  const box = { x: 0, y: 0, w: 100, h: 50 };
  const offsets: number[] = [];
  for (let i = -box.h; i < box.w; i += HATCH_GAP) offsets.push(i);

  it('rules diagonals HATCH_GAP apart, clipped to the box at both ends', () => {
    const svg = makeSvg();
    pen(svg).hatch(box.x, box.y, box.w, box.h);

    const paths = pathsOf(svg);
    expect(paths).toHaveLength(offsets.length * 2);
    // Five diagonals leave the box past its top edge and four past its right
    // edge; without both arms one group would run outside the box.
    expect(offsets.filter((i) => i < 0)).toHaveLength(5);
    expect(offsets.filter((i) => i + box.h > box.w)).toHaveLength(4);

    offsets.forEach((i, line) => {
      const points = pointsOf(nth(paths, line * 2));
      expectNear(
        nth(points, 0),
        [Math.max(box.x, box.x + i), i < 0 ? box.y - i : box.y],
        spread(HATCH_AMP),
      );
      expectNear(
        nth(points, points.length - 1),
        [
          Math.min(box.x + box.w, box.x + i + box.h),
          i + box.h > box.w ? box.y + (box.w - i) : box.y + box.h,
        ],
        damped(HATCH_AMP),
      );
    });
  });

  it('rules at HATCH_W and falls back to the ink colour', () => {
    const svg = makeSvg();
    pen(svg).hatch(box.x, box.y, box.w, box.h);

    const first = nth(pathsOf(svg), 0);
    expect(num(first, 'stroke-width')).toBe(HATCH_W);
    expect(attr(first, 'stroke')).toBe(defaultTheme.ink);
  });

  it('takes the colour it is given', () => {
    const svg = makeSvg();
    pen(svg).hatch(box.x, box.y, box.w, box.h, 'seagreen');
    expect(attr(nth(pathsOf(svg), 0), 'stroke')).toBe('seagreen');
  });
});

describe('label()', () => {
  it('emits one <text> per line, stacked around the anchor point', () => {
    const svg = makeSvg();
    pen(svg).label(50, 50, ['first', 'second']);

    const texts = textsOf(svg);
    expect(texts.map((t) => t.textContent)).toEqual(['first', 'second']);
    for (const text of texts) {
      expect(num(text, 'x')).toBe(50);
      expect(attr(text, 'text-anchor')).toBe('middle');
      expect(attr(text, 'dominant-baseline')).toBe('middle');
      expect(attr(text, 'style')).toBe(
        `fill:${defaultTheme.ink};font-size:${SIZE}px`,
      );
    }
    // Two lines straddle the anchor by half a line each.
    expect(num(nth(texts, 0), 'y')).toBeCloseTo(50 - (SIZE * LINE_H) / 2, 10);
    expect(num(nth(texts, 1), 'y')).toBeCloseTo(50 + (SIZE * LINE_H) / 2, 10);
  });

  it('normalizes a single string to one line', () => {
    const svg = makeSvg();
    pen(svg).label(50, 50, 'on its own');

    const texts = textsOf(svg);
    expect(texts).toHaveLength(1);
    expect(nth(texts, 0).textContent).toBe('on its own');
    // One line sits exactly on the anchor.
    expect(num(nth(texts, 0), 'y')).toBe(50);
  });

  it('honours size, colour, anchor and line height', () => {
    const svg = makeSvg();
    const options: LabelOptions = {
      size: 20,
      color: 'darkorange',
      anchor: 'start',
      lineHeight: 2,
    };
    pen(svg).label(0, 100, ['a', 'b'], options);

    const texts = textsOf(svg);
    expect(attr(nth(texts, 0), 'text-anchor')).toBe('start');
    expect(attr(nth(texts, 0), 'style')).toBe('fill:darkorange;font-size:20px');
    expect(num(nth(texts, 0), 'y')).toBe(100 - 20);
    expect(num(nth(texts, 1), 'y')).toBe(100 + 20);
  });
});

describe('wash()', () => {
  it('is a plain rounded rect in the wash colour', () => {
    const svg = makeSvg();
    pen(svg).wash(10, 20, 30, 40);

    expect(tagsOf(svg)).toEqual(['rect']);
    const rect = nth(Array.from(svg.children), 0);
    expect(num(rect, 'x')).toBe(10);
    expect(num(rect, 'y')).toBe(20);
    expect(num(rect, 'width')).toBe(30);
    expect(num(rect, 'height')).toBe(40);
    expect(num(rect, 'rx')).toBe(WASH_RX);
    expect(attr(rect, 'fill')).toBe(defaultTheme.wash);
  });

  it('takes the fill it is given', () => {
    const svg = makeSvg();
    pen(svg).wash(0, 0, 1, 1, 'papayawhip');
    expect(attr(nth(Array.from(svg.children), 0), 'fill')).toBe('papayawhip');
  });
});
