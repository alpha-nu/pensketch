import {
  EDGE_SIZE,
  GROUP_AMP,
  GROUP_W,
  HATCH_INSET,
  LOOP_OUT,
  LOOP_SPAN,
  NOTE_AMP,
  NOTE_SIZE,
  SIZE,
  TITLE_DX,
  TITLE_DY,
  TITLE_SIZE,
} from './constants';
import { pen } from './pen';
import {
  bowPoints,
  bracePoints,
  hatchClip,
  hopRuns,
  loopPoints,
} from './sample';
import { resolveTheme } from './theme';
import type {
  Diagram,
  DiagramNode,
  DrawOptions,
  Point,
  Side,
  StrokeOptions,
} from './types';

/**
 * Where an edge meets a node: the midpoint of the named side of its box.
 * Edges are anchored by side rather than by coordinate, so moving or resizing
 * a node carries everything attached to it.
 */
export function anchor(node: DiagramNode, side: Side): Point {
  const sides: Record<Side, Point> = {
    t: [node.x + node.w / 2, node.y],
    b: [node.x + node.w / 2, node.y + node.h],
    l: [node.x, node.y + node.h / 2],
    r: [node.x + node.w, node.y + node.h / 2],
  };
  return sides[side];
}

/**
 * Renders `diagram` into `svg`, replacing whatever it held, so calling it
 * again is a redraw rather than an overlay. The same diagram, seed and
 * package version render the same bytes on a given JavaScript engine, which
 * is what makes a rendered `<svg>` worth snapshot-testing.
 *
 * Throws an `Error` naming the offender when an edge references a node the
 * diagram does not define, two nodes share an id, a node carries an unknown
 * shape, an edge has a `label` without numeric `lx` and `ly`, a brace has
 * `lines` without them, an edge names one node at both ends but two different
 * sides, or an edge or note describes its path twice - `bow` with `via`, or
 * either on a self-transition. Nothing else is validated.
 *
 * @example
 * ```js
 * import { draw } from '@pensketch/core';
 *
 * draw(document.getElementById('flow'), {
 *   nodes: [
 *     { id: 'in',   shape: 'pill',    x: 40,  y: 50, w: 160, h: 50, lines: ['request'] },
 *     { id: 'gate', shape: 'diamond', x: 260, y: 35, w: 150, h: 80, lines: ['allowed?'] },
 *     { id: 'work', shape: 'box',     x: 480, y: 50, w: 180, h: 50, lines: ['do the work'], accent: true },
 *   ],
 *   edges: [
 *     { from: ['in', 'r'],   to: ['gate', 'l'] },
 *     { from: ['gate', 'r'], to: ['work', 'l'], label: 'yes', lx: 445, ly: 60 },
 *   ],
 * }, { seed: 7, label: 'Request flow' });
 * ```
 */
export function draw(
  svg: SVGSVGElement,
  diagram: Diagram,
  options: DrawOptions = {},
): void {
  // Emptied child by child rather than through innerHTML, which is an HTML
  // parser detour that not every DOM implementation offers on SVG elements.
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (options.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.label);
  }

  const p = pen(svg, options);
  const theme = resolveTheme(options.theme);
  const nodes = diagram.nodes || [];
  // A Map rather than an object literal: an object inherits
  // Object.prototype, so an edge naming a node "toString" would find a
  // function there and skip the unknown-node error entirely.
  const byId = new Map<string, DiagramNode>();
  for (const n of nodes) {
    // Keeping the last silently would leave every edge naming that id pointing
    // at a node the author never meant, and nothing in the picture to say so.
    if (byId.has(n.id))
      throw new Error(
        `two nodes share the id "${n.id}"; edges name nodes by id, so ids must be unique`,
      );
    byId.set(n.id, n);
  }

  // Naming the ids that do exist turns a typo into a one-line fix. The list is
  // capped: a large diagram's would bury the message it is attached to.
  const known = () => {
    const all = [...byId.keys()];
    if (!all.length) return 'the diagram has no nodes';
    const head = all.slice(0, 8).map((k) => `"${k}"`);
    return all.length > 8
      ? `known ids include ${head.join(', ')} and ${all.length - 8} more`
      : `known ids are ${head.join(', ')}`;
  };

  // Draw order is the z-order and, because it is also the order the seeded
  // sequence is consumed in, part of the rendered bytes.
  nodes
    .filter((n) => n.shape === 'group')
    .forEach((n) => {
      p.wash(n.x, n.y, n.w, n.h);
      p.rect(n.x, n.y, n.w, n.h, {
        color: theme.pen,
        width: GROUP_W,
        amplitude: GROUP_AMP,
      });
      p.label(n.x + TITLE_DX, n.y + TITLE_DY, n.lines, {
        anchor: 'start',
        size: TITLE_SIZE,
        color: theme.pen,
      });
    });
  // The first of three marks. Nothing in the finished document says which
  // phase emitted a given element, and `order` at the foot of this function
  // ranks by exactly that, so where each phase stops is recorded as it stops.
  // Read unconditionally: three lengths cost less than the branch that would
  // skip them.
  const afterGroups = svg.children.length;

  // Every path first, then every arrow. An edge that hops has to know where
  // the others run, and nothing below `draw` can see a second edge: the pen
  // draws one stroke and the checker is not in this bundle. Validation stays
  // in this pass, so a diagram still throws before anything is drawn.
  const edgeList = diagram.edges || [];
  const paths = edgeList.map((e, i): Point[] => {
    const from = byId.get(e.from[0]);
    if (!from)
      throw new Error(
        `edge ${i} names unknown node "${e.from[0]}" in from; ${known()}`,
      );
    const to = byId.get(e.to[0]);
    if (!to)
      throw new Error(
        `edge ${i} names unknown node "${e.to[0]}" in to; ${known()}`,
      );
    // Both ends naming one node is a self-transition, and a loop hangs off a
    // single side: two sides is a corner loop, which is a different shape with
    // its own geometry to get right. Refused before anything is drawn, because
    // this is the data that used to draw a stub across the corner and say
    // nothing.
    const loop = e.from[0] === e.to[0];
    if (loop && e.from[1] !== e.to[1])
      throw new Error(
        `edge ${i} names node "${e.from[0]}" at both ends but sides "${e.from[1]}" and "${e.to[1]}"; a self-transition attaches to one side, so name the same side in from and to`,
      );
    // Nought and absent are one case: nought is not a caller asking for a
    // flat arc, which has no centre and no radius, but a caller describing
    // the straight line they would have got by leaving the field out. Read
    // against 0 rather than for truth, though, because `NaN` is falsy: a bow
    // that is not a number would otherwise draw the straight line and say
    // nothing, where `out` and `span` refuse the same value.
    const bow = e.bow ?? 0;
    // One defect under four names, so one message: the path has been
    // described twice, by `bow` and `via` together or by either of them on a
    // self-transition, whose own path its side, `out` and `span` already
    // settle. Picking a winner would invent geometry on the caller's behalf,
    // and discarding the loser in silence is what this change exists to stop.
    //
    // An empty `via` describes no corners, so it contradicts nothing, and it
    // is the one shape of it that draws: `[from, ...[], to]` is the straight
    // line. Refusing it would refuse a caller who writes the field always and
    // fills it sometimes.
    if (loop) {
      if (e.via?.length)
        throw new Error(
          `edge ${i} carries via; its path is already described by the side it hangs off, out and span`,
        );
      if (bow !== 0)
        throw new Error(
          `edge ${i} carries bow; its path is already described by the side it hangs off, out and span`,
        );
    } else if (bow !== 0 && e.via?.length)
      throw new Error(
        `edge ${i} carries bow; its path is already described by via`,
      );
    // A loop is an edge: it differs in its points and in nothing else, so
    // dotted, label, lx, ly and anchor keep working below by not being asked
    // about here.
    return loop
      ? loopPoints(
          anchor(from, e.from[1]),
          e.from[1],
          e.out ?? LOOP_OUT,
          e.span ?? LOOP_SPAN,
        )
      : bow !== 0
        ? bowPoints(anchor(from, e.from[1]), anchor(to, e.to[1]), bow)
        : [anchor(from, e.from[1]), ...(e.via || []), anchor(to, e.to[1])];
  });

  // `??` and not `||`, so `hop: false` is an opt-out of a diagram-wide switch
  // rather than indistinguishable from leaving the field out.
  const over = edgeList.map((e) => e.hop ?? options.hops ?? false);
  edgeList.forEach((e, i) => {
    const pts = paths[i] as Point[];
    const opts = {
      dotted: !!e.dotted,
      color: e.dotted ? theme.accent : theme.ink,
    };
    // Nothing hops, so nothing is cut, and the drawing is what it always was.
    if (!over.some(Boolean)) {
      p.arrow(pts, opts);
    } else {
      const runs = hopRuns(pts, paths, i, over);
      runs.forEach((r, k) => {
        // The arrowhead belongs to the run carrying the edge's last point.
        if (r.length > 1) {
          if (k === runs.length - 1) p.arrow(r, opts);
          else p.stroke(r, opts);
        }
      });
    }
    if (e.label) {
      if (typeof e.lx !== 'number' || typeof e.ly !== 'number')
        throw new Error(
          `edge ${i} has label "${e.label}" but lx and ly are not both numbers; labels are placed by hand because text is never measured`,
        );
      p.label(e.lx, e.ly, [e.label], {
        size: EDGE_SIZE,
        color: e.dotted ? theme.accent : theme.muted,
        anchor: e.anchor || 'middle',
      });
    }
  });
  const afterEdges = svg.children.length;

  // A Map rather than an object literal: an object would inherit
  // Object.prototype, so a node claiming shape "toString" would find a
  // function there and silently skip the unknown-shape error.
  const shapes = new Map<
    string,
    (x: number, y: number, w: number, h: number, opts?: StrokeOptions) => void
  >([
    ['box', p.rect],
    ['pill', p.pill],
    ['diamond', p.diamond],
  ]);

  nodes
    .filter((n) => n.shape !== 'group')
    .forEach((n) => {
      const shape = shapes.get(n.shape);
      if (!shape)
        throw new Error(
          `node "${n.id}" has unknown shape "${n.shape}"; expected group, box, pill or diamond`,
        );
      shape(n.x, n.y, n.w, n.h, {
        color: n.accent ? theme.pen : theme.ink,
      });
      // Two boxes, deliberately: the inset one says which diagonals are ruled,
      // which is what it has always said and what keeps a hatched shape on the
      // same lines as a hatched box beside it, and the node's own box is what
      // `hatchClip` needs to stand a clip `HATCH_INSET` inside the outline it
      // just drew. A box has no clip and falls through to the closed form the
      // reference renderer uses.
      if (n.hatch)
        p.hatch(
          n.x + HATCH_INSET,
          n.y + HATCH_INSET,
          n.w - HATCH_INSET * 2,
          n.h - HATCH_INSET * 2,
          theme.pen,
          hatchClip(n.shape, n.x, n.y, n.w, n.h),
        );
      if (n.lines)
        p.label(n.x + n.w / 2, n.y + n.h / 2, n.lines, {
          size: n.size || SIZE,
        });
    });
  const afterShapes = svg.children.length;

  // Over what it spans and under the annotation that explains it, which is the
  // whole reason this phase sits between the shapes and the notes rather than
  // at either end of them.
  (diagram.braces || []).forEach((b, i) => {
    p.stroke(bracePoints(b), { color: theme.pen });
    if (b.lines) {
      if (typeof b.lx !== 'number' || typeof b.ly !== 'number')
        throw new Error(
          `brace ${i} has lines but lx and ly are not both numbers; labels are placed by hand because text is never measured`,
        );
      p.label(b.lx, b.ly, b.lines, {
        color: theme.pen,
        anchor: b.anchor || 'start',
      });
    }
  });

  (diagram.notes || []).forEach((nt, i) => {
    p.label(nt.x, nt.y, nt.lines, {
      size: NOTE_SIZE,
      color: theme.accent,
      anchor: nt.anchor || 'start',
    });
    // A pointer bows on the same terms an edge does, and is refused on the
    // same ones. The two ends are given as points rather than found from
    // sides, which changes where they come from and nothing about the curve
    // between them. Asked only of a pointer that is drawn: with one end
    // missing there is no path for either field to describe.
    if (nt.arrowFrom && nt.arrowTo) {
      const bow = nt.bow ?? 0;
      if (bow !== 0 && nt.via?.length)
        throw new Error(
          `note ${i} carries bow; its path is already described by via`,
        );
      p.arrow(
        bow !== 0
          ? bowPoints(nt.arrowFrom, nt.arrowTo, bow)
          : [nt.arrowFrom, ...(nt.via || []), nt.arrowTo],
        {
          dotted: true,
          color: theme.accent,
          amplitude: NOTE_AMP,
        },
      );
    }
  });

  (diagram.raw || []).forEach((fn) => {
    fn(p);
  });

  // The order a hand would draw in, stamped on afterwards. It is not the order
  // the document is in: a shape sits over the connectors that reach it, so it
  // is emitted after them, and a label is written after the thing it names
  // whatever phase drew either. Nothing here reorders anything - the z-order,
  // the seeded sequence and the elements themselves are exactly what they were
  // - and only the number differs from the document index it is read off.
  if (options.order) {
    const children = Array.from(svg.children);
    // The phase a child came from is which of the three marks its document
    // index falls under; text is lifted out of its phase and ranked last.
    //
    // Ranks 2 and 3 are told apart only by where the phases sit: annotations
    // are emitted after the shapes, so within one rank the index tiebreak
    // would put them after the connectors anyway, and ranking them 2 renders
    // byte-identically - verified across fourteen diagram shapes and three
    // seeds. They are numbered apart because they are different phases, and if
    // the emission order ever changed so that an annotation could precede an
    // edge, that equivalence would lapse with nothing to notice.
    const rank = (k: number) =>
      k < afterGroups ? 0 : k < afterEdges ? 2 : k < afterShapes ? 1 : 3;
    children
      .map((el, k) => ({ el, k, r: el.tagName === 'text' ? 4 : rank(k) }))
      // Within a rank the pen's own emission order stands: it is already hand
      // order, a connector before its barbs and a shape before its hatch.
      .sort((a, b) => a.r - b.r || a.k - b.k)
      .forEach(({ el }, i) => {
        // `pathLength` normalises a path to one unit, so a single keyframe
        // draws a 400 px connector and a 12 px arrowhead barb at the same
        // rate. A dashed path is left out of it: `pathLength` rescales every
        // distance along the path and `stroke-dasharray` is one, so the dashes
        // stretch past the end of the line and the stroke renders solid -
        // measured at 90 inked px of 400 plain, 400 of 400 with it.
        //
        // What it tests is the *attribute*, so a dash a page put on with a CSS
        // rule is invisible to it: such a path is normalised like any solid one
        // and renders solid. There is no fix on this line. Seeing a computed
        // dash needs `getComputedStyle`, which exists on this path and not on
        // `renderToString`'s - `markup.ts` is a six-member shim - so a DOM-only
        // guard would fork the two renderers and break the byte-parity they are
        // held to. Style your dashes with the `dotted` field, which the pen
        // writes as an attribute.
        if (
          el.tagName === 'path' &&
          el.getAttribute('stroke-dasharray') === null
        )
          el.setAttribute('pathLength', '1');
        // Ahead of whatever style the element already carries, so a `<text>`
        // keeps its fill and font-size.
        //
        // Truncated to three decimals, not rounded: the quotient is always
        // below one, but `toFixed` rounds, so from 2000 elements up - 250
        // plain boxes, or 32 hatched nodes at 200x120 - the last of them would
        // be written `1.000`, outside the `[0, 1)` this option promises. Both
        // counts are measured, and 2000 is where it starts, not where it gets
        // bad.
        //
        // The thousandths come off an integer numerator, which is one division
        // and so one rounding, and is the floor of the exact fraction by
        // construction. Scaling a quotient instead - `Math.trunc((i /
        // children.length) * 1000)` - rounds twice, and is the same number
        // only as long as the second rounding stays under the first's slack.
        // The two were compared exhaustively over every pair to 20000 and over
        // every exactly-divisible pair to a million, and never disagreed - so
        // this is a rounding not taken rather than a bug seen.
        el.setAttribute(
          'style',
          `--ps-i:${(Math.floor((i * 1000) / children.length) / 1000).toFixed(3)};${el.getAttribute('style') || ''}`,
        );
      });
  }
}
