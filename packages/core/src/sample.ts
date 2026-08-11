import {
  ARC_STEPS,
  BRACE_DEPTH,
  BRACE_R,
  MIN_STEPS,
  SEG_LEN,
} from './constants';
import type { DiagramBrace, Point, Side } from './types';

// Curves, cut into the straight lines everything here is actually made of.
// Kept below both the pen and the checker rather than inside either: the
// renderer draws these points and the checker measures them, and a second
// copy of the formula in the DOM-free bundle would be two shapes with one
// name. Imports constants and types only, so it can be reached from anywhere
// without closing an import cycle.

/**
 * An elliptical arc as points, swept from angle `from` to angle `to` in
 * radians, the sign of the difference giving the direction.
 *
 * The count is whichever of two rules is denser. `ARC_STEPS` counts a full
 * turn, so a partial sweep takes its share and density does not change with
 * the angle asked for; then no chord may run longer than `SEG_LEN`, which is
 * the rule `pass` already applies to every straight leg.
 *
 * The second rule is what keeps a shallow sweep at a large radius from being
 * described more coarsely than a straight line drawn beside it. The angle
 * rule alone turns a 400 px connector bowed 30 px into two chords, because
 * the sweep is only 34 degrees - and two chords across that span depart from
 * the true arc by 7.5 px, where the pen's own jitter moves a point by 1.3.
 */
export function arcPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
): Point[] {
  const sweep = to - from;
  const steps = Math.max(
    MIN_STEPS,
    Math.round((ARC_STEPS * Math.abs(sweep)) / (2 * Math.PI)),
    // An ellipse travels fastest at the end of its shorter radius, because
    // that is where the longer one carries the whole of the movement, so the
    // longer radius bounds every chord.
    Math.ceil((Math.max(rx, ry) * Math.abs(sweep)) / SEG_LEN),
  );
  // A radius or an angle that is not a finite number makes `steps` one too,
  // and the loop below would then allocate points until the heap gives out.
  // That is the one failure here a caller cannot catch: every other bad number
  // reaches a string first and raises a RangeError. Handing back nothing sends
  // it to the pen, which refuses a point list too short to draw.
  if (!Number.isFinite(steps)) return [];
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    // `sweep * (i / steps)`, not `(sweep * i) / steps`: the fraction first is
    // the association `pill` uses, so a full turn lands on its angles to the
    // last bit rather than to a tolerance.
    const a = from + sweep * (i / steps);
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/**
 * A bowed connector as points: the circular arc through `from` and `to` whose
 * apex sits `bow` px off the midpoint of the chord between them, measured
 * perpendicular to that chord. Positive is to the right of travel, so an edge
 * and its reverse given the same `bow` bow to opposite sides of the one line -
 * which is the only reason the offset is signed against the direction of
 * travel rather than against an axis.
 *
 * Right of travel, in a space where y grows downward, is the chord direction
 * turned to `(-dy, dx)`: travelling +x as `(1, 0)` gives `(0, 1)`, which is
 * down the screen, and down the screen is the right hand of someone walking
 * that way.
 *
 * A circle rather than an ellipse, because a circle is the same shape
 * whichever way its chord happens to lie and so needs no rotation term.
 * `arcPoints` has none, and one added for this could only go after `ry`,
 * where it would read as a third radius to everyone already calling it.
 *
 * There is no arc to draw for a `bow` of 0 - the radius below divides by it -
 * and none is wanted: a connector that does not bow is the straight line
 * between its anchors, which is the caller's to keep off this function.
 *
 * Two anchors at one point are a different degenerate case and need no
 * handling of their own. The chord has no direction, so its unit vector is
 * 0/0 and the centre and both angles are NaN; `arcPoints` already refuses a
 * sweep that is not a finite number and hands back nothing, which the pen
 * refuses to draw. A guard here could only reach the same answer by a longer
 * road.
 */
export function bowPoints(from: Point, to: Point, bow: number): Point[] {
  const chord = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const half = chord / 2;
  const nx = (from[1] - to[1]) / chord;
  const ny = (to[0] - from[0]) / chord;
  // Which way round the circle the sweep runs, which is always the side the
  // bow is not on. At the apex the tangent points along the chord, and an
  // increasing angle carries a point a quarter turn ahead of its own radius,
  // from +x towards +y. The radius there is the bow's own direction, so an
  // increasing angle at a positive bow travels back along the chord rather
  // than forward down it. True at any depth, unlike the centre below.
  const dir = bow > 0 ? -1 : 1;
  // Radius from the half-chord and the sagitta, the sagitta being `bow`
  // itself. The centre sits `(half^2 - bow^2) / 2|bow|` from the midpoint
  // along the same perpendicular - negative once the bow is deeper than half
  // the chord, which puts the centre on the bow's own side and sweeps more
  // than half a turn. That is a legal arc, not a case to correct.
  const away = 2 * Math.abs(bow);
  const r = (half * half + bow * bow) / away;
  const t = (dir * (half * half - bow * bow)) / away;
  const cx = (from[0] + to[0]) / 2 + nx * t;
  const cy = (from[1] + to[1]) / 2 + ny * t;
  const a0 = Math.atan2(from[1] - cy, from[0] - cx);
  let a1 = Math.atan2(to[1] - cy, to[0] - cx);
  // `atan2` names each end within one turn of the +x axis and knows nothing
  // of the arc between them, so the difference is as likely to describe the
  // long way round as the short. One turn in the direction settled above is
  // the whole correction: it is the same pair of points either way, and only
  // the arc through the apex runs in `dir`.
  if ((a1 - a0) * dir < 0) a1 += dir * 2 * Math.PI;
  return arcPoints(cx, cy, r, r, a0, a1);
}

/**
 * A brace or a square bracket as one point list, from the caller's `from`,
 * `to` and `depth` and nothing else.
 *
 * One list, and it is the whole reason this is a function rather than six pen
 * calls. `pass` damps a leg's final point to 40% of the jitter amplitude and
 * carries on from it, but across two `stroke` calls the shared point is drawn
 * twice and jittered independently, one of them at full amplitude. Measured
 * over 400 seeds the two land a mean of 1.07 px and a maximum of 2.11 px
 * apart, against a stroke 1.6 px wide. At a right angle that reads as a
 * hand-drawn corner, which is why `rect` gets away with four separate sides.
 * At the tangent join where a brace's arc meets its run it reads as a break.
 *
 * Measured in a frame of its own: `t` runs along the span from `from`, and `m`
 * runs perpendicular to it, to the right of travel, so a negative `depth`
 * flips the whole shape to the other side of the span without a second path
 * through this function. The four arcs are quarter turns, the two runs are the
 * straight lines between them, and the runs are not built at all: consecutive
 * arcs simply do not share a point, and `pass` draws the gap.
 *
 * A curly brace's tip is a point rather than a curve, and that is correct. The
 * two arcs that meet there arrive from opposite sides travelling in opposite
 * directions along `m`, which is the sharp middle a brace has and a bracket
 * does not.
 */
export function bracePoints(brace: DiagramBrace): Point[] {
  const [fx, fy] = brace.from;
  const [tx, ty] = brace.to;
  const len = Math.hypot(tx - fx, ty - fy);
  const ux = (tx - fx) / len;
  const uy = (ty - fy) / len;
  // Right of travel, in a space where y grows downward, is the direction of
  // travel turned to `(-dy, dx)` - the same turn `bowPoints` makes, and the
  // reason a caller who has learned one sign convention has learned both.
  const at = (t: number, m: number): Point => [
    fx + ux * t - uy * m,
    fy + uy * t + ux * m,
  ];
  const d = brace.depth ?? BRACE_DEPTH;
  if (brace.kind === 'square')
    return [at(0, 0), at(0, d), at(len, d), at(len, 0)];

  // The tip's pair takes whatever is left of the depth after the ends' pair
  // has had its corner, so a deeper brace grows its point and not its corners.
  // The ends' corner is capped at the depth itself for the shallow case: a
  // brace 8 px deep drawn with a 13 px corner reaches 13, which is a caller's
  // own number quietly replaced by one of ours, and this is a library whose
  // caller cannot see the result.
  const s = Math.sign(d);
  const deep = Math.abs(d);
  const r = Math.min(BRACE_R, deep);
  const q = deep - r;
  const half = len / 2;
  const arc = (t: number, m: number, rad: number, a0: number, a1: number) =>
    arcPoints(t, m, rad, s * rad, a0, a1).map(([u, v]) => at(u, v));
  const HALF_PI = Math.PI / 2;
  return [
    // Out of the far end of the span, turning onto the run.
    ...arc(r, 0, r, Math.PI, HALF_PI),
    // Off the run and up to the tip, and back down off it.
    ...arc(half - q, s * deep, q, 3 * HALF_PI, 4 * HALF_PI),
    ...arc(half + q, s * deep, q, Math.PI, 3 * HALF_PI).slice(1),
    // Onto the other run, and out of the other end.
    ...arc(len - r, 0, r, HALF_PI, 0),
  ];
}

/**
 * A self-transition as one point list: the anchor it leaves, the arc that
 * carries it out and back, and the anchor it returns to. Handed to `arrow`,
 * the head lands on the returning anchor, which is what makes a loop read as a
 * transition rather than as decoration.
 *
 * `mid` is the midpoint of the side the loop hangs off - what `anchor` returns
 * for that node and that side - taken as a point rather than as a node so this
 * file goes on importing nothing but constants and types, and stays reachable
 * from the renderer that draws a loop and the checker that measures one alike.
 *
 * `out` is how far the loop projects beyond the side and `span` is how far
 * apart its two anchors sit along it, centred on `mid`. Neither is measured
 * off the node: sizing a loop to the box it leaves would be layout.
 *
 * Every side leaves the anchor that comes first reading the page - the upper
 * one on a vertical side, the left one on a horizontal side - and returns to
 * the other, so a loop reads the same way whichever side it is on. That is the
 * whole reason the table below is not symmetric: `l` is the mirror of `r` and
 * `b` of `t`, and mirroring reverses the direction a sweep has to run to keep
 * the same reading. So `l` sweeps on to -3 * PI / 2 instead of turning back at
 * PI / 2, and `b` runs from PI down to 0.
 *
 * A half ellipse is widest at its anchors and tapers to the tip, so the loop's
 * extent along the side is exactly `span` and never more. That is worth saying
 * because a loop placed point by point is not like that - the freehand one
 * `examples/state-machine` used to draw, before this function replaced it, ran
 * [250, 184] to [250, 208] and bulged to 48 px across at its widest, twice the
 * 24 its anchors were apart. `LOOP_OUT` and `LOOP_SPAN` were read off that
 * drawing as 60 and 24, which kept its anchors and its reach and lost the
 * bulge, and 60 deep on 24 wide is a spike rather than a loop. They are 30 and
 * 40 now. The reasoning belongs with the constants; what belongs here is why a
 * pair of numbers taken off a freehand loop does not survive the trip: this
 * curve cannot bulge, so `span` has to carry the width the bulge used to.
 */
export function loopPoints(
  mid: Point,
  side: Side,
  out: number,
  span: number,
): Point[] {
  // Keyed rather than branched, the way `anchor` keys its four points. There
  // is no fifth side, and a switch would carry a default arm no test can
  // reach and no reader can check against the drawing.
  const sweeps: Record<
    Side,
    [rx: number, ry: number, from: number, to: number]
  > = {
    r: [out, span / 2, -Math.PI / 2, Math.PI / 2],
    l: [out, span / 2, -Math.PI / 2, (-3 * Math.PI) / 2],
    t: [span / 2, out, -Math.PI, 0],
    b: [span / 2, out, Math.PI, 0],
  };
  const [rx, ry, from, to] = sweeps[side];
  // `arcPoints` returns both endpoints, so the two anchors are already the
  // first and last points of what comes back - appending them would draw the
  // node's own edge twice.
  return arcPoints(mid[0], mid[1], rx, ry, from, to);
}
