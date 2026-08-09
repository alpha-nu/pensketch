import { ARC_STEPS, MIN_STEPS } from './constants';
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
 * `ARC_STEPS` counts a full turn, so a partial sweep takes its share and
 * density does not change with the angle asked for.
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
