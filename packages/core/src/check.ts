import { contains, intersects } from './geometry';
import type { Diagram, DiagramNode, Point } from './types';

/**
 * How much a finding matters. An `error` is a defect in the picture — two
 * boxes on top of each other, an id used twice. A `warning` is something that
 * is usually a mistake and occasionally deliberate.
 */
export type Severity = 'error' | 'warning';

/** Every defect the checker knows how to name. */
export type RuleId =
  | 'duplicate-id'
  | 'node-overlap'
  | 'out-of-bounds'
  | 'label-collision'
  | 'text-overflow'
  | 'group-escape'
  | 'orphan-node';

/** One defect, in enough detail to fix it without seeing the drawing. */
export interface Finding {
  /** Which rule fired. Stable across releases. */
  rule: RuleId;
  /** Whether this is a defect or a suspicion. */
  severity: Severity;
  /** One sentence, naming the fix where there is an obvious one. */
  message: string;
  /** Where to look, in the diagram's own coordinate space. */
  at: Point;
  /** What is involved: `node "gate"`, `edge 3`, `note 0`. */
  subjects: string[];
  /**
   * Present when the finding rests on the text-width estimate. Text is never
   * measured, so a finding that depends on its width is a strong suspicion
   * rather than a fact, and says so.
   */
  estimated?: true;
}

/** Everything the caller can move. Every default is stated. */
export interface CheckOptions {
  /**
   * `[minX, minY, width, height]`, the same four numbers the `<svg>` carries.
   * Without it, `out-of-bounds` cannot run and does not.
   */
  viewBox?: readonly [number, number, number, number];
  /** Gap a label must keep from a drawn stroke, in px. Default: `4`. */
  clearance?: number;
  /**
   * Glyph advance as a fraction of the font size, for the width estimate.
   * Default: `0.55`, measured against the documented handwriting stack and
   * deliberately wider than every real label in it.
   */
  glyphWidth?: number;
  /** Gap a label must keep inside its own node's box, in px. Default: `8`. */
  padding?: number;
  /** Raise, lower, or switch off individual rules. */
  rules?: Partial<Record<RuleId, Severity | 'off'>>;
}

// What each rule is worth when the caller says nothing. Errors are defects in
// the picture; warnings are things that are usually a mistake and sometimes
// deliberate.
const DEFAULTS: Record<RuleId, Severity> = {
  'duplicate-id': 'error',
  'node-overlap': 'error',
  'out-of-bounds': 'error',
  'label-collision': 'warning',
  'text-overflow': 'warning',
  'group-escape': 'warning',
  'orphan-node': 'warning',
};

/**
 * Reports the layout defects a type system cannot see: overlaps, labels lying
 * under connectors, text wider than its box. It never renders, never touches
 * a DOM, never measures text, and never changes the diagram — a finding says
 * where the problem is and leaves the fix to the caller.
 *
 * Findings come back sorted by severity, then rule, then position, so the
 * same diagram always produces the same array.
 *
 * @example
 * ```js
 * import { check } from '@pensketch/core/check';
 *
 * const findings = check(diagram, { viewBox: [0, 0, 880, 340] });
 * for (const f of findings) console.log(f.severity, f.rule, f.message);
 * ```
 */
export function check(diagram: Diagram, options: CheckOptions = {}): Finding[] {
  const { viewBox, rules = {} } = options;
  const nodes = diagram.nodes || [];
  const edges = diagram.edges || [];
  const notes = diagram.notes || [];
  const findings: Finding[] = [];

  const add = (
    rule: RuleId,
    message: string,
    at: Point,
    subjects: string[],
  ) => {
    const severity = rules[rule] ?? DEFAULTS[rule];
    // `off` is checked here rather than around each rule: a rule that runs
    // and discards costs microseconds, and gating every call site is where a
    // rule ends up silently un-switchable-off.
    if (severity !== 'off')
      findings.push({ rule, severity, message, at, subjects });
  };

  // An id names a node, so two nodes cannot share one. `draw` throws on this;
  // the checker reports it alongside everything else, which is the difference
  // between one round trip and five.
  const byId = new Map<string, DiagramNode>();
  for (const n of nodes) {
    const first = byId.get(n.id);
    if (first)
      add(
        'duplicate-id',
        `two nodes share the id "${n.id}", at (${first.x}, ${first.y}) and (${n.x}, ${n.y}); ids must be unique and draw throws on a repeat`,
        [n.x, n.y],
        [`node "${n.id}"`],
      );
    else byId.set(n.id, n);
  }

  // A node nothing points at is far more often a typo in an edge than a
  // deliberate island - which is why it is a warning rather than an error,
  // and why it can be switched off for the diagrams where it is neither.
  const named = new Set<string>();
  for (const e of edges) {
    named.add(e.from[0]);
    named.add(e.to[0]);
  }
  for (const n of nodes)
    if (n.shape !== 'group' && !named.has(n.id))
      add(
        'orphan-node',
        `no edge names node "${n.id}"; check the from and to of every edge that should reach it`,
        [n.x, n.y],
        [`node "${n.id}"`],
      );

  // Groups are regions, so they overlap everything by design; only the drawn
  // shapes are compared against each other.
  const shapes = nodes.filter((n) => n.shape !== 'group');
  shapes.forEach((a, i) => {
    for (const b of shapes.slice(i + 1))
      if (intersects(a, b))
        add(
          'node-overlap',
          `nodes "${a.id}" and "${b.id}" overlap; one is drawn over the other`,
          [Math.max(a.x, b.x), Math.max(a.y, b.y)],
          [`node "${a.id}"`, `node "${b.id}"`],
        );
  });

  // Partial intersection only. A node wholly outside a group is in another
  // lane and a node wholly inside is where it belongs; the half-in case is
  // the only one that is unambiguously a mistake, so it is the whole rule -
  // no guessing about which group a node was meant to be in.
  for (const g of nodes.filter((n) => n.shape === 'group'))
    for (const n of shapes)
      if (intersects(g, n) && !contains(g, n))
        add(
          'group-escape',
          `node "${n.id}" is half inside group "${g.id}"; move it wholly in or wholly out`,
          [n.x, n.y],
          [`node "${n.id}"`, `node "${g.id}"`],
        );

  // Only when the caller says what the picture is cropped to. Everything else
  // here is decidable from the diagram alone; this is not, and inventing a
  // frame would report a diagram nobody is drawing.
  if (viewBox) {
    const [vx, vy, vw, vh] = viewBox;
    const outside = (x: number, y: number) =>
      x < vx || y < vy || x > vx + vw || y > vy + vh;

    for (const n of nodes)
      if (outside(n.x, n.y) || outside(n.x + n.w, n.y + n.h))
        add(
          'out-of-bounds',
          `node "${n.id}" reaches outside the viewBox, so part of it is clipped away`,
          [n.x, n.y],
          [`node "${n.id}"`],
        );

    edges.forEach((e, i) => {
      for (const [x, y] of e.via || [])
        if (outside(x, y))
          add(
            'out-of-bounds',
            `edge ${i} turns at (${x}, ${y}), outside the viewBox, so the arrow leaves the picture`,
            [x, y],
            [`edge ${i}`],
          );
      if (
        typeof e.lx === 'number' &&
        typeof e.ly === 'number' &&
        outside(e.lx, e.ly)
      )
        add(
          'out-of-bounds',
          `the label on edge ${i} sits outside the viewBox and will not be seen`,
          [e.lx, e.ly],
          [`edge ${i}`],
        );
    });

    notes.forEach((nt, i) => {
      if (outside(nt.x, nt.y))
        add(
          'out-of-bounds',
          `note ${i} sits outside the viewBox and will not be seen`,
          [nt.x, nt.y],
          [`note ${i}`],
        );
    });
  }

  return findings;
}
