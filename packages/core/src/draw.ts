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
import { bowPoints, bracePoints, loopPoints } from './sample';
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

  (diagram.edges || []).forEach((e, i) => {
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
    const pts: Point[] = loop
      ? loopPoints(
          anchor(from, e.from[1]),
          e.from[1],
          e.out ?? LOOP_OUT,
          e.span ?? LOOP_SPAN,
        )
      : bow !== 0
        ? bowPoints(anchor(from, e.from[1]), anchor(to, e.to[1]), bow)
        : [anchor(from, e.from[1]), ...(e.via || []), anchor(to, e.to[1])];
    p.arrow(pts, {
      dotted: !!e.dotted,
      color: e.dotted ? theme.accent : theme.ink,
    });
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
      if (n.hatch)
        p.hatch(
          n.x + HATCH_INSET,
          n.y + HATCH_INSET,
          n.w - HATCH_INSET * 2,
          n.h - HATCH_INSET * 2,
          theme.pen,
        );
      if (n.lines)
        p.label(n.x + n.w / 2, n.y + n.h / 2, n.lines, {
          size: n.size || SIZE,
        });
    });

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
}
