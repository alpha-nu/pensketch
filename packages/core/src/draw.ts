import {
  EDGE_SIZE,
  GROUP_AMP,
  GROUP_W,
  HATCH_INSET,
  NOTE_AMP,
  NOTE_SIZE,
  SIZE,
  TITLE_DX,
  TITLE_DY,
  TITLE_SIZE,
} from './constants';
import { pen } from './pen';
import { resolveTheme } from './theme';
import type {
  Diagram,
  DiagramNode,
  DrawOptions,
  Point,
  Side,
  StrokeOptions,
} from './types';

export function anchor(node: DiagramNode, side: Side): Point {
  const sides: Record<Side, Point> = {
    t: [node.x + node.w / 2, node.y],
    b: [node.x + node.w / 2, node.y + node.h],
    l: [node.x, node.y + node.h / 2],
    r: [node.x + node.w, node.y + node.h / 2],
  };
  return sides[side];
}

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
  for (const n of nodes) byId.set(n.id, n);

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
      throw new Error(`edge ${i} references unknown node "${e.from[0]}"`);
    const to = byId.get(e.to[0]);
    if (!to) throw new Error(`edge ${i} references unknown node "${e.to[0]}"`);
    const pts: Point[] = [
      anchor(from, e.from[1]),
      ...(e.via || []),
      anchor(to, e.to[1]),
    ];
    p.arrow(pts, {
      dotted: !!e.dotted,
      color: e.dotted ? theme.accent : theme.ink,
    });
    if (e.label) {
      if (typeof e.lx !== 'number' || typeof e.ly !== 'number')
        throw new Error(`edge ${i} has a label but no numeric lx and ly`);
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
        throw new Error(`node "${n.id}" has unknown shape "${n.shape}"`);
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

  (diagram.notes || []).forEach((nt) => {
    p.label(nt.x, nt.y, nt.lines, {
      size: NOTE_SIZE,
      color: theme.accent,
      anchor: nt.anchor || 'start',
    });
    if (nt.arrowFrom && nt.arrowTo)
      p.arrow([nt.arrowFrom, ...(nt.via || []), nt.arrowTo], {
        dotted: true,
        color: theme.accent,
        amplitude: NOTE_AMP,
      });
  });

  (diagram.raw || []).forEach((fn) => {
    fn(p);
  });
}
