import {
  AMP,
  ARC_STEPS,
  DASH,
  END_DAMP,
  HATCH_AMP,
  HATCH_GAP,
  HATCH_W,
  HEAD_AMP,
  HEAD_LEN,
  HEAD_SPREAD,
  LINE_H,
  MIN_STEPS,
  OP1,
  OP2,
  OVERSHOOT,
  PASS2_W,
  PILL_AMP,
  PILL_JX,
  PILL_JY,
  PILL_STEPS,
  SEED,
  SEG_LEN,
  SIZE,
  WASH_RX,
  WIDTH,
} from './constants';
import { mulberry32 } from './rng';
import { resolveTheme } from './theme';
import type {
  LabelOptions,
  Pen,
  PenOptions,
  Point,
  StrokeOptions,
} from './types';

const NS = 'http://www.w3.org/2000/svg';

/**
 * Binds a set of hand-drawn primitives to `svg`, all driven by one seeded
 * sequence. Existing children are left alone (only `draw` clears the
 * element), so a pen can add to a finished diagram, and several pens can
 * share one `<svg>`, each with its own seed.
 *
 * @example
 * ```js
 * import { pen } from '@pensketch/core';
 *
 * const p = pen(document.querySelector('svg'), { seed: 3 });
 * p.rect(20, 20, 200, 90);
 * p.label(120, 65, 'hand-drawn box');
 * p.arrow([[220, 65], [320, 65]]);
 * p.pill(320, 40, 150, 50);
 * p.label(395, 65, ['a pill', '(two lines)']);
 * ```
 */
export function pen(svg: SVGSVGElement, options: PenOptions = {}): Pen {
  const rng = mulberry32(options.seed ?? SEED);
  const theme = resolveTheme(options.theme);

  // Every jittered coordinate consumes exactly one number from the seeded
  // sequence, so the order of these calls is itself part of the output.
  const j = (v: number, a: number) => v + (rng() - 0.5) * a;

  // The owner document, never a global one: the same code has to render
  // under a browser, jsdom or any other conforming DOM.
  function el(name: string, attrs: Record<string, string | number>) {
    const e = svg.ownerDocument.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    svg.appendChild(e);
    return e;
  }

  // One hand-drawn traversal of a polyline: each leg is cut into ~26 px
  // steps and every point is jittered, with the last step of a leg damped so
  // corners stay recognisable.
  function pass(pts: Point[], amp: number) {
    const [px, py] = pts[0] as Point;
    let d = `M${j(px, amp)} ${j(py, amp)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1] as Point;
      const [x1, y1] = pts[i] as Point;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(MIN_STEPS, Math.round(len / SEG_LEN));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        d += ` L${j(x0 + (x1 - x0) * t, s === steps ? amp * END_DAMP : amp)} ${j(
          y0 + (y1 - y0) * t,
          s === steps ? amp * END_DAMP : amp,
        )}`;
      }
    }
    return d;
  }

  // Two passes over the same polyline, each re-jittered: the lighter, thinner
  // second pass is what reads as pen pressure.
  function stroke(
    pts: Point[],
    {
      color = theme.ink,
      dotted,
      width = WIDTH,
      amplitude = AMP,
    }: StrokeOptions = {},
  ) {
    for (let k = 0; k < 2; k++) {
      el('path', {
        d: pass(pts, amplitude),
        fill: 'none',
        stroke: color,
        'stroke-width': k ? width * PASS2_W : width,
        'stroke-linecap': 'round',
        opacity: k ? OP2 : OP1,
        ...(dotted ? { 'stroke-dasharray': DASH } : {}),
      });
    }
  }

  function arrow(pts: Point[], opts: StrokeOptions = {}) {
    stroke(pts, opts);
    const [x1, y1] = pts[pts.length - 2] as Point;
    const [x2, y2] = pts[pts.length - 1] as Point;
    const a = Math.atan2(y2 - y1, x2 - x1);
    // The barbs are never dotted: a dashed arrowhead reads as noise.
    for (const off of [HEAD_SPREAD, -HEAD_SPREAD])
      stroke(
        [
          [
            x2 - HEAD_LEN * Math.cos(a - off),
            y2 - HEAD_LEN * Math.sin(a - off),
          ],
          [x2, y2],
        ],
        { ...opts, dotted: false, amplitude: HEAD_AMP },
      );
  }

  // Four independent sides, each overshooting its corners by up to 4 px -
  // the overshoot is what keeps a rectangle from looking machine-made.
  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: StrokeOptions = {},
  ) {
    const o = OVERSHOOT;
    stroke(
      [
        [x - o * rng(), y],
        [x + w + o * rng(), y],
      ],
      opts,
    );
    stroke(
      [
        [x + w, y - o * rng()],
        [x + w, y + h + o * rng()],
      ],
      opts,
    );
    stroke(
      [
        [x + w + o * rng(), y + h],
        [x - o * rng(), y + h],
      ],
      opts,
    );
    stroke(
      [
        [x, y + h + o * rng()],
        [x, y - o * rng()],
      ],
      opts,
    );
  }

  function pill(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: StrokeOptions = {},
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const pts: Point[] = [];
    for (let i = 0; i <= PILL_STEPS; i++) {
      const a = (i / PILL_STEPS) * 2 * Math.PI;
      pts.push([
        cx + Math.cos(a) * j(rx, PILL_JX),
        cy + Math.sin(a) * j(ry, PILL_JY),
      ]);
    }
    stroke(pts, { ...opts, amplitude: PILL_AMP });
  }

  // A curve here is a denser point list and nothing else, which is what lets
  // it fall through the same two passes as a straight line. ARC_STEPS counts a
  // full turn, so a partial sweep takes its share and a short arc is cut no
  // coarser than a long one.
  function arc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    from: number,
    to: number,
    opts: StrokeOptions = {},
  ) {
    const sweep = to - from;
    const steps = Math.max(
      MIN_STEPS,
      Math.round((ARC_STEPS * Math.abs(sweep)) / (2 * Math.PI)),
    );
    const pts: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      // `sweep * (i / steps)`, not `(sweep * i) / steps`: the fraction first
      // is the association `pill` uses, so a full turn lands on its angles to
      // the last bit rather than to a tolerance.
      const a = from + sweep * (i / steps);
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    stroke(pts, opts);
  }

  function diamond(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: StrokeOptions = {},
  ) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    stroke(
      [
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
        [cx, y],
      ],
      opts,
    );
  }

  // Diagonals across the box, clipped to it at both ends.
  function hatch(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string = theme.ink,
  ) {
    for (let i = -h; i < w; i += HATCH_GAP)
      stroke(
        [
          [Math.max(x, x + i), i < 0 ? y - i : y],
          [Math.min(x + w, x + i + h), i + h > w ? y + (w - i) : y + h],
        ],
        { color, width: HATCH_W, amplitude: HATCH_AMP },
      );
  }

  // One <text> per line, stacked around (cx, cy). No text measurement here
  // or anywhere: line breaks are the caller's decision.
  function label(
    cx: number,
    cy: number,
    lines: string | string[],
    {
      size = SIZE,
      color = theme.ink,
      anchor = 'middle',
      lineHeight = LINE_H,
    }: LabelOptions = {},
  ) {
    const ls = typeof lines === 'string' ? [lines] : lines;
    ls.forEach((ln, i) => {
      const t = el('text', {
        x: cx,
        y: cy + (i - (ls.length - 1) / 2) * size * lineHeight,
        'text-anchor': anchor,
        'dominant-baseline': 'middle',
        style: `fill:${color};font-size:${size}px`,
      });
      t.textContent = ln;
    });
  }

  function wash(x: number, y: number, w: number, h: number, fill = theme.wash) {
    el('rect', { x, y, width: w, height: h, fill, rx: WASH_RX });
  }

  return { stroke, arrow, rect, pill, arc, diamond, hatch, label, wash, rng };
}
