import { AMP, LINE_H, WIDTH } from './constants';
import { anchor } from './draw';
import type { DiagramEdge, DiagramNode, Point } from './types';

// The geometry the checker reasons with. Internal: no entry point re-exports
// any of it, so the published `./check` surface stays exactly the one D1
// names. Kept apart from the rules so each piece can be tested against a
// number worked out by hand rather than against the checker's own opinion.

/**
 * How far the drawn line can sit from the ideal one, on either side of it.
 * A point is jittered by up to half the amplitude, and the stroke is drawn
 * half its width to each side of where it lands. Derived from the constants
 * rather than written as 2.1, so that moving either one moves this too.
 */
export const INFLATE = AMP / 2 + WIDTH / 2;

/**
 * A rectangle in the diagram's own coordinate space. A `DiagramNode` already
 * is one — it declares `x`, `y`, `w` and `h` — so nodes are passed straight
 * in rather than converted.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The box a block of label text occupies.
 *
 * `pen.label` writes `dominant-baseline: middle`, so `y` is the vertical
 * centre of the block rather than a baseline, and each further line adds
 * `size * LINE_H`. Width is the estimate — nothing here measures text — so
 * `glyph` is the advance per character as a fraction of the font size.
 */
export function labelBox(
  x: number,
  y: number,
  lines: string[],
  size: number,
  anchor: 'start' | 'middle' | 'end',
  glyph: number,
): Box {
  const w = lines.reduce((m, l) => Math.max(m, l.length), 0) * size * glyph;
  const h = (lines.length - 1) * size * LINE_H + size;
  return {
    x: anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2,
    y: y - h / 2,
    w,
    h,
  };
}

/**
 * Whether two boxes share any area. Boxes that touch exactly along an edge do
 * not: laying one box flush against another is a placement, not a collision.
 */
export function intersects(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/**
 * Whether `inner` lies wholly within `outer`, edges included. A box flush
 * against the inside of another is contained: it is a layout, not an escape.
 */
export function contains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/**
 * The line an edge would be drawn along: the anchor it leaves, its `via`
 * corners in the order given, and the anchor it lands on. `draw` assembles
 * exactly this list before handing it to the pen — through the same exported
 * `anchor` — so the checker measures the line the renderer will draw, give or
 * take the wobble.
 *
 * `null` when either end names a node the diagram does not define. `draw`
 * throws on that by name, so there is nothing the checker can usefully add.
 *
 * One exception, and it is a gap rather than a decision: a self-transition is
 * drawn as a loop off its side, and this returns the two identical anchors
 * instead - plus any `via` points, which `draw` ignores on a loop and this
 * does not. So the rules do not go blind on such an edge, which would be the
 * safer failure. They measure a line that is only notionally there: a loop
 * that leaves the frame goes unreported, while a label near the side's
 * midpoint can be reported as sitting on the line it labels, and a `via` the
 * renderer never turns at can be reported as a corner outside the viewBox.
 * Closing it is the job of the task that samples loops and bows into segments;
 * until then, do not read this as the line the renderer draws for such an edge.
 */
export function edgePath(
  e: DiagramEdge,
  byId: Map<string, DiagramNode>,
): Point[] | null {
  const from = byId.get(e.from[0]);
  const to = byId.get(e.to[0]);
  return from && to
    ? [anchor(from, e.from[1]), ...(e.via || []), anchor(to, e.to[1])]
    : null;
}

/** Distance from a point to a box, and zero anywhere inside it. */
function pointToBox(b: Box, [x, y]: Point): number {
  return Math.hypot(
    Math.max(b.x - x, 0, x - (b.x + b.w)),
    Math.max(b.y - y, 0, y - (b.y + b.h)),
  );
}

/**
 * Whether a segment touches a box at all. Liang–Barsky: trim the segment's
 * own `0..1` parameter range against each axis in turn, and if anything is
 * left of it, some part of the segment is inside.
 */
function hitsBox(b: Box, [px, py]: Point, [qx, qy]: Point): boolean {
  let t0 = 0;
  let t1 = 1;
  const axes = [
    [qx - px, b.x - px, b.x + b.w - px],
    [qy - py, b.y - py, b.y + b.h - py],
  ] as const;
  for (const [d, near, far] of axes) {
    // No movement along this axis: either the segment already lies within
    // the slab or it never will.
    if (!d) {
      if (near > 0 || far < 0) return false;
      continue;
    }
    const a = near / d;
    const z = far / d;
    t0 = Math.max(t0, Math.min(a, z));
    t1 = Math.min(t1, Math.max(a, z));
  }
  return t0 <= t1;
}

/**
 * Distance from a box to a line segment, and zero when they touch. Between
 * two shapes that do not, the nearest pair is always a corner of the box
 * against the segment, or an end of the segment against the box.
 */
export function boxToSegment(b: Box, p: Point, q: Point): number {
  if (hitsBox(b, p, q)) return 0;
  return Math.min(
    pointToSegment([b.x, b.y], p, q),
    pointToSegment([b.x + b.w, b.y], p, q),
    pointToSegment([b.x + b.w, b.y + b.h], p, q),
    pointToSegment([b.x, b.y + b.h], p, q),
    pointToBox(b, p),
    pointToBox(b, q),
  );
}

/**
 * Distance from a point to a line segment — to the nearer end when the
 * perpendicular falls outside it. A segment whose ends coincide is treated as
 * that point, which is what two identical `via` waypoints amount to.
 */
export function pointToSegment(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len))
    : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
