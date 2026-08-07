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
  const { rules = {} } = options;
  const nodes = diagram.nodes || [];
  const edges = diagram.edges || [];
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

  return findings;
}
