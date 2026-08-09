import { ARC_STEPS, MIN_STEPS, SEG_LEN } from './constants';
import type { Point } from './types';

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
