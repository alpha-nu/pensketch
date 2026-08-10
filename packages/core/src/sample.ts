import { ARC_STEPS, MIN_STEPS, SEG_LEN } from './constants';
import type { Point, Side } from './types';

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
    // An ellipse's longest chord is the one at the end of its longer radius,
    // so that radius bounds them all.
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
 * The `r` row shares its anchors and its reach with the loop drawn by hand in
 * `examples/state-machine`, which leaves [250, 184], reaches x = 310 and
 * returns to [250, 208] off a side at x = 250 whose middle is y = 196. That
 * drawing is where `LOOP_OUT` and `LOOP_SPAN` got their values, and it is the
 * only evidence those defaults look right: the two numbers on their own say
 * nothing about how a loop reads.
 *
 * The curve between those points is not the same, and the difference is
 * visible. The hand-drawn loop is fat in the middle - 24 px across where this
 * is 10 - because it was placed point by point to look like a loop. A half
 * ellipse is widest at its anchors and tapers to the tip. Whichever reads
 * better is a question for the drawing that replaces it, not for this file.
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
