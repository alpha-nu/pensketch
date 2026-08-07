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
 * The line an edge would be drawn along: the anchor it leaves, its `via`
 * corners in the order given, and the anchor it lands on. `draw` assembles
 * exactly this list before handing it to the pen — through the same exported
 * `anchor` — so the checker measures the line the renderer will draw, give or
 * take the wobble.
 *
 * `null` when either end names a node the diagram does not define. `draw`
 * throws on that by name, so there is nothing the checker can usefully add.
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
