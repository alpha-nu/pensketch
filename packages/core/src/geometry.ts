import {
  AMP,
  DEPTH_RISE,
  LINE_H,
  LOOP_OUT,
  LOOP_SPAN,
  WIDTH,
} from './constants';
import { anchor, type DepthPair, depthOf } from './draw';
import { bowPoints, loopPoints } from './sample';
import type { DiagramEdge, DiagramNode, Point, Side } from './types';

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
 * A box read as the rectangle it covers rather than as the four numbers it
 * was written with. `{x: 350, y: 166, w: -150, h: -46}` and
 * `{x: 200, y: 120, w: 150, h: 46}` name one rectangle, and the pen lays the
 * same ink over it from either — `ShapeOptions.depth` promises as much,
 * because winding is read off the outline's signed area, not off the sign of
 * a dimension. Each axis comes back as the `(min, extent)` pair every piece
 * of arithmetic downstream already assumes it was handed.
 *
 * Stated here, once, rather than at each call site: a predicate that reads a
 * box owes the same answer for both spellings of it, and a precondition
 * every present and future caller has to remember is a precondition that gets
 * forgotten. Idempotent, so a caller that has already squared its boxes away
 * loses nothing by passing them through again.
 */
function norm(b: Box): Box {
  return {
    x: Math.min(b.x, b.x + b.w),
    y: Math.min(b.y, b.y + b.h),
    w: Math.abs(b.w),
    h: Math.abs(b.h),
  };
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
 *
 * Either side may be written from any of its four corners. Both are read
 * through `norm`, so there is no precondition on the sign of `w` or `h` and a
 * mirrored node overlaps exactly the ink it is drawn over.
 */
export function intersects(a: Box, b: Box): boolean {
  const p = norm(a);
  const q = norm(b);
  return (
    p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
  );
}

/**
 * Whether `inner` lies wholly within `outer`, edges included. A box flush
 * against the inside of another is contained: it is a layout, not an escape.
 *
 * Either side may be written from any of its four corners. Both are read
 * through `norm`, so there is no precondition on the sign of `w` or `h` and a
 * mirrored node is inside the group its ink is inside.
 */
export function contains(outer: Box, inner: Box): boolean {
  const o = norm(outer);
  const i = norm(inner);
  return (
    i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h
  );
}

/**
 * The box an extruded node's ink covers: the front box carried by the
 * extrusion vector `(d, -DEPTH_RISE * d)` and everything it sweeps on the
 * way, which for a box written upright is `(x, y - .75d, w + d, h + .75d)`. A
 * depth of nought - every flat node, every group, every shape too small to
 * carry a face - is the box itself, returned rather than copied, so a flat
 * diagram is measured through exactly the objects it always was.
 *
 * The box is read through `norm` - as the rectangle it covers rather than as
 * the four numbers it was written with - so that each axis is a
 * `(min, extent)` pair before it grows. `ShapeOptions.depth` promises that a
 * mirrored dimension still extrudes outward - the pen reads winding off the
 * outline's signed area - so a node written `h: -60` from its lower edge
 * draws the same ink as the same rectangle written upright, and must be
 * measured as the same ink too. Growing the numbers as written instead
 * subtracts: `+ .75d` on a negative `h` cancels the rise, `+ d` on a negative
 * `w` shrinks the box, and the sweep comes back smaller than the flat
 * rectangle it stands for. That is the one thing depth must never do - a slab
 * that withdraws a finding leaves a diagram passing whose ink is outside the
 * frame.
 *
 * The sweep stands for the faces. They are not modelled stroke by stroke
 * here: a box fills its swept rectangle, a diamond and a pill do not, and the
 * corners neither of them reaches are the price of one rule that holds for
 * all three. It over-states, which is the direction this file already errs in
 * - `INFLATE` and the glyph estimate both - because a false overlap costs one
 * edit and a missed one costs a picture nobody looks at again.
 */
export function swept(b: Box, d: number): Box {
  if (!(d > 0)) return b;
  const rise = DEPTH_RISE * d;
  const f = norm(b);
  return { x: f.x, y: f.y - rise, w: f.w + d, h: f.h + rise };
}

/**
 * The line an edge is drawn along, as points — the four shapes `draw` chooses
 * between, chosen on the same terms. A self-transition is the loop off its
 * side; an edge whose `bow` is not 0 is that arc; an edge with `via` is the
 * anchor it leaves, those corners in the order given, and the anchor it lands
 * on; anything else is the straight run between the two anchors. Both curves
 * come back as the chords they are drawn as, from the same `loopPoints` and
 * `bowPoints` the pen is handed, through the same exported `anchor` — so the
 * checker measures the line the renderer will draw, give or take the wobble,
 * and every rule here goes on reasoning in straight segments.
 *
 * The anchors are the renderer's, depth included: `depthOf` resolves each end
 * from the same pair `draw` reads, so an edge leaving the `r` of an extruded
 * node is walked from the silhouette midpoint the arrow will actually be
 * drawn from rather than from the front box's side. Without it every rule
 * downstream - `edge-overlap`, `label-collision`, `out-of-bounds` on a path -
 * measures a line the picture does not contain. The pair defaults to nothing,
 * so a caller that has no opinion about depth gets flat anchors.
 *
 * `null` when either end names a node the diagram does not define. `draw`
 * throws on that by name, so there is nothing the checker can usefully add.
 *
 * A `via` on an edge naming one node at both ends is left out entirely: the
 * loop branch never reads the field. `draw` refuses that edge rather than
 * drawing it, and the loop it would otherwise draw turns at no corners, so
 * splicing them in would measure ink that is nowhere - which is a finding
 * about a line the renderer never draws.
 *
 * What a curve costs is length: a loop at the default `out` is fourteen points
 * where the chord was two, and more as it grows, since a chord of it is held
 * to the same `SEG_LEN` a straight leg is. Every rule that walks a path pays
 * that, once per path it is compared against. What it buys is that a loop or a
 * bow leaving the frame is now seen, where the chord this used to return sat
 * entirely inside one. It buys nothing against an obstacle: no
 * rule compares a path to a node's box, so a loop drawn over the node beside
 * it is as silent as it ever was.
 */
export function edgePath(
  e: DiagramEdge,
  byId: Map<string, DiagramNode>,
  o: DepthPair = {},
): Point[] | null {
  const from = byId.get(e.from[0]);
  const to = byId.get(e.to[0]);
  if (!from || !to) return null;
  const bow = e.bow ?? 0;
  const at = (n: DiagramNode, side: Side) => anchor(n, side, depthOf(n, o));
  return e.from[0] === e.to[0]
    ? loopPoints(
        at(from, e.from[1]),
        e.from[1],
        e.out ?? LOOP_OUT,
        e.span ?? LOOP_SPAN,
      )
    : bow !== 0
      ? bowPoints(at(from, e.from[1]), at(to, e.to[1]), bow)
      : [at(from, e.from[1]), ...(e.via || []), at(to, e.to[1])];
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
