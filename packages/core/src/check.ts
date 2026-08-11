import { EDGE_SIZE, NOTE_SIZE, SIZE, TITLE_DX, TITLE_SIZE } from './constants';
import {
  type Box,
  boxToSegment,
  contains,
  edgePath,
  INFLATE,
  intersects,
  labelBox,
  pointToSegment,
} from './geometry';
import { bracePoints } from './sample';
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
  | 'orphan-node'
  | 'edge-overlap';

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
  /** What is involved: `node "gate"`, `edge 3`, `brace 1`, `note 0`. */
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
  'edge-overlap': 'warning',
};

// Errors first. Not alphabetical: `error` sorting before `warning` there is a
// coincidence of English, and the day a third severity appears it would put
// it in the wrong place.
const RANK: Record<Severity, number> = { error: 0, warning: 1 };

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
  const {
    viewBox,
    clearance = 4,
    glyphWidth = 0.55,
    padding = 8,
    rules = {},
  } = options;
  const nodes = diagram.nodes || [];
  const edges = diagram.edges || [];
  const braces = diagram.braces || [];
  const notes = diagram.notes || [];
  const findings: Finding[] = [];

  const add = (
    rule: RuleId,
    message: string,
    at: Point,
    subjects: string[],
    estimated?: true,
  ) => {
    const severity = rules[rule] ?? DEFAULTS[rule];
    // `off` is checked here rather than around each rule: a rule that runs
    // and discards costs microseconds, and gating every call site is where a
    // rule ends up silently un-switchable-off.
    if (severity !== 'off')
      findings.push({
        rule,
        severity,
        message,
        at,
        subjects,
        ...(estimated ? { estimated } : {}),
      });
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

  // Nothing here measures text, so this is the estimate and every finding it
  // produces says so. It over-states width on purpose: a false warning costs
  // one edit, a missed overflow costs a picture nobody looks at again.
  for (const n of nodes) {
    if (!n.lines) continue;
    const group = n.shape === 'group';
    const size = group ? TITLE_SIZE : n.size || SIZE;
    const width =
      n.lines.reduce((m, l) => Math.max(m, l.length), 0) * size * glyphWidth;
    // A group's title starts TITLE_DX in from the left corner and runs right,
    // so it has that much less room than a label centred in its box.
    const room = group ? n.w - TITLE_DX - padding : n.w - 2 * padding;
    if (width > room)
      add(
        'text-overflow',
        `the label on node "${n.id}" needs about ${Math.round(width)}px and has ${Math.round(room)}px; widen the box or shorten the text`,
        [n.x, n.y],
        [`node "${n.id}"`],
        true,
      );
  }

  // The drawn line is not the ideal one: it wanders by up to half the jitter
  // amplitude and the stroke is half its width to each side. So the clearance
  // a caller asks for is measured from the ink, not from the arithmetic.
  const margin = clearance + INFLATE;
  // A path with no points at all is an edge nothing is drawn for - a `bow`
  // that is not a finite number samples to nothing - and no rule below has
  // anything to say about ink that is nowhere.
  const paths: { i: number; path: Point[] }[] = [];
  edges.forEach((e, i) => {
    const path = edgePath(e, byId);
    if (path?.length) paths.push({ i, path });
  });

  // Two connectors drawn along one another are one line in the picture and two
  // edges in the data, which is the defect here a caller cannot see by looking:
  // the drawing looks deliberate. `bow` is the fix, so the message names it.
  //
  // "Along their whole length" is: every sampled point of each path lies within
  // `2 * INFLATE` of some segment of the other, measured both ways round. Every
  // point, because two paths that meet and part - a crossing, or a pair sharing
  // one anchor - have points at the far end of each that the other never comes
  // near. Both ways round, because one edge lying along part of a longer one
  // leaves the rest of that one nowhere near it, and a T is not a duplicate.
  //
  // `2 * INFLATE` rather than the caller's `clearance`: INFLATE is half the
  // width of the ink, jitter included, so two ideal paths closer than twice it
  // are two strokes whose ink is the same ink. That is a fact about what the
  // renderer lays down, not a preference about how much air a label wants, so
  // it is not an option. A straight edge and one bowed 4 px off it still draw
  // as one line and are reported; at 5 they are visibly two and this is quiet.
  const along = (p: Point[], q: Point[]) =>
    p.every((r) =>
      q
        .slice(1)
        .some((s, k) => pointToSegment(r, q[k] as Point, s) < 2 * INFLATE),
    );

  // `bow` is the fix for a pair of connectors and a throw on a pair of
  // self-transitions, whose path is already described by the side they hang
  // off, `out` and `span`. A message naming a field `draw` refuses would send
  // the caller from a warning to an exception, so the pair of loops - the one
  // shape `bow` cannot separate - is told what does separate it.
  const loops = (n: number) => edges[n]?.from[0] === edges[n]?.to[0];

  paths.forEach(({ i, path }, k) => {
    for (const b of paths.slice(k + 1))
      if (along(path, b.path) && along(b.path, path))
        add(
          'edge-overlap',
          `edges ${i} and ${b.i} are drawn one on top of the other; give one of them ${loops(i) && loops(b.i) ? 'its own out and span' : 'a bow'}`,
          // The start of the earlier edge: on the pair this rule exists for -
          // an edge and its reverse - it is an end both lines touch, which one
          // leaves from and the other arrives at.
          path[0] as Point,
          [`edge ${i}`, `edge ${b.i}`],
        );
  });

  // Every line the picture actually lays down, named the way a finding names
  // it rather than numbered. A brace is drawn too, so a label can lie under one
  // and a point on one can leave the frame - and `edge 2` said about a brace
  // points at the wrong thing, or at nothing when a diagram has more braces
  // than edges. `cut` is how many points at each end go unmeasured for
  // `out-of-bounds`: one on an edge, whose anchors sit on a node the rule above
  // already reports, and none on a brace, whose ends are the caller's own two
  // points with nothing behind them to be reported instead.
  const drawn = paths.map(({ i, path }) => ({
    subject: `edge ${i}`,
    path,
    cut: 1,
  }));
  drawn.push(
    ...braces.map((b, i) => ({
      subject: `brace ${i}`,
      path: bracePoints(b),
      cut: 0,
    })),
  );

  // The first line this box is too close to, if any. A label sitting on the
  // very line it labels counts: that is exactly the defect this rule exists
  // for.
  const struckBy = (box: Box) =>
    drawn.find(({ path }) =>
      path
        .slice(1)
        .some((p, k) => boxToSegment(box, path[k] as Point, p) < margin),
    );

  edges.forEach((e, i) => {
    if (!e.label || typeof e.lx !== 'number' || typeof e.ly !== 'number')
      return;
    const hit = struckBy(
      labelBox(
        e.lx,
        e.ly,
        [e.label],
        EDGE_SIZE,
        e.anchor || 'middle',
        glyphWidth,
      ),
    );
    if (hit)
      add(
        'label-collision',
        hit.subject === `edge ${i}`
          ? `the label on edge ${i} lies on the line it labels; move it clear or put the text in a box instead`
          : `the label on edge ${i} lies under ${hit.subject}, which will be drawn through it`,
        [e.lx, e.ly],
        [`edge ${i}`, hit.subject],
        true,
      );
  });

  braces.forEach((b, i) => {
    if (!b.lines || typeof b.lx !== 'number' || typeof b.ly !== 'number')
      return;
    const hit = struckBy(
      labelBox(b.lx, b.ly, b.lines, SIZE, b.anchor || 'start', glyphWidth),
    );
    if (hit)
      add(
        'label-collision',
        hit.subject === `brace ${i}`
          ? `the label on brace ${i} lies on the brace it labels; move it clear of the tip`
          : `the label on brace ${i} lies under ${hit.subject}, which will be drawn through it`,
        [b.lx, b.ly],
        [`brace ${i}`, hit.subject],
        true,
      );
  });

  notes.forEach((nt, i) => {
    const hit = struckBy(
      labelBox(
        nt.x,
        nt.y,
        nt.lines,
        NOTE_SIZE,
        nt.anchor || 'start',
        glyphWidth,
      ),
    );
    if (hit)
      add(
        'label-collision',
        `note ${i} lies under ${hit.subject}, which will be drawn through it`,
        [nt.x, nt.y],
        [`note ${i}`, hit.subject],
        true,
      );
  });

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

    // The path as drawn, both ends dropped. On every shape but a loop the ends
    // are anchors on a node's own side, so an anchor outside the frame is a
    // node outside the frame and the rule above has it already. A loop is the
    // exception: its ends sit `span / 2` along the side, and a `span` wider
    // than the side puts them past the corners of a node that is wholly
    // inside - which the schema tells the caller is theirs to notice. Dropping
    // both ends is still right, because keeping them would add a duplicate
    // finding for every edge attached to a node the rule above already names.
    //
    // What is left is exactly the `via` corners on a straight run - a loop's
    // `via` never reaches the path at all - and the curve on a loop or a bow.
    // An edge naming a node the diagram does not define has no path here, so
    // its corners go unwalked; `draw` throws on it before anything is drawn,
    // and no rule reports the unknown id either.
    //
    // The first point outside and not every one, unlike the corner-by-corner
    // walk this replaces: a curve is sampled into a dozen points or more and a
    // frame it leaves it leaves along a stretch of them, so reporting each
    // would bury one defect under ten copies of itself. The cost is that a
    // second corner outside the frame needs a second run to see, which is the
    // one place this file trades away its own "all of them at once".
    for (const { subject, path, cut } of drawn) {
      const p = path
        .slice(cut, path.length - cut)
        .find(([x, y]) => outside(x, y));
      // Rounded in the message, because the point is a sample and the true
      // crossing lies between it and the one before: the digits after the
      // point are precision the number has not got. `at` keeps them, because
      // it is a coordinate to go and look at rather than prose, and a rounded
      // one can land back inside the frame it is reporting an escape from.
      if (p)
        add(
          'out-of-bounds',
          `${subject} reaches outside the viewBox at (${Math.round(p[0])}, ${Math.round(p[1])}), so part of it is clipped away`,
          p,
          [subject],
        );
    }

    edges.forEach((e, i) => {
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

    braces.forEach((b, i) => {
      if (
        typeof b.lx === 'number' &&
        typeof b.ly === 'number' &&
        outside(b.lx, b.ly)
      )
        add(
          'out-of-bounds',
          `the label on brace ${i} sits outside the viewBox and will not be seen`,
          [b.lx, b.ly],
          [`brace ${i}`],
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

  // Sorted rather than returned in the order the rules happen to run, so that
  // adding a rule or reordering one does not reorder the output. Comparing
  // rule ids with < rather than localeCompare: nothing in this package is
  // allowed to depend on a locale, and an array whose order changes with the
  // machine's language is not snapshot-testable.
  return findings.sort(
    (a, b) =>
      RANK[a.severity] - RANK[b.severity] ||
      (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0) ||
      a.at[0] - b.at[0] ||
      a.at[1] - b.at[1],
  );
}
