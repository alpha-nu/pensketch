import { describe, expect, it } from 'vitest';
import * as subpath from '../src/check';
import {
  type CheckOptions,
  check,
  type RuleId,
  type Severity,
} from '../src/check';
import { INFLATE } from '../src/geometry';
import {
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type DrawOptions,
  draw,
} from '../src/index';
import { makeSvg } from './helpers';

const box = (id: string, x: number, y: number): DiagramNode => ({
  id,
  shape: 'box',
  x,
  y,
  w: 100,
  h: 40,
});

const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);

describe('check', () => {
  // Equality, not containment, and the same treatment the root entry gets in
  // api.test.ts: a helper exported by accident is as much a breach as a
  // missing one, and only the package can take it back once it has shipped.
  // The built artifact is held to this same list by `npm run exports`.
  it('exports exactly one runtime name', () => {
    expect(Object.keys(subpath)).toEqual(['check']);
  });

  it('reports nothing about a diagram with nothing in it', () => {
    expect(check({})).toEqual([]);
  });

  // The union's own pin, and the reason it is a table rather than a list: a
  // `RuleId` erases at runtime, so what holds the two together is
  // `satisfies Record<RuleId, Severity>` - a member added to the union with no
  // place here fails the typecheck, and so does one renamed out from under it.
  // A published id never changes meaning; the union grows, and this is where
  // growing it is noticed.
  const EVERY_RULE = {
    'duplicate-id': 'error',
    'node-overlap': 'error',
    'out-of-bounds': 'error',
    'label-collision': 'warning',
    'text-overflow': 'warning',
    'group-escape': 'warning',
    'orphan-node': 'warning',
    'edge-overlap': 'warning',
    'text-collision': 'warning',
    'undrawable-depth': 'error',
  } satisfies Record<RuleId, Severity>;

  // The runtime half, because a table typed correctly and spelled wrongly
  // still typechecks: every id above is one `check` honours, proved by
  // switching all of them off over a diagram that fires five.
  it('switches off every rule it knows, by name', () => {
    const noisy: Diagram = {
      nodes: [
        {
          id: 'a',
          shape: 'box',
          x: 0,
          y: 0,
          w: 40,
          h: 40,
          lines: ['far too wide'],
        },
        {
          id: 'a',
          shape: 'box',
          x: 20,
          y: 20,
          w: 100,
          h: 40,
          extrude: true,
          depth: Number.NaN,
        },
      ],
    };
    expect(rules(check(noisy)).length).toBeGreaterThan(4);
    const off = Object.fromEntries(
      Object.keys(EVERY_RULE).map((rule) => [rule, 'off']),
    ) as Record<RuleId, 'off'>;
    expect(check(noisy, { rules: off })).toEqual([]);
  });

  // The checker is documented as pure, and a caller runs it on the diagram it
  // is about to draw. Pinned from the first commit so purity is never a thing
  // someone has to re-establish later.
  it('leaves the diagram it was given alone', () => {
    const diagram: Diagram = {
      nodes: [{ id: 'a', shape: 'box', x: 0, y: 0, w: 10, h: 10 }],
    };
    const before = JSON.stringify(diagram);
    check(diagram);
    expect(JSON.stringify(diagram)).toBe(before);
  });

  // A caller runs `check` before `draw`, so it meets the diagrams `draw`
  // rejects. It has nothing to say about an edge naming a node that is not
  // there - `draw` throws on that by name - but it must still report
  // everything else rather than falling over on the way.
  it('survives an edge naming a node the diagram does not define', () => {
    const findings = check({
      nodes: [box('a', 0, 0), box('b', 10, 10)],
      edges: [{ from: ['a', 'r'], to: ['ghost', 'l'] }],
    });
    expect(rules(findings)).toContain('node-overlap');
  });
});

describe('severity and order', () => {
  // Fires four rules at once, in an order that is not the sorted one: the
  // orphan is found before the overlap, and the overlap is the more serious.
  const MESSY: Diagram = {
    nodes: [
      { id: 'a', shape: 'box', x: 300, y: 0, w: 100, h: 40 },
      { id: 'b', shape: 'box', x: 340, y: 20, w: 100, h: 40 },
      {
        id: 'wordy',
        shape: 'box',
        x: 0,
        y: 0,
        w: 40,
        h: 40,
        lines: ['far too wide'],
      },
    ],
  };

  it('puts errors before warnings, whatever order the rules ran in', () => {
    const findings = check(MESSY);
    expect(rules(findings)).toEqual([
      'node-overlap',
      'orphan-node',
      'orphan-node',
      'orphan-node',
      'text-overflow',
    ]);
  });

  it('breaks ties by position, so the same rule twice has an order', () => {
    const findings = check({
      nodes: [
        box('a', 500, 0),
        box('b', 540, 0),
        box('c', 100, 0),
        box('d', 140, 0),
      ],
    });
    const overlaps = findings.filter((f) => f.rule === 'node-overlap');
    expect(overlaps.map((f) => f.at)).toEqual([
      [140, 0],
      [540, 0],
    ]);
  });

  it('returns the same array twice for the same input', () => {
    expect(check(MESSY)).toEqual(check(MESSY));
  });

  it('raises a rule, and sorts it into its new place', () => {
    const findings = check(MESSY, { rules: { 'orphan-node': 'error' } });
    expect(findings.every((f) => f.severity === 'error')).toBe(false);
    expect(rules(findings)).toEqual([
      'node-overlap',
      'orphan-node',
      'orphan-node',
      'orphan-node',
      'text-overflow',
    ]);
    expect(findings[1]?.severity).toBe('error');
  });

  it('lowers a rule', () => {
    const findings = check(MESSY, { rules: { 'node-overlap': 'warning' } });
    expect(findings.map((f) => f.severity)).toEqual(
      Array(findings.length).fill('warning'),
    );
    expect(findings.find((f) => f.rule === 'node-overlap')?.severity).toBe(
      'warning',
    );
  });

  it('switches a rule off entirely', () => {
    const findings = check(MESSY, {
      rules: { 'orphan-node': 'off', 'text-overflow': 'off' },
    });
    expect(rules(findings)).toEqual(['node-overlap']);
  });
});

describe('duplicate-id', () => {
  it('reports the second node, naming where both of them are', () => {
    const findings = check({
      nodes: [box('a', 0, 0), box('b', 200, 0), box('a', 400, 300)],
      edges: [
        { from: ['a', 'r'], to: ['b', 'l'] },
        { from: ['b', 'r'], to: ['a', 'l'] },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'duplicate-id',
      severity: 'error',
      at: [400, 300],
      subjects: ['node "a"'],
    });
    expect(findings[0]?.message).toContain('(0, 0) and (400, 300)');
  });

  // The point of the rule: `draw` throws on the first defect it meets, so a
  // caller fixing a diagram by rendering it learns about one thing per
  // attempt. `check` reports the duplicate together with everything else.
  it('is reported alongside the other findings, not instead of them', () => {
    const findings = check({
      nodes: [box('a', 0, 0), box('a', 400, 300), box('lonely', 700, 0)],
    });
    expect(rules(findings).sort()).toEqual([
      'duplicate-id',
      'orphan-node',
      'orphan-node',
      'orphan-node',
    ]);
  });
});

describe('node-overlap', () => {
  // Every diagram below wires its nodes together, so orphan-node stays quiet
  // and the assertions are about the rule under test.
  const wired = (nodes: DiagramNode[]): Diagram => ({
    nodes,
    edges: [{ from: [nodes[0]?.id ?? '', 'r'], to: [nodes[1]?.id ?? '', 'l'] }],
  });

  it('reports a pair whose boxes share area, at the corner of the overlap', () => {
    const findings = check(wired([box('a', 0, 0), box('b', 60, 20)]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'node-overlap',
      severity: 'error',
      at: [60, 20],
      subjects: ['node "a"', 'node "b"'],
    });
  });

  it('says nothing about boxes laid flush against each other', () => {
    expect(check(wired([box('a', 0, 0), box('b', 100, 0)]))).toEqual([]);
  });

  // Groups are regions: every node inside a lane intersects it, so comparing
  // them would report the whole diagram.
  it('does not compare a group with the nodes it contains', () => {
    const findings = check({
      nodes: [
        {
          id: 'lane',
          shape: 'group',
          x: 0,
          y: 0,
          w: 300,
          h: 300,
          lines: ['l'],
        },
        box('a', 20, 20),
        box('b', 20, 120),
      ],
      edges: [{ from: ['a', 'b'], to: ['b', 't'] }],
    });
    expect(findings).toEqual([]);
  });

  it('reports each pair once, not twice', () => {
    expect(rules(check(wired([box('a', 0, 0), box('b', 10, 10)])))).toEqual([
      'node-overlap',
    ]);
  });
});

describe('group-escape', () => {
  const LANE: DiagramNode = {
    id: 'lane',
    shape: 'group',
    x: 100,
    y: 100,
    w: 200,
    h: 200,
    lines: ['lane'],
  };
  const inLane = (n: DiagramNode): Diagram => ({
    nodes: [LANE, n, box('far', 700, 700)],
    edges: [{ from: [n.id, 'r'], to: ['far', 'l'] }],
  });

  it('reports a node hanging over the edge of its group', () => {
    const findings = check(inLane(box('half', 250, 150)));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'group-escape',
      severity: 'warning',
      at: [250, 150],
      subjects: ['node "half"', 'node "lane"'],
    });
  });

  it('says nothing about a node wholly inside', () => {
    expect(check(inLane(box('inside', 120, 150)))).toEqual([]);
  });

  // The case the rule must not fire on: a node in a different lane is not
  // escaping anything, and treating "outside" as a defect would report every
  // node of every other lane.
  it('says nothing about a node wholly outside', () => {
    expect(check(inLane(box('elsewhere', 400, 150)))).toEqual([]);
  });

  it('counts a node flush against the inside as contained', () => {
    expect(check(inLane(box('flush', 100, 100)))).toEqual([]);
  });
});

describe('text-overflow', () => {
  const labelled = (lines: string[], w: number, size?: number): Diagram => ({
    nodes: [
      {
        id: 'a',
        shape: 'box',
        x: 0,
        y: 0,
        w,
        h: 40,
        lines,
        ...(size ? { size } : {}),
      },
      box('b', 500, 0),
    ],
    edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
  });

  // Pins the default advance through the number the finding reports: ten
  // characters at size 10 are 10 * 10 * 0.55 = 55px. Move the default and
  // this changes.
  //
  // Not pinned by a box of exactly 71px, which would give exactly 55px of
  // room: 100 * 0.55 is 55.00000000000001 in binary, so a label that fits to
  // the pixel warns anyway. That is the harmless direction of a rule whose
  // whole premise is that it over-states.
  it('estimates at the measured 0.55 advance by default', () => {
    const findings = check(labelled(['0123456789'], 40, 10));
    expect(findings[0]?.message).toContain('needs about 55px');
    expect(rules(check(labelled(['0123456789'], 70, 10)))).toEqual([
      'text-overflow',
    ]);
    expect(check(labelled(['0123456789'], 72, 10))).toEqual([]);
  });

  // 0.55 clears the widest label measured in the documented handwriting
  // stack - 0.515, for "push" - by about 7%. Text that fits at the real
  // advance and not at the estimate is warned about rather than missed.
  it('over-states rather than under-states, so it warns early', () => {
    const real = 4 * 13.5 * 0.515;
    const estimated = 4 * 13.5 * 0.55;
    const w = Math.round(real) + 2 * 8 + 1;
    expect(estimated).toBeGreaterThan(real);
    expect(rules(check(labelled(['push'], w)))).toEqual(['text-overflow']);
  });

  it('marks the finding as estimated, and says what it needs', () => {
    const findings = check(labelled(['much too long for this'], 60));
    expect(findings[0]).toMatchObject({
      rule: 'text-overflow',
      severity: 'warning',
      estimated: true,
      subjects: ['node "a"'],
    });
    expect(findings[0]?.message).toContain('44px');
  });

  it('takes the widest line, and respects a per-node size', () => {
    expect(check(labelled(['ok', 'x'], 60))).toEqual([]);
    expect(rules(check(labelled(['ok', 'far too wide here'], 60)))).toEqual([
      'text-overflow',
    ]);
    expect(rules(check(labelled(['nine char'], 60, 30)))).toEqual([
      'text-overflow',
    ]);
  });

  it('says nothing about a node with no label at all', () => {
    expect(
      check({
        nodes: [box('a', 0, 0), box('b', 500, 0)],
        edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
      }),
    ).toEqual([]);
  });

  // A group title starts 14px in from the corner and runs right, so it has
  // that much less room than a label centred in a box of the same width.
  it('measures a group title from where it actually starts', () => {
    const group = (w: number): Diagram => ({
      nodes: [
        {
          id: 'lane',
          shape: 'group',
          x: 0,
          y: 0,
          w,
          h: 200,
          lines: ['tenchars!!'],
        },
      ],
    });
    // 10 chars at TITLE_SIZE 14 estimate to 77px. Room is w - 14 - 8.
    expect(check(group(100))).toEqual([]);
    expect(rules(check(group(98)))).toEqual(['text-overflow']);
  });
});

describe('label-collision', () => {
  // Two boxes 300 apart with a straight horizontal line between them at
  // y = 20. An edge label is 12.5px tall, so its box reaches 6.25px each side
  // of ly, and the margin is clearance 4 + inflation 2.1 = 6.1. The label
  // therefore needs its centre 12.35px from the line.
  const withLabel = (ly: number): Diagram => ({
    nodes: [
      { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
      { id: 'b', shape: 'box', x: 400, y: 0, w: 100, h: 40 },
    ],
    edges: [{ from: ['a', 'r'], to: ['b', 'l'], label: 'yes', lx: 250, ly }],
  });

  it('reports a label lying on the line it labels', () => {
    const findings = check(withLabel(20));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'label-collision',
      severity: 'warning',
      estimated: true,
      at: [250, 20],
      subjects: ['edge 0', 'edge 0'],
    });
    expect(findings[0]?.message).toContain('lies on the line it labels');
  });

  it('goes quiet once the label is clear of it', () => {
    expect(rules(check(withLabel(9)))).toEqual(['label-collision']);
    expect(check(withLabel(4))).toEqual([]);
  });

  // The reason the ideal path is not what gets measured. At 8px the label is
  // clear of the line the data describes and not of the line the pen draws.
  it('accounts for the wobble, not just the geometry', () => {
    const gap = 20 - 8 - 12.5 / 2;
    expect(gap).toBeGreaterThan(4);
    expect(gap).toBeLessThan(4 + 2.1);
    expect(rules(check(withLabel(8)))).toEqual(['label-collision']);
  });

  it('reports a note the same way, naming the edge that crosses it', () => {
    const findings = check({
      nodes: [
        { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
        { id: 'b', shape: 'box', x: 400, y: 0, w: 100, h: 40 },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
      notes: [{ x: 200, y: 22, lines: ['under the wire'] }],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'label-collision',
      subjects: ['note 0', 'edge 0'],
    });
  });

  // Measured before it was fixed: the label below was reported as lying on
  // the line it labels, with the nearest ink 280px away. `edgePath` spliced a
  // self-transition's `via` into the path it returned, so the rule measured a
  // leg out to the corner and back that the loop never travels.
  it('says nothing about a label on a corner a loop never turns at', () => {
    expect(
      check({
        nodes: [box('a', 0, 0)],
        edges: [
          {
            from: ['a', 'r'],
            to: ['a', 'r'],
            via: [[300, 200]],
            label: 'retry',
            lx: 300,
            ly: 200,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('names the other edge when a label is struck by one it does not belong to', () => {
    const findings = check({
      nodes: [
        { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
        { id: 'b', shape: 'box', x: 400, y: 0, w: 100, h: 40 },
        { id: 'c', shape: 'box', x: 0, y: 200, w: 100, h: 40 },
        { id: 'd', shape: 'box', x: 400, y: 200, w: 100, h: 40 },
      ],
      edges: [
        { from: ['a', 'r'], to: ['b', 'l'], label: 'far', lx: 250, ly: 220 },
        { from: ['c', 'r'], to: ['d', 'l'] },
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.subjects).toEqual(['edge 0', 'edge 1']);
    expect(findings[0]?.message).toContain('lies under edge 1');
  });

  // The regression this rule exists for. The React example was an OAuth flow
  // in four lanes at the time, and it shipped with its step labels 9px above
  // the cross-lane connectors; all three were drawn through - found by
  // rendering it to a PNG and looking, which is exactly what a caller
  // generating diagrams cannot do. That example has since been replaced, so
  // the coordinates below are the only surviving copy of the layout: the
  // connectors as it drew them, with the labels back where they were before
  // they were moved into the boxes.
  it('finds all three struck labels a four-lane example shipped with', () => {
    const lane = (id: string, x: number) => ({
      id,
      shape: 'group' as const,
      x,
      y: 20,
      w: 185,
      h: 350,
      lines: [id],
    });
    const step = (id: string, x: number, y: number) => ({
      id,
      shape: 'box' as const,
      x,
      y,
      w: 155,
      h: 46,
      size: 12,
    });

    const findings = check({
      nodes: [
        lane('browser', 20),
        lane('app', 235),
        lane('server', 440),
        step('s2', 250, 60),
        step('s3', 455, 140),
        step('s4', 40, 220),
        step('s5', 250, 220),
        step('s6', 455, 300),
      ],
      edges: [
        {
          from: ['s2', 'b'],
          to: ['s3', 't'],
          via: [
            [327, 123],
            [532, 123],
          ],
          label: 'redirect',
          lx: 430,
          ly: 114,
        },
        {
          from: ['s3', 'b'],
          to: ['s4', 't'],
          via: [
            [532, 203],
            [117, 203],
          ],
          label: 'code',
          lx: 325,
          ly: 194,
        },
        {
          from: ['s5', 'b'],
          to: ['s6', 't'],
          via: [
            [327, 283],
            [532, 283],
          ],
          label: 'token',
          lx: 430,
          ly: 274,
        },
      ],
      // The label rule is the one under test; the lanes make the rest noisy.
    });

    const struck = findings.filter((f) => f.rule === 'label-collision');
    expect(struck).toHaveLength(3);
    // Sorted by position rather than by edge, so this is the same three
    // labels the example shipped, ordered left to right.
    expect(struck.map((f) => f.at)).toEqual([
      [325, 194],
      [430, 114],
      [430, 274],
    ]);
  });
});

describe('out-of-bounds', () => {
  const VIEW_BOX = [0, 0, 500, 300] as const;
  const wired = (nodes: DiagramNode[], edges: DiagramEdge[]): Diagram => ({
    nodes,
    edges,
  });
  const selfEdge: DiagramEdge = { from: ['a', 'r'], to: ['a', 'r'] };

  it('reports a node reaching past the frame', () => {
    const findings = check(
      wired(
        [box('a', 0, 0), box('over', 450, 100)],
        [{ from: ['a', 'r'], to: ['over', 'l'] }],
      ),
      { viewBox: VIEW_BOX },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'out-of-bounds',
      severity: 'error',
      at: [450, 100],
      subjects: ['node "over"'],
    });
  });

  it('reports a waypoint the arrow turns at outside the frame', () => {
    const findings = check(
      wired(
        [box('a', 0, 0), box('b', 300, 200)],
        [{ from: ['a', 'r'], to: ['b', 'l'], via: [[600, 20]] }],
      ),
      { viewBox: VIEW_BOX },
    );
    expect(rules(findings)).toEqual(['out-of-bounds']);
    expect(findings[0]).toMatchObject({ at: [600, 20], subjects: ['edge 0'] });
    // The rule walks the path as drawn, and a corner is one point on it among
    // the dozens a curve contributes, so the message names neither. A hand
    // written corner is an integer and survives the rounding a sample needs.
    expect(findings[0]?.message).toBe(
      'edge 0 reaches outside the viewBox at (600, 20), so part of it is clipped away',
    );
  });

  // The debt this closes. `DiagramEdge.out` promises that `check` reports a
  // loop leaving the frame, and that sentence ships in the JSON schema and in
  // the SCHEMA resource the MCP server hands to agents. It was false while
  // `edgePath` returned a self-transition's two anchors: both sit on the node,
  // and the node here is wholly inside the frame.
  //
  // By hand: `a`'s right anchor is (480, 120), and the loop is the half
  // ellipse centred there with radii LOOP_OUT 30 across and LOOP_SPAN / 2 = 20
  // along the side. Its longer radius is 30 and its sweep is PI, so it runs
  // 30 PI = 94.2 px, and the chord floor allows 94.2 / ARC_MIN_CHORD = 7
  // chords where the angle rule would have asked for 13. Point i sits at
  // (480 + 30 sin(PI i / 7), 120 - 20 cos(PI i / 7)); the first past x = 500
  // is i = 2, at 480 + 30 * 0.78183 = 503.45 and 120 - 20 * 0.62349 = 107.53.
  it('reports a loop that leaves the frame off a node wholly inside it', () => {
    const findings = check(wired([box('a', 380, 100)], [selfEdge]), {
      viewBox: VIEW_BOX,
    });
    expect(rules(findings)).toEqual(['out-of-bounds']);
    // The message rounds and `at` does not, on purpose and not by oversight.
    // `at` is a coordinate to go and look at, and rounding it can move a point
    // back inside the frame whose escape it is reporting - 500.4 in a 500-wide
    // frame becomes 500, which `outside` then says is fine.
    expect(findings[0]).toMatchObject({
      at: [expect.closeTo(503.4549), expect.closeTo(107.5302)],
      severity: 'error',
      subjects: ['edge 0'],
      message:
        'edge 0 reaches outside the viewBox at (503, 108), so part of it is clipped away',
    });
  });

  // The case that makes rounding `at` wrong rather than merely imprecise: fed
  // back through the rule's own predicate, a rounded point would not fire.
  it('gives at a point that is really outside, not one rounded back in', () => {
    const findings = check(
      wired(
        [box('a', 0, 20), box('b', 0, 200)],
        [{ from: ['a', 'b'], to: ['b', 't'], via: [[500.4, 120]] }],
      ),
      { viewBox: VIEW_BOX },
    );
    expect(rules(findings)).toEqual(['out-of-bounds']);
    expect(findings[0]?.at[0]).toBeGreaterThan(500);
  });

  // Ten of the loop's twelve inner samples are past the frame. Reporting each
  // would bury one defect under ten copies of itself, which is the difference
  // between a walk over corners a caller wrote and a walk over a sampled
  // curve. Asserted here rather than left to the count above so that a change
  // back to reporting every point fails on the reason rather than on a total.
  it('reports a curve leaving the frame once, not once per sample', () => {
    expect(
      check(wired([box('a', 380, 100)], [selfEdge]), { viewBox: VIEW_BOX }),
    ).toHaveLength(1);
  });

  // Both ends of every path are dropped before the walk. An anchor outside the
  // frame is a node outside the frame, which the rule above already names; the
  // alternative is one more finding per edge attached to that node, each
  // saying the same thing about the same defect.
  it('leaves an anchor outside the frame to the node it sits on', () => {
    const findings = check(
      wired(
        [box('a', 0, 0), box('gone', 600, 600)],
        [
          { from: ['a', 'r'], to: ['gone', 'l'] },
          { from: ['a', 'b'], to: ['gone', 't'] },
        ],
      ),
      { viewBox: VIEW_BOX },
    );
    expect(findings.map((f) => f.subjects)).toEqual([['node "gone"']]);
  });

  // The bow's own case, and the one that needs no numbers: both anchors and
  // every point of the chord between them are inside the frame, so the same
  // edge without `bow` is silent. Only the arc leaves - 40px below a chord
  // 30px above the bottom of the frame.
  it('reports a bow that leaves a frame its chord stays inside', () => {
    const bowed = (bow?: number): Diagram =>
      wired(
        [box('a', 0, 250), box('b', 300, 250)],
        [{ from: ['a', 'r'], to: ['b', 'l'], ...(bow ? { bow } : {}) }],
      );
    expect(check(bowed(), { viewBox: VIEW_BOX })).toEqual([]);

    const findings = check(bowed(40), { viewBox: VIEW_BOX });
    expect(rules(findings)).toEqual(['out-of-bounds']);
    expect(findings[0]?.subjects).toEqual(['edge 0']);
    // Past the bottom of the frame, which is the only direction this bow goes:
    // positive is to the right of travel, and travel here is left to right.
    expect(findings[0]?.at[1]).toBeGreaterThan(300);
  });

  // The other half of the same false finding, and the one that reads worst: a
  // corner the arrow never turns at, reported as leaving the picture. `draw`
  // now refuses such an edge outright, which settles nothing here - most of
  // the reason this exists is diagrams that are never drawn.
  it('does not report a corner on an edge that turns at none', () => {
    const findings = check(
      wired(
        [box('a', 0, 0), box('b', 300, 200)],
        [
          { from: ['a', 'r'], to: ['b', 'l'] },
          { from: ['b', 'r'], to: ['b', 'r'], via: [[600, 20]] },
        ],
      ),
      { viewBox: VIEW_BOX },
    );
    expect(findings).toEqual([]);
  });

  it('reports a label and a note placed where nobody will see them', () => {
    const findings = check(
      {
        nodes: [box('a', 0, 0), box('b', 300, 200)],
        edges: [
          { from: ['a', 'r'], to: ['b', 'l'], label: 'gone', lx: 900, ly: 40 },
        ],
        notes: [{ x: 20, y: 900, lines: ['also gone'] }],
      },
      { viewBox: VIEW_BOX },
    );
    expect(rules(findings)).toEqual(['out-of-bounds', 'out-of-bounds']);
    // Sorted by position, so the note at x=20 comes before the label at 900.
    expect(findings.map((f) => f.subjects)).toEqual([['note 0'], ['edge 0']]);
  });

  it('counts everything inside the frame, including a box ending exactly on it', () => {
    const findings = check(
      {
        nodes: [box('a', 0, 0), box('edge', 400, 260)],
        edges: [
          {
            from: ['a', 'r'],
            to: ['edge', 'l'],
            via: [[250, 20]],
            label: 'fine',
            lx: 150,
            // Clear of its own line: 15px up, and the text is 12.5px tall, so
            // the gap is 8.75px against a 6.1px margin.
            ly: 5,
          },
        ],
        notes: [{ x: 20, y: 200, lines: ['inside'] }],
      },
      { viewBox: VIEW_BOX },
    );
    expect(findings).toEqual([]);
  });

  // The documented behaviour, and the reason it is documented: the frame is
  // the one thing not decidable from the diagram, so without it the rule has
  // nothing to measure against and stays silent rather than inventing one.
  it('does not run at all without a viewBox', () => {
    const escaping = wired(
      [box('a', 0, 0), box('over', 9000, 9000)],
      [{ from: ['a', 'r'], to: ['over', 'l'] }],
    );
    expect(check(escaping)).toEqual([]);
    expect(rules(check(escaping, { viewBox: VIEW_BOX }))).toEqual([
      'out-of-bounds',
    ]);
  });
});

describe('orphan-node', () => {
  const NODES = [box('a', 0, 0), box('b', 200, 0), box('island', 400, 0)];

  it('names a node no edge reaches', () => {
    const findings = check({
      nodes: NODES,
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'orphan-node',
      severity: 'warning',
      at: [400, 0],
      subjects: ['node "island"'],
    });
  });

  it('counts a node an edge only arrives at', () => {
    const findings = check({
      nodes: [box('a', 0, 0), box('b', 200, 0)],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
    });
    expect(findings).toEqual([]);
  });

  // A group is a region drawn behind the others, not something an arrow
  // attaches to. Every diagram with lanes would otherwise open with a warning
  // per lane, and a rule that is noisy on correct input gets switched off.
  it('says nothing about a group, which no edge is expected to name', () => {
    const findings = check({
      nodes: [
        {
          id: 'lane',
          shape: 'group',
          x: 0,
          y: 0,
          w: 300,
          h: 200,
          lines: ['a'],
        },
        box('a', 20, 20),
        box('b', 20, 120),
      ],
      edges: [{ from: ['a', 'b'], to: ['b', 't'] }],
    });
    expect(findings).toEqual([]);
  });
});

describe('edge-overlap', () => {
  // `a`'s right anchor is (100, 20) and `b`'s left anchor is (400, 20), so an
  // edge between them is that 300px horizontal line and nothing else.
  const pair = (...edges: DiagramEdge[]): Diagram => ({
    nodes: [box('a', 0, 0), box('b', 400, 0)],
    edges,
  });
  const there: DiagramEdge = { from: ['a', 'r'], to: ['b', 'l'] };
  const back: DiagramEdge = { from: ['b', 'l'], to: ['a', 'r'] };

  // The defect the rule exists for, and the reason it is worth a rule: two
  // connectors between one pair of anchors draw a single line, so the picture
  // looks deliberate while the data says two. Nothing a caller can see.
  it('reports an edge and the reverse drawn over it', () => {
    const findings = check(pair(there, back));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: 'edge-overlap',
      severity: 'warning',
      at: [100, 20],
      subjects: ['edge 0', 'edge 1'],
      message:
        'edges 0 and 1 are drawn one on top of the other; give one of them a bow',
    });
  });

  // The case that must stay quiet. Two edges that meet and part have points at
  // the far end of each that the other never comes near, which is the whole
  // difference between crossing and overlapping.
  it('says nothing about two edges that merely cross', () => {
    expect(
      check({
        nodes: [
          box('a', 0, 0),
          box('b', 400, 0),
          box('c', 0, 200),
          box('d', 400, 200),
        ],
        edges: [
          { from: ['a', 'r'], to: ['d', 'l'] },
          { from: ['c', 'r'], to: ['b', 'l'] },
        ],
      }),
    ).toEqual([]);
  });

  // The near-parallel pair, and what fixes it. The distance is the width of
  // the ink rather than a number of anyone's choosing: INFLATE is half of it,
  // jitter included, so two paths within 2 * INFLATE = 4.2px are two strokes
  // laid in the same place. The arc here is 13 points whose middle one is the
  // apex, exactly `bow` px off the chord, so these two numbers straddle it.
  it('reports a bow too shallow to separate the pair, and not one that clears it', () => {
    expect(rules(check(pair(there, { ...back, bow: 4 })))).toEqual([
      'edge-overlap',
    ]);
    expect(check(pair(there, { ...back, bow: 5 }))).toEqual([]);
  });

  // The commonest quiet case of all, and the one a sampled point count makes
  // sharp: a fan-out shares an anchor, so each path has a point lying exactly
  // on the other. "Along their whole length" is every point and not any point,
  // which is the only reason this is silent.
  it('says nothing about two edges leaving one anchor and parting', () => {
    expect(
      check({
        nodes: [box('a', 0, 0), box('b', 400, 0), box('c', 400, 200)],
        edges: [
          { from: ['a', 'r'], to: ['b', 'l'] },
          { from: ['a', 'r'], to: ['c', 'l'] },
        ],
      }),
    ).toEqual([]);
  });

  // Both ways round, which is what keeps a T quiet: every point of the short
  // edge lies on the long one, and most of the long one is nowhere near the
  // short one. A connector running past a pair of boxes is a layout, not a
  // duplicate of the connector between them. Asserted in both edge orders,
  // because a rule measuring one way round is quiet in one of them by luck.
  it('says nothing about a short edge lying along part of a longer one', () => {
    const nodes = [
      box('a', 0, 0),
      box('b', 400, 0),
      box('m', 150, 0),
      box('n', 280, 0),
    ];
    const long: DiagramEdge = { from: ['a', 'r'], to: ['b', 'l'] };
    const short: DiagramEdge = { from: ['m', 'r'], to: ['n', 'l'] };
    expect(check({ nodes, edges: [long, short] })).toEqual([]);
    expect(check({ nodes, edges: [short, long] })).toEqual([]);
  });

  // The same defect in another shape, and the assurance that no path is
  // compared with itself: one loop is a picture, two are one loop drawn twice.
  // The connector in the middle is the two-paths-of-different-lengths case -
  // 13 sampled points against 2 - and the loop is 12px off it before it has
  // gone anywhere, 60px off by its tip.
  it('reports two self-transitions on one side, and nothing for one alone', () => {
    const loop: DiagramEdge = { from: ['a', 'r'], to: ['a', 'r'] };
    expect(check({ nodes: [box('a', 0, 0)], edges: [loop] })).toEqual([]);
    expect(check(pair(there, loop))).toEqual([]);
    const findings = check({ nodes: [box('a', 0, 0)], edges: [loop, loop] });
    expect(rules(findings)).toEqual(['edge-overlap']);
    // Not `bow`, which `draw` throws on for a self-transition: a warning whose
    // fix is an exception is worse than one that names no fix at all.
    expect(findings[0]?.message).toBe(
      'edges 0 and 1 are drawn one on top of the other; give one of them its own out and span',
    );
  });

  // The case this rule was widened for, and the shape the whole-length test
  // could never see: two connectors leave one anchor, draw as a single line
  // down to a corner, and only then go different ways. Every point at the far
  // end of each is nowhere near the other, so `along` is false both ways and
  // the old rule was silent however long the trunk ran.
  it('reports a trunk two connectors share before parting', () => {
    const trunk: Diagram = {
      nodes: [box('s', 250, 0), box('l', 100, 300), box('r', 400, 300)],
      edges: [
        {
          from: ['s', 'b'],
          to: ['l', 't'],
          via: [
            [300, 240],
            [150, 240],
          ],
        },
        {
          from: ['s', 'b'],
          to: ['r', 't'],
          via: [
            [300, 240],
            [450, 240],
          ],
        },
      ],
    };
    const findings = check(trunk);
    expect(rules(findings)).toEqual(['edge-overlap']);
    // The trunk is drawn from (300, 40) to (300, 240), so 200px, and the run
    // is reported a little longer than that: a parting path goes on counting
    // until it is `2 * INFLATE` clear. Asserted as a range rather than a
    // figure, because the exact overshoot is a property of the walk and not
    // something a caller should be able to pin.
    const px = Number(/about (\d+) px/.exec(findings[0]?.message ?? '')?.[1]);
    expect(px).toBeGreaterThanOrEqual(200);
    expect(px).toBeLessThan(200 + 3 * 2 * INFLATE);
    // Naming the length is the point of the finding: "these two overlap" and
    // "these two share 200px" are different amounts of help when the fix is to
    // move one of them.
    expect(findings[0]?.message).toContain('drawn along one another for about');
    expect(findings[0]?.message).toContain('give one of them a bow');
  });

  // The lower bound of the calibration, held as a test rather than left in a
  // comment. `examples/react/src/incident.ts` forks twice from one anchor and
  // turns at one corner, sharing 20px, and says so in its own source. It is
  // the longest run any diagram this repository ships draws deliberately, so
  // it is the thing `OVERLAP_MIN` has to stay above.
  //
  // Asserted against a control at the same anchors, because on its own an
  // assertion of silence is green for any reason at all - including the run
  // never being measured. The two differ only in where the corner sits, so
  // what they hold between them is the threshold rather than the geometry.
  it('says nothing about a fork shorter than the threshold, and does above it', () => {
    const fork = (turn: number): Diagram => ({
      nodes: [box('s', 250, 0), box('l', 100, 300), box('r', 400, 300)],
      edges: [
        {
          from: ['s', 'b'],
          to: ['l', 't'],
          via: [
            [300, turn],
            [150, turn],
          ],
        },
        {
          from: ['s', 'b'],
          to: ['r', 't'],
          via: [
            [300, turn],
            [450, turn],
          ],
        },
      ],
    });
    // The anchor is at (300, 40), so the trunk is `turn - 40` px long.
    expect(check(fork(60))).toEqual([]);
    expect(rules(check(fork(160)))).toEqual(['edge-overlap']);
  });

  // The upper bound, and the four pairs that raised this change. This is the
  // showcase's own geometry as it stood before its routing was fixed, where
  // `npm run diagrams` reported zero warnings on 262px of connector drawn
  // along other connector. Each pair shares one anchor - three leaving `mcp`,
  // two arriving at `root` - which is exactly what the run is measured for.
  it('reports each pair the showcase drew before its routing was fixed', () => {
    const wide = (id: string, x: number, y: number): DiagramNode => ({
      id,
      shape: 'box',
      x,
      y,
      w: 220,
      h: 46,
    });
    const findings = check({
      nodes: [
        wide('page', 70, 92),
        wide('react', 330, 92),
        wide('mcp', 590, 92),
        wide('root', 70, 272),
        wide('check', 330, 272),
        wide('server', 590, 272),
        wide('schema', 850, 272),
      ],
      edges: [
        { from: ['page', 'b'], to: ['root', 't'] },
        {
          from: ['react', 'b'],
          to: ['root', 't'],
          via: [
            [440, 196],
            [180, 196],
          ],
        },
        {
          from: ['mcp', 'b'],
          to: ['check', 't'],
          via: [
            [700, 196],
            [440, 196],
          ],
        },
        { from: ['mcp', 'b'], to: ['server', 't'] },
        {
          from: ['mcp', 'b'],
          to: ['schema', 't'],
          via: [
            [700, 208],
            [960, 208],
          ],
        },
      ],
    });
    // All four, and nothing else: the two `mcp` legs that cross `check`'s
    // column are not reported as a fifth, and no node in the row trips a rule.
    expect(
      findings.map(
        (f) => `${f.subjects.join('+')} ${/about (\d+)/.exec(f.message)?.[1]}`,
      ),
    ).toEqual([
      'edge 0+edge 1 84',
      'edge 2+edge 3 62',
      'edge 2+edge 4 62',
      'edge 3+edge 4 74',
    ]);
    // Measured by hand off the coordinates above: 76, 58, 58 and 70, each
    // reported one band longer. 262px of picture the gate had nothing to say
    // about.
    expect(rules(findings)).toEqual(Array(4).fill('edge-overlap'));
  });

  // `check` runs on diagrams that are never drawn, which is most of the reason
  // it exists, so it meets the ones `draw` refuses. A `bow` that is not a
  // finite number samples to no points at all: two edges with no ink between
  // them are not two edges drawn on top of each other.
  it('says nothing about two edges that draw no line at all', () => {
    expect(
      check(
        pair(
          { ...there, bow: Number.POSITIVE_INFINITY },
          { ...back, bow: Number.NaN },
        ),
      ),
    ).toEqual([]);
  });
});

describe('text-collision', () => {
  // Every other rule measures text against the *strokes* a diagram draws, so
  // the connectors here are kept far from the labels on purpose: anything
  // these tests report is text against text and nothing else.
  const far: DiagramNode[] = [box('p', 0, 600), box('q', 300, 600)];
  const link: DiagramEdge = { from: ['p', 'r'], to: ['q', 'l'] };
  const ids = (d: Diagram) =>
    check(d)
      .filter((f) => f.rule === 'text-collision')
      .map((f) => f.subjects.join(' + '));

  // The case this rule exists for, and the one that was drawn before it was
  // written: a group's title hangs off its top-left corner, an edge label was
  // put there too, and every gate passed because a title lays down no path.
  it("reports a label written through a group's title", () => {
    const d: Diagram = {
      nodes: [
        {
          id: 'g',
          shape: 'group',
          x: 0,
          y: 0,
          w: 300,
          h: 120,
          lines: ['a leaf'],
        },
        ...far,
      ],
      edges: [{ ...link, label: 'energy', lx: 30, ly: 18 }],
    };
    expect(ids(d)).toEqual(['node "g" + edge 0']);
    // Named in draw order: the group's title is laid down before any edge, so
    // the edge label is the one drawn over it.
    expect(check(d).find((f) => f.rule === 'text-collision')?.message).toBe(
      'node "g" lies under edge 0, which will be drawn through it',
    );
  });

  // Moving it clear is the whole fix, and the rule has to agree that it worked.
  it('goes quiet once the label is moved off the title', () => {
    const d: Diagram = {
      nodes: [
        {
          id: 'g',
          shape: 'group',
          x: 0,
          y: 0,
          w: 300,
          h: 120,
          lines: ['a leaf'],
        },
        ...far,
      ],
      edges: [{ ...link, label: 'energy', lx: 240, ly: 90 }],
    };
    expect(ids(d)).toEqual([]);
  });

  it("reports a label written through a node's own label", () => {
    const d: Diagram = {
      nodes: [{ ...box('n', 0, 0), lines: ['chloroplast'] }, ...far],
      edges: [{ ...link, label: 'energy', lx: 50, ly: 20 }],
    };
    expect(ids(d)).toEqual(['node "n" + edge 0']);
  });

  it('reports two edge labels written on one another', () => {
    const d: Diagram = {
      nodes: far,
      edges: [
        { ...link, label: 'first', lx: 40, ly: 40 },
        { ...link, label: 'second', lx: 44, ly: 42 },
      ],
    };
    // The pair of edges is itself an overlap, so only the text finding is read.
    expect(ids(d)).toEqual(['edge 0 + edge 1']);
  });

  // The rule has no clearance of its own, which is the point: near is not a
  // collision, and there is no number here for anyone to tune.
  it('says nothing about text that is merely near other text', () => {
    const d: Diagram = {
      nodes: [{ ...box('n', 0, 0), lines: ['chloroplast'] }, ...far],
      edges: [{ ...link, label: 'energy', lx: 50, ly: 90 }],
    };
    expect(ids(d)).toEqual([]);
  });

  it('says nothing about a diagram with only one piece of text', () => {
    expect(
      ids({ nodes: far, edges: [{ ...link, label: 'alone', lx: 40, ly: 40 }] }),
    ).toEqual([]);
  });

  // It rests on the width estimate, like every other finding that does, and a
  // caller filtering on `estimated` has to be able to find it.
  it('marks the finding as estimated', () => {
    const d: Diagram = {
      nodes: [{ ...box('n', 0, 0), lines: ['chloroplast'] }, ...far],
      edges: [{ ...link, label: 'energy', lx: 50, ly: 20 }],
    };
    expect(check(d).find((f) => f.rule === 'text-collision')?.estimated).toBe(
      true,
    );
  });

  it('can be switched off on its own', () => {
    const d: Diagram = {
      nodes: [{ ...box('n', 0, 0), lines: ['chloroplast'] }, ...far],
      edges: [{ ...link, label: 'energy', lx: 50, ly: 20 }],
    };
    expect(
      rules(check(d, { rules: { 'text-collision': 'off' } })),
    ).not.toContain('text-collision');
  });
});

describe('a brace is checked as the shape it draws', () => {
  const FRAME = [0, 0, 400, 300] as const;
  // A span whose two endpoints sit well inside the frame, with the tip
  // reaching for the left edge. The straight line between the endpoints would
  // never leave the viewBox, which is the whole point of the first case.
  const span = {
    from: [30, 60] as [number, number],
    to: [30, 240] as [number, number],
  };

  it('reports a tip past the frame whose endpoints are both inside', () => {
    const findings = check(
      { braces: [{ ...span, depth: 40 }] },
      {
        viewBox: FRAME,
      },
    );
    expect(rules(findings)).toEqual(['out-of-bounds']);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      subjects: ['brace 0'],
    });
    // Named, not numbered: `edge 0` here would point at an edge that does not
    // exist, in a diagram that has no edges at all.
    expect(findings[0]?.message).toContain('brace 0 reaches outside');
  });

  // The case that must stay quiet. The same brace turned the other way puts
  // its tip 40 px further into the frame rather than out of it.
  it('says nothing about a brace whose tip points inward', () => {
    expect(
      check({ braces: [{ ...span, depth: -40 }] }, { viewBox: FRAME }),
    ).toEqual([]);
  });

  it('reports a brace label outside the frame, as it reports any other text', () => {
    const findings = check(
      { braces: [{ ...span, lines: ['set'], lx: 500, ly: 150 }] },
      { viewBox: FRAME },
    );
    expect(rules(findings)).toEqual(['out-of-bounds']);
    expect(findings[0]?.message).toBe(
      'the label on brace 0 sits outside the viewBox and will not be seen',
    );
  });

  // D6's first question, closed: a note drawn across a brace is the same
  // defect as a label drawn across a connector, and is reported as one. This
  // is the finding `struckBy` could not produce while it returned an index.
  it('reports a note lying across a brace, naming the brace', () => {
    const findings = check({
      braces: [{ ...span, depth: 40 }],
      notes: [{ x: -8, y: 150, lines: ['x'] }],
    });
    expect(rules(findings)).toEqual(['label-collision']);
    expect(findings[0]).toMatchObject({
      subjects: ['note 0', 'brace 0'],
      estimated: true,
    });
    expect(findings[0]?.message).toBe(
      'note 0 lies under brace 0, which will be drawn through it',
    );
  });

  // The symmetric case, and the one the asymmetry would have left open: an
  // edge label is checked against the lines, so a brace label is too.
  it('reports a brace label lying on its own brace', () => {
    const findings = check({
      braces: [{ ...span, depth: 40, lines: ['set'], lx: -8, ly: 150 }],
    });
    expect(rules(findings)).toEqual(['label-collision']);
    expect(findings[0]?.message).toBe(
      'the label on brace 0 lies on the brace it labels; move it clear of the tip',
    );
  });

  it('says nothing about a note that clears the brace', () => {
    expect(
      check({
        braces: [{ ...span, depth: 40 }],
        notes: [{ x: 120, y: 150, lines: ['x'] }],
      }),
    ).toEqual([]);
  });
});

// An extruded node is bigger than its box, and the checker measures what the
// pen puts down. Every number below is worked out by hand from the vector
// `(d, -0.75d)` and the swept box `(x, y - .75d, w + d, h + .75d)`, and every
// case is stated twice - flat and extruded - so that what the sweep changed
// is visible rather than asserted.
describe('an extruded node is measured extruded', () => {
  const DEEP = { extrude: true, depth: 12 } as const;
  // No edges reach the nodes in a few of these, and the rule that would say
  // so has nothing to do with depth.
  const QUIET = { rules: { 'orphan-node': 'off' } } as const;

  // design.md D6's motivating defect, at the geometry it recorded: hero-5's
  // TOOL SCHEMA box ended at x = 1190 in a 1200-wide viewBox - 10 px inside
  // it - and at the default depth its face reached 1202, 2 px past. The
  // render clipped the face and the owner caught it by eye, a day before the
  // design was written; this is that eye made mechanical.
  describe('a face crossing the viewBox', () => {
    const HERO = [0, 0, 1200, 600] as const;
    const FRAME: Diagram = {
      nodes: [
        { id: 'agent', shape: 'box', x: 100, y: 200, w: 200, h: 80 },
        { id: 'schema', shape: 'box', x: 990, y: 200, w: 200, h: 80 },
      ],
      edges: [{ from: ['agent', 'r'], to: ['schema', 'l'] }],
    };

    it('is reported where the flat box passes', () => {
      expect(check(FRAME, { viewBox: HERO })).toEqual([]);
    });

    it('is reported as out-of-bounds, naming the node that casts it', () => {
      const findings = check(FRAME, { viewBox: HERO, ...DEEP });
      expect(rules(findings)).toEqual(['out-of-bounds']);
      expect(findings[0]).toMatchObject({
        severity: 'error',
        subjects: ['node "schema"'],
        // The node's own corner: `at` is somewhere to go and look, and the
        // place to look at a clipped slab is the node casting it.
        at: [990, 200],
      });
    });

    // The other end of the same vector, and its own case because the sweep
    // is measured at two corners and only one of them moved in x. `agent`
    // sits 5 px below the top of the frame and rises 9, so its face is 4 px
    // above it while its box is inside; nothing here crosses the right-hand
    // edge, so the rise is the whole reason for the finding.
    it('is reported where the face rises above the top of the frame', () => {
      const HIGH: Diagram = {
        nodes: [
          { id: 'agent', shape: 'box', x: 100, y: 5, w: 200, h: 80 },
          { id: 'schema', shape: 'box', x: 600, y: 200, w: 200, h: 80 },
        ],
        edges: [{ from: ['agent', 'r'], to: ['schema', 'l'] }],
      };
      expect(check(HIGH, { viewBox: HERO })).toEqual([]);

      const findings = check(HIGH, { viewBox: HERO, ...DEEP });
      expect(rules(findings)).toEqual(['out-of-bounds']);
      expect(findings[0]).toMatchObject({ subjects: ['node "agent"'] });
    });

    // The sweep only ever adds. A slab rises, so its box's own bottom edge is
    // the swept box's bottom edge too - `y - .75d` plus `h + .75d` is `y + h`
    // - and a node hanging 5 px below a 600-tall frame goes on being reported
    // once it extrudes. A sweep that moved the box up instead of growing it
    // would withdraw this finding, which is the one thing depth must never do.
    it('goes on reporting a box that hangs below the frame', () => {
      const LOW: Diagram = {
        nodes: [
          { id: 'agent', shape: 'box', x: 100, y: 200, w: 200, h: 80 },
          { id: 'schema', shape: 'box', x: 600, y: 525, w: 200, h: 80 },
        ],
        edges: [{ from: ['agent', 'r'], to: ['schema', 'l'] }],
      };
      for (const o of [{}, DEEP])
        expect(rules(check(LOW, { viewBox: HERO, ...o }))).toEqual([
          'out-of-bounds',
        ]);
    });

    // The margin the case turns on, asserted rather than described: two more
    // pixels of frame and the face fits, so the rule is measuring the face
    // and not merely firing near it.
    it('says nothing once the frame is two pixels wider', () => {
      expect(check(FRAME, { viewBox: [0, 0, 1202, 600], ...DEEP })).toEqual([]);
    });
  });

  // By hand: `a` sweeps to x 0..112 and `b` starts at 108, so the two slabs
  // share 4 px of the picture that neither box does.
  it('reports a pair whose slabs meet where their boxes do not', () => {
    const APART: Diagram = {
      nodes: [
        { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
        { id: 'b', shape: 'box', x: 108, y: 0, w: 100, h: 40 },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
    };
    expect(check(APART)).toEqual([]);

    const findings = check(APART, DEEP);
    expect(rules(findings)).toEqual(['node-overlap']);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      subjects: ['node "a"', 'node "b"'],
      at: [108, 0],
    });
  });

  // T-99, and the same 4 px of shared picture written the other way up. The
  // pair loop holds one node's ink and walks the rest, so the sweep it reads
  // for the *second* node of a pair is read through a different expression
  // from the one it reads for the first. The fixture above cannot tell them
  // apart: the left node comes first, its own slab reaches 112, and the right
  // node's flat box starts at 108, so the earlier sweep alone bridges the gap
  // and the later one is never asked for. Written right-first, only the
  // second node's sweep closes the distance - `right` sits flat from 108 and
  // `left`'s slab has to reach out to 112 to meet it - so this is the case
  // that fails if the later side of the comparison is ever read flat.
  it('reports that pair with the nodes written the other way round', () => {
    const REVERSED: Diagram = {
      nodes: [
        { id: 'right', shape: 'box', x: 108, y: 0, w: 100, h: 40 },
        { id: 'left', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
      ],
      edges: [{ from: ['left', 'r'], to: ['right', 'l'] }],
    };
    expect(check(REVERSED)).toEqual([]);

    const findings = check(REVERSED, DEEP);
    expect(rules(findings)).toEqual(['node-overlap']);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      subjects: ['node "right"', 'node "left"'],
      at: [108, 0],
    });
  });

  // T-78. One rectangle - 100..260 across, 200..260 down - written twice:
  // from its top-left corner, and from its bottom-left with a negative `h`.
  // `ShapeOptions.depth` promises a mirrored dimension still extrudes
  // outward, and the pen keeps that promise by reading winding off the
  // outline's signed area, so the two spellings put down the same ink. The
  // checker measures ink, so it has to report them the same.
  //
  // The frame cuts 5 px off the bottom of both, which is a finding neither
  // depth nor a spelling may take away.
  describe('a node written from its far corner', () => {
    const CUT = [0, 0, 400, 255] as const;
    const one = (n: DiagramNode): Diagram => ({ nodes: [n] });
    const UPRIGHT: DiagramNode = {
      id: 'a',
      shape: 'box',
      x: 100,
      y: 200,
      w: 160,
      h: 60,
    };
    const MIRRORED: DiagramNode = { ...UPRIGHT, y: 260, h: -60 };

    // Every field but `at`. The two spellings declare different origins -
    // (100, 200) and (100, 260) - and `at` is deliberately the node's own
    // written corner rather than anything computed, because it is somewhere
    // for the author to go and look and the author wrote that corner. Every
    // other field is a statement about the ink, and the ink is the same ink.
    const found = (n: DiagramNode, o: CheckOptions) =>
      check(one(n), { viewBox: CUT, ...QUIET, ...o }).map(
        ({ at: _at, ...rest }) => rest,
      );

    it('is measured as the same rectangle, flat and at either depth', () => {
      for (const o of [{}, DEEP, { extrude: true, depth: 40 }]) {
        // Non-empty first, so the equality below cannot pass by both sides
        // being silent about a diagram that is genuinely clipped.
        expect(found(UPRIGHT, o).map((f) => f.rule)).toEqual(['out-of-bounds']);
        expect(found(MIRRORED, o)).toEqual(found(UPRIGHT, o));
      }
    });

    it('reports each spelling at the corner that spelling declares', () => {
      const at = (n: DiagramNode) =>
        check(one(n), { viewBox: CUT, ...QUIET, ...DEEP })[0]?.at;
      expect(at(UPRIGHT)).toEqual([100, 200]);
      expect(at(MIRRORED)).toEqual([100, 260]);
    });

    // The withdrawal itself, pinned. Grown as written, `h: -60` takes the
    // rise as a shrink: the swept box's top edge drops from 260 to 251 and
    // its bottom edge climbs to 200, so the whole slab lands inside a frame
    // that cuts the flat box - and a diagram whose ink is 5 px outside the
    // picture passes because it extrudes. Depth may find a defect the flat
    // box hid; it may never hide one the flat box found.
    it('goes on reporting the frame cutting its bottom edge', () => {
      for (const o of [{}, DEEP])
        expect(
          rules(check(one(MIRRORED), { viewBox: CUT, ...QUIET, ...o })),
        ).toEqual(['out-of-bounds']);
    });

    // The other axis and the other corner, because the two spellings fail
    // differently and a fixture mirroring both at once would pass on either
    // half of the fix. `w: -160` from x 110 puts the rectangle's left edge at
    // -50, and `+ d` on a negative width walks that edge back inward: at
    // depth 60 it reaches +10 and the finding vanishes.
    it('goes on reporting the frame cutting a mirrored left edge', () => {
      const WIDE: DiagramNode = { ...UPRIGHT, x: 110, w: -160 };
      for (const o of [{}, { extrude: true, depth: 60 }])
        expect(
          rules(
            check(one(WIDE), { viewBox: [0, 0, 400, 300], ...QUIET, ...o }),
          ),
        ).toEqual(['out-of-bounds']);
    });
  });

  // The anchor an edge leaves, measured through a rule rather than read off
  // `anchor`: at depth 40 the vector is (40, -30), so `a`'s right anchor
  // moves from (200, 120) to (240, 90) and the connector is drawn from
  // there. The note sits on that point and 23.5 px clear of the flat line -
  // margin is 6.1 - so the two walks disagree about it.
  describe('an edge walked from the moved anchor', () => {
    const walk = (extrude: boolean): Diagram => ({
      nodes: [
        {
          id: 'a',
          shape: 'box',
          x: 100,
          y: 100,
          w: 100,
          h: 40,
          extrude,
          depth: 40,
        },
        { id: 'b', shape: 'box', x: 400, y: 100, w: 100, h: 40 },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
      notes: [{ x: 240, y: 90, lines: ['x'] }],
    });

    it('leaves the note alone while the node is flat', () => {
      expect(check(walk(false))).toEqual([]);
    });

    it('reports the note the moved line is drawn through', () => {
      const findings = check(walk(true));
      expect(rules(findings)).toEqual(['label-collision']);
      expect(findings[0]).toMatchObject({
        subjects: ['note 0', 'edge 0'],
        estimated: true,
      });
      expect(findings[0]?.message).toBe(
        'note 0 lies under edge 0, which will be drawn through it',
      );
    });
  });

  // T-77, and the pair the fixture above cannot reach. `edgePath` takes the
  // options as its third argument so that a path is walked from the anchors
  // the pen will draw from, and every node above carries `extrude` and
  // `depth` on itself - which `depthOf` resolves whether or not the options
  // ever arrive. Drop the argument and the diagram-wide pair stops reaching
  // the walk, and nothing above notices: a node-borne pair is resolved from
  // the node either way.
  //
  // So the pair is on the diagram here and on no node. By hand at depth 40
  // the vector is (40, -30), so `a`'s top anchor moves from (180, 40) to
  // (220, 10) and the loop is drawn from there - `LOOP_OUT` above it, which
  // puts its apex 3 px above a frame that starts at 0. The node's own slab
  // stays inside: it sweeps to (100, 10) and (300, 100), so no rule that
  // measures a box has anything to say, and the finding is the path walk's
  // alone.
  describe('an edge walked from an anchor the options moved', () => {
    const LOOP: Diagram = {
      nodes: [{ id: 'a', shape: 'box', x: 100, y: 40, w: 160, h: 60 }],
      edges: [{ from: ['a', 't'], to: ['a', 't'] }],
    };
    const FRAME = [0, 0, 400, 300] as const;

    it('leaves the loop alone while the diagram is flat', () => {
      expect(check(LOOP, { viewBox: FRAME })).toEqual([]);
    });

    it('reports the loop the options carry out of the frame', () => {
      const findings = check(LOOP, {
        viewBox: FRAME,
        extrude: true,
        depth: 40,
      });
      expect(rules(findings)).toEqual(['out-of-bounds']);
      expect(findings[0]).toMatchObject({ subjects: ['edge 0'] });
      // The apex, and above the frame rather than merely near it. Asserted as
      // a number because "reports something" is what a walk from the flat
      // anchor would also do if the geometry were moved a little.
      expect(findings[0]?.at[1]).toBeLessThan(0);
      expect(findings[0]?.at[1]).toBeCloseTo(-3.02, 1);
    });
  });

  // T-56, and the reason the checker splits its rules in two rather than
  // sweeping a node wholesale. A label is painted on the front face, which
  // the extrusion does not move: give `text-overflow` the swept box and it
  // hands every extruded node d px of room no glyph can occupy, which is
  // claimed slack that spills, and it drags every label box up and right of
  // where `draw` writes it, which is what `text-collision` compares.
  //
  // By hand at the defaults - size 13.5, advance 0.55, padding 8 - `tight`
  // has 100 - 16 = 84 px of room and a twelve-character label needs
  // 12 * 13.5 * 0.55 = 89.1, so it overflows by 5. Swept it would have
  // 112 - 16 = 96 and the finding would vanish. `a`'s label is centred on
  // (250, 20) and the note's box starts at (240, 13.5); swept, that centre
  // moves to (256, 15.5) and the finding survives at a different place.
  describe("a label's room does not grow with depth", () => {
    const TEXT: Diagram = {
      nodes: [
        {
          id: 'tight',
          shape: 'box',
          x: 0,
          y: 0,
          w: 100,
          h: 40,
          lines: ['twelve chars'],
        },
        {
          id: 'a',
          shape: 'box',
          x: 200,
          y: 0,
          w: 100,
          h: 40,
          lines: ['label'],
        },
      ],
      edges: [{ from: ['tight', 'r'], to: ['a', 'l'] }],
      notes: [{ x: 240, y: 20, lines: ['x'] }],
    };
    const text = (d: Diagram, o: CheckOptions) =>
      check(d, o).filter(
        (f) => f.rule === 'text-overflow' || f.rule === 'text-collision',
      );

    it('reports both text rules flat, which is what the pair must not move', () => {
      const flat = text(TEXT, {});
      expect(rules(flat)).toEqual(['text-collision', 'text-overflow']);
      expect(flat[1]?.message).toBe(
        'the label on node "tight" needs about 89px and has 84px; widen the box or shorten the text',
      );
    });

    it('reports exactly the same two findings extruded', () => {
      expect(text(TEXT, DEEP)).toEqual(text(TEXT, {}));
    });

    // The overflow on its own, because it is the one that would disappear
    // rather than move: 89.1 fits inside a swept 96 and the warning would be
    // silently withdrawn from a label that still spills its pill.
    it("keeps the front box's room in the message it prints", () => {
      expect(text(TEXT, DEEP)[1]?.message).toContain('has 84px');
    });
  });

  // A group bounds a set; it is not an object, and it never extrudes. So the
  // frame stays where it is drawn and the member's slab is what crosses it.
  // By hand: `in` runs x 220..280 against a group ending at 280, which is
  // flush and therefore contained, and sweeps to x 220..292, which is not.
  describe("a member's slab escaping its group", () => {
    const LANE: Diagram = {
      nodes: [
        {
          id: 'lane',
          shape: 'group',
          x: 20,
          y: 20,
          w: 260,
          h: 160,
          lines: ['lane'],
        },
        { id: 'in', shape: 'box', x: 220, y: 60, w: 60, h: 40 },
      ],
    };

    it('is contained while it is flat, flush against the frame', () => {
      expect(check(LANE, QUIET)).toEqual([]);
    });

    it('is reported against the flat frame once it extrudes', () => {
      const findings = check(LANE, { ...DEEP, ...QUIET });
      expect(rules(findings)).toEqual(['group-escape']);
      expect(findings[0]).toMatchObject({
        severity: 'warning',
        subjects: ['node "in"', 'node "lane"'],
        at: [220, 60],
      });
    });
  });

  // The predicate `draw` resolves a depth behind, read from `sample` rather
  // than restated: a pill whose larger dimension falls under
  // 3 * ARC_MIN_CHORD / PI - 11.4592 px - samples to an outline with no area,
  // draws no faces at all, and so is measured by its flat box however good
  // its `depth`. The box beside it is the control: same numbers, same
  // options, and it does sweep, which is what stops this passing for the
  // wrong reason.
  it('measures a shape that cannot carry a face by its flat box', () => {
    const small = (shape: 'pill' | 'box'): Diagram => ({
      nodes: [{ id: 'p', shape, x: 85, y: 40, w: 10, h: 8 }],
    });
    const opts = { viewBox: [0, 0, 100, 100] as const, ...DEEP, ...QUIET };

    expect(check(small('pill'), opts)).toEqual([]);
    // 85 + 10 + 12 = 107, which is 7 px past the frame.
    expect(rules(check(small('box'), opts))).toEqual(['out-of-bounds']);
  });

  // The override cuts both ways, on the checker's side of the line too: a
  // node's own `extrude` beats the diagram's, and the depth follows the node
  // that carries it.
  it("reads the pair by the renderer's idiom, node over options", () => {
    const pair: Diagram = {
      nodes: [
        { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40, extrude: false },
        { id: 'b', shape: 'box', x: 108, y: 0, w: 100, h: 40 },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
    };
    // `a` opts out, so nothing sweeps into `b` and the 8 px gap holds.
    expect(check(pair, DEEP)).toEqual([]);
    // And the other way: a flat diagram with one node raised out of it.
    expect(
      rules(
        check(
          {
            ...pair,
            nodes: [
              { ...pair.nodes?.[0], extrude: true } as DiagramNode,
              pair.nodes?.[1] as DiagramNode,
            ],
          },
          {},
        ),
      ),
    ).toEqual(['node-overlap']);
  });
});

// T-65. `draw` refuses a depth it cannot draw and stops there; a checker that
// resolved the same number to nought would hand back an empty report for a
// diagram nothing can render, which inverts the order the tools prescribe -
// check first, then render - and breaks this file's own promise that the
// checker measures what the renderer draws.
//
// Every message below is written out *and* held to the renderer's own throw.
// The literal is for the reader, who should be able to see the sentence a
// caller gets without running anything; the throw is what stops the two
// drifting, because a wording changed on one side only leaves the literal
// green on that side and red here. `refuses` renders the very diagram under
// test and compares what came back. The element it renders into is jsdom's,
// which the core project already runs in, and nothing here reads a rendered
// byte.
describe('undrawable-depth', () => {
  // The four kinds of number a depth must not be, and the list `draw`'s own
  // tests are written against: not a number, negative, nought, not finite.
  const BAD = [Number.NaN, -3, 0, Number.POSITIVE_INFINITY];

  const found = (d: Diagram, o: CheckOptions) =>
    check(d, o).filter((f) => f.rule === 'undrawable-depth');

  // The one finding this diagram earns, held to the sentence `draw` throws for
  // the same diagram and the same options.
  const refuses = (d: Diagram, o: CheckOptions & DrawOptions) => {
    const findings = found(d, o);
    expect(findings).toHaveLength(1);
    expect(() => draw(makeSvg(), d, o)).toThrowError(
      new Error(findings[0]?.message),
    );
    return findings[0];
  };

  // Typed on the drawn half of the union rather than on `DiagramNode`, so a
  // fixture cannot ask for `depth` on a group by accident: that case is
  // stated once below, deliberately and with the cast in plain sight.
  const shape = (
    n: Partial<Exclude<DiagramNode, { shape: 'group' }>>,
  ): DiagramNode =>
    ({
      id: 'a',
      shape: 'box',
      x: 40,
      y: 20,
      w: 100,
      h: 40,
      ...n,
    }) as DiagramNode;

  // The options depth is refused whenever the diagram-wide switch is on,
  // whether or not a node goes on to read it - so the only node here opts out
  // of the extrusion entirely and the finding still stands, exactly as the
  // throw does. It is the diagram's own setting that is wrong, and it would
  // reach every node the caller later raises.
  it('reports an options depth no node reads, for each way of being undrawable', () => {
    const opted: Diagram = { nodes: [shape({ extrude: false })] };
    for (const bad of BAD) {
      const finding = refuses(opted, { extrude: true, depth: bad });
      expect(finding).toMatchObject({
        rule: 'undrawable-depth',
        severity: 'error',
        // Not a place in the drawing: the offender is the call, and there is
        // nowhere in the picture to go and look at it.
        at: [0, 0],
        subjects: ['options'],
      });
      expect(finding?.message).toBe(
        `the options depth is ${bad}; a depth is a positive finite number of px`,
      );
    }
  });

  it("names the node whose own depth cannot be drawn, at the node's corner", () => {
    for (const bad of BAD) {
      const finding = refuses(
        { nodes: [shape({ extrude: true, depth: bad })] },
        {},
      );
      expect(finding).toMatchObject({
        severity: 'error',
        at: [40, 20],
        subjects: ['node "a"'],
      });
      expect(finding?.message).toBe(
        `node "a" has depth ${bad}; a depth is a positive finite number of px`,
      );
    }
  });

  // The inherit corner, and the reason the message forks: the diagram-wide
  // switch is off, so the options depth is read only where this node's own
  // `extrude: true` reaches for it. The fix is an edit to the options and not
  // to the node, so the finding says which of the two carried the value - and
  // there is no options-level finding beside it, because a depth the diagram
  // does not switch on is a depth nothing else reads.
  it('says an undrawable depth was inherited, and names the node that inherited it', () => {
    for (const bad of BAD) {
      const finding = refuses(
        { nodes: [shape({ extrude: true })] },
        { depth: bad },
      );
      expect(finding).toMatchObject({ subjects: ['node "a"'] });
      expect(finding?.message).toBe(
        `node "a" extrudes at the options depth ${bad}; a depth is a positive finite number of px`,
      );
    }
  });

  // A group bounds a set rather than standing as an object, so it never
  // extrudes and the pair on one is read by nothing. The cast is the point:
  // `GroupNode` carries neither field and the schema refuses both, so the only
  // way to state this diagram is to lie to the compiler about it - and both
  // tools go on ignoring it.
  it('says nothing about the pair cast onto a group, as the renderer says nothing', () => {
    const titled: Diagram = {
      nodes: [
        {
          id: 'g',
          shape: 'group',
          x: 0,
          y: 0,
          w: 200,
          h: 100,
          lines: ['lane'],
          extrude: true,
          depth: Number.NaN,
        } as unknown as DiagramNode,
      ],
    };
    expect(found(titled, { extrude: true })).toEqual([]);
    expect(() => draw(makeSvg(), titled, { extrude: true })).not.toThrow();
  });

  // The subtlety this rule turns on, and the one place `magnitude` and
  // `depthOf` part company. A 10 x 8 pill cannot carry a face - its larger
  // dimension falls under 3 * ARC_MIN_CHORD / PI - so the renderer resolves it
  // flat and a good depth on it is not a defect. But the validation reads the
  // magnitude, not the resolution, so a `NaN` on that same pill still throws:
  // a number the caller wrote is judged for what it is, not for the box it
  // landed in. Reading `depthOf` here would pass a diagram `draw` refuses,
  // which is the whole failure this rule exists to prevent.
  describe('a shape that cannot carry a face', () => {
    const pill = (depth: number): Diagram => ({
      nodes: [
        {
          id: 'p',
          shape: 'pill',
          x: 85,
          y: 40,
          w: 10,
          h: 8,
          extrude: true,
          depth,
        },
      ],
    });

    it('is no defect while its depth is one the renderer accepts', () => {
      expect(found(pill(12), {})).toEqual([]);
      expect(() => draw(makeSvg(), pill(12))).not.toThrow();
    });

    it('is reported all the same when its depth is one the renderer refuses', () => {
      for (const bad of BAD)
        expect(refuses(pill(bad), {})?.message).toBe(
          `node "p" has depth ${bad}; a depth is a positive finite number of px`,
        );
    });
  });

  // `duplicate-id`'s reason, applied to the other defect `draw` stops at: the
  // renderer reports one thing per attempt, and the checker reports this one
  // alongside everything else, which is the difference between one round trip
  // and five. Sorted where an error belongs, after `node-overlap` because
  // `n` sorts before `u`, and ahead of every warning.
  it('is reported as an error, alongside every other finding', () => {
    const messy: Diagram = {
      nodes: [
        shape({ id: 'a', x: 300, y: 0, extrude: true, depth: Number.NaN }),
        shape({ id: 'b', x: 340, y: 20 }),
        shape({ id: 'wordy', x: 0, y: 0, w: 40, lines: ['far too wide'] }),
      ],
    };
    expect(rules(check(messy, {}))).toEqual([
      'node-overlap',
      'undrawable-depth',
      'orphan-node',
      'orphan-node',
      'orphan-node',
      'text-overflow',
    ]);
    // The premise: this is a diagram the renderer refuses outright, and five
    // of the six findings above are what a caller would never have been told.
    expect(() => draw(makeSvg(), messy)).toThrow();
  });

  // An infinite depth swept an infinite box before `depthOf` learned to
  // refuse what the pen refuses, so the diagram came back with a spurious
  // `out-of-bounds` beside the real finding - a rule reporting on ink that
  // is never drawn, because the pen draws no faces for a depth like this.
  it('sweeps nothing for a depth the pen would refuse', () => {
    const findings = check(
      {
        nodes: [
          { id: 'a', shape: 'box', x: 40, y: 20, w: 60, h: 40, extrude: true },
        ],
      },
      {
        extrude: true,
        depth: Number.POSITIVE_INFINITY,
        viewBox: [0, 0, 200, 100],
      },
    );
    // The orphan is the fixture's own doing; what matters is the
    // `out-of-bounds` that is no longer beside it.
    expect(rules(findings)).toEqual([
      'undrawable-depth',
      'undrawable-depth',
      'orphan-node',
    ]);
  });

  it('is lowered and switched off like every other rule', () => {
    const bad: Diagram = {
      nodes: [shape({ extrude: true, depth: Number.NaN })],
    };
    expect(found(bad, { rules: { 'undrawable-depth': 'off' } })).toEqual([]);
    expect(
      found(bad, { rules: { 'undrawable-depth': 'warning' } })[0],
    ).toMatchObject({ severity: 'warning' });
    // And lowered, it sorts with the warnings rather than ahead of them.
    expect(
      rules(
        check(bad, {
          rules: { 'undrawable-depth': 'warning', 'orphan-node': 'warning' },
        }),
      ),
    ).toEqual(['orphan-node', 'undrawable-depth']);
  });
});

// The gate the rest of group 3 stands on, landed before any rule learns to
// sweep: whatever the checker says about a diagram that extrudes nothing, it
// SHALL keep saying once it can measure depth. The reference diagrams are
// too well behaved to hold that on their own - at their real viewBoxes the
// sampler reports nothing at all - so the subject is a diagram built to
// trip as many rules at once as one drawing can, and the assertion is the
// whole report: rule, severity and message, in order.
//
// It held. 3.1 taught six rules to sweep and moved every anchor an edge is
// walked from, and this snapshot did not move a byte - which is the whole of
// the requirement that a flat check reports exactly what it always reported,
// asserted against a statement frozen before the code could see depth rather
// than against a run of the code that changed. A second assertion here would
// only restate it against a weaker witness.
describe('a flat diagram is measured as it always was', () => {
  const said = (diagram: Diagram, viewBox: [number, number, number, number]) =>
    check(diagram, { viewBox }).map(
      (f) => `${f.severity} ${f.rule} ${f.message}`,
    );

  it('reports what it always reported, rule by rule', () => {
    expect(
      said(
        {
          nodes: [
            {
              id: 'grp',
              shape: 'group',
              x: 20,
              y: 20,
              w: 260,
              h: 160,
              lines: ['a group'],
            },
            {
              id: 'in',
              shape: 'box',
              x: 40,
              y: 60,
              w: 120,
              h: 50,
              lines: ['inside'],
            },
            {
              id: 'out',
              shape: 'box',
              x: 220,
              y: 120,
              w: 140,
              h: 60,
              lines: ['escapes the frame'],
            },
            {
              id: 'over',
              shape: 'box',
              x: 300,
              y: 150,
              w: 120,
              h: 60,
              lines: ['overlaps'],
            },
            {
              id: 'clip',
              shape: 'pill',
              x: 700,
              y: 60,
              w: 160,
              h: 50,
              lines: ['past the edge'],
            },
            {
              id: 'lonely',
              shape: 'diamond',
              x: 420,
              y: 40,
              w: 100,
              h: 60,
              lines: ['orphan'],
            },
            {
              id: 'tight',
              shape: 'box',
              x: 60,
              y: 220,
              w: 60,
              h: 40,
              lines: ['far too wide for this'],
            },
          ],
          edges: [
            {
              from: ['in', 'r'],
              to: ['out', 'l'],
              label: 'on the line',
              lx: 190,
              ly: 118,
            },
            { from: ['in', 'r'], to: ['over', 'l'] },
            { from: ['tight', 'r'], to: ['clip', 'l'] },
          ],
          notes: [{ x: 62, y: 40, lines: ['a group title sits here'] }],
        },
        [0, 0, 760, 300],
      ),
    ).toMatchSnapshot();
  });
});

// T-79. A `Box` may be written from any of its four corners: `{x: 350, y: 166,
// w: -150, h: -46}` and `{x: 200, y: 120, w: 150, h: 46}` name one rectangle,
// and `ShapeOptions.depth` promises the pen lays the same ink over it either
// way, because winding is read off the outline's signed area rather than off
// the sign of a dimension. Rendered, the two differ only in which way round
// the pen walks the sides. So every rule that measures ink owes both spellings
// the same finding, and three of them did not: `intersects` and `contains`
// carried an unstated non-negative precondition, and `text-overflow` read the
// written width as the room a label has.
//
// Flat on purpose. `swept` has read the covered rectangle since T-78, so at
// any depth these rules were already right; the hole was the diagram that
// never extrudes at all.
describe('a flat node written from its far corner is the rectangle it covers', () => {
  const QUIET = { rules: { 'orphan-node': 'off' } } as const;
  const A: DiagramNode = {
    id: 'a',
    shape: 'box',
    x: 100,
    y: 100,
    w: 150,
    h: 46,
  };
  // 200..350 across and 120..166 down, written from each of two corners.
  const UPRIGHT: DiagramNode = {
    id: 'b',
    shape: 'box',
    x: 200,
    y: 120,
    w: 150,
    h: 46,
    lines: ['hello'],
  };
  const MIRRORED: DiagramNode = {
    id: 'b',
    shape: 'box',
    x: 350,
    y: 166,
    w: -150,
    h: -46,
    lines: ['hello'],
  };
  const GROUP: DiagramNode = {
    id: 'g',
    shape: 'group',
    x: 80,
    y: 80,
    w: 200,
    h: 100,
    lines: ['grp'],
  };

  // Every field but `at`, on the same terms as the depth block above: the two
  // spellings declare different origins and `at` is deliberately the corner
  // the author wrote, because it is somewhere to go and look. Everything else
  // is a statement about the ink, and the ink is one rectangle.
  const found = (nodes: DiagramNode[]) =>
    check({ nodes }, QUIET).map(({ at: _at, ...rest }) => rest);

  // `a` covers 100..250, `b` covers 200..350, so they lap by 50 px. Read as
  // written, `b.x` is 350 and `b.x + b.w` is 200: every comparison in
  // `intersects` comes out backwards and the pair is declared apart.
  it('overlaps the node its ink overlaps', () => {
    expect(found([A, UPRIGHT]).map((f) => f.rule)).toEqual(['node-overlap']);
    expect(found([A, MIRRORED])).toEqual(found([A, UPRIGHT]));
  });

  // The group covers 80..280 and `b` reaches 350, so 70 px of it hangs out.
  // Read as written, `contains` asks whether 350 is past the near edge and
  // 200 short of the far one - an overlap test, not a containment test - and
  // answers that the escaping node is wholly inside.
  it('escapes the group its ink escapes', () => {
    expect(found([GROUP, UPRIGHT]).map((f) => f.rule)).toEqual([
      'group-escape',
    ]);
    expect(found([GROUP, MIRRORED])).toEqual(found([GROUP, UPRIGHT]));
  });

  // "hello" at the default 13.5 and 0.55 advance is 5 * 13.5 * 0.55 = 37.1 px
  // and has 150 - 16 = 134 px of room, which is no overflow at all. Read as
  // written the room is -166 px, so every label on a mirrored node overflows.
  it('says nothing about a label with room to spare', () => {
    expect(found([UPRIGHT])).toEqual([]);
    expect(found([MIRRORED])).toEqual([]);
  });

  // The other end of it, because an empty result is agreement about silence
  // and not about arithmetic. 21 characters at 13.5 need 155.9 px; a box 60
  // wide offers 60 - 16 = 44. The message carries both numbers, so pinning it
  // pins the room the two spellings are measured against.
  it('reports the same overflow whichever way the box is written', () => {
    const tight = (n: Partial<DiagramNode>): DiagramNode => ({
      id: 'a',
      shape: 'box',
      x: 0,
      y: 0,
      w: 60,
      h: 40,
      lines: ['far too wide for this'],
      ...n,
    });
    const said = (n: DiagramNode) => found([n]).map((f) => f.message);
    expect(said(tight({}))).toEqual([
      'the label on node "a" needs about 156px and has 44px; widen the box or shorten the text',
    ]);
    expect(said(tight({ x: 60, y: 40, w: -60, h: -40 }))).toEqual(
      said(tight({})),
    );
  });

  it('reports each spelling at the corner that spelling declares, flat', () => {
    const at = (nodes: DiagramNode[]) => check({ nodes }, QUIET)[0]?.at;
    expect(at([A, UPRIGHT])).toEqual([200, 120]);
    expect(at([A, MIRRORED])).toEqual([350, 166]);
  });

  // A group's title is the one label that is not centred: `draw` writes it at
  // `n.x + TITLE_DX`, and `reference/renderer.html` writes it at `n.x + 14`,
  // both from the written corner rather than from the left edge of anything.
  // So a group written backwards really does have its title laid outside its
  // own frame, and the room it has inside that frame is nought less the
  // padding. The finding stands, which is why the room is `Math.max(0, n.w)`
  // and not `Math.abs(n.w)`: the width the rectangle covers would hand this
  // title 178 px it cannot reach and leave the checker silent about a title
  // drawn off the corner of its group.
  it('measures a group title from where the pen writes it', () => {
    expect(found([GROUP])).toEqual([]);
    expect(
      found([{ ...GROUP, x: 280, y: 180, w: -200, h: -100 }]).map(
        (f) => f.message,
      ),
    ).toEqual([
      'the label on node "g" needs about 23px and has -22px; widen the box or shorten the text',
    ]);
  });

  // The departure above is worth a second witness, because one assertion is
  // thin evidence for choosing one function over another. The room a mirrored
  // group's title has does not depend on how wide the group is - the title is
  // outside it either way - so `-22` here is `0 - TITLE_DX - padding` and
  // nothing else. `Math.abs` would report 478 px of room and say nothing at
  // all; a plain `n.w` would report -522 and mis-state the fix by 500 px.
  it('gives a mirrored group the same nought of room at any width', () => {
    const room = (w: number) =>
      found([{ ...GROUP, x: 280, y: 180, w, h: -100 }]).map(
        (f) => / has (-?\d+)px/.exec(f.message)?.[1],
      );
    expect(room(-200)).toEqual(['-22']);
    expect(room(-500)).toEqual(['-22']);
  });

  // And the upright half is untouched, which is the other thing `Math.max`
  // has to be: identical to the expression it replaces wherever `w` is
  // positive. A group 60 wide has 60 - 14 - 8 = 38 px for its title, and 20
  // characters at `TITLE_SIZE` 14 need 20 * 14 * 0.55 = 154.
  it('leaves an upright group measured exactly as before', () => {
    expect(
      found([{ ...GROUP, w: 60, lines: ['a title far too long'] }]).map(
        (f) => f.message,
      ),
    ).toEqual([
      'the label on node "g" needs about 154px and has 38px; widen the box or shorten the text',
    ]);
  });
});

// An empty `lines` array is not a label. `p.label` writes no `<text>` for one,
// so nothing is drawn, nothing occupies room and nothing can be collided with -
// yet `[]` is truthy, and every guard here was written as `if (!x.lines)`. The
// checker was measuring text the drawing does not contain: a block nought
// characters wide against a room that goes negative on any box narrower than
// twice the padding, and a `labelBox` one line shorter than none, whose height
// came out at `size * (1 - LINE_H)` - a negative number handed to the geometry.
//
// The tests below assert against `draw` rather than against a number, because
// the rule is not "an empty array is special" but "the checker measures what
// the pen draws", and the pen is the only thing that can settle that.
describe('an empty lines array is not a label', () => {
  const drawn = (d: Diagram) => {
    const svg = makeSvg();
    draw(svg, d, { seed: 7 });
    return svg.innerHTML;
  };

  it('draws no text, so it is measured as none', () => {
    const narrow: Diagram = {
      nodes: [{ id: 'n', shape: 'box', x: 0, y: 0, w: 10, h: 20, lines: [] }],
    };
    expect(drawn(narrow)).not.toContain('<text');
    expect(rules(check(narrow, { rules: { 'orphan-node': 'off' } }))).toEqual(
      [],
    );
  });

  it('gives a group with no title nothing to overflow', () => {
    const untitled: Diagram = {
      nodes: [{ id: 'g', shape: 'group', x: 0, y: 0, w: 12, h: 60, lines: [] }],
    };
    expect(drawn(untitled)).not.toContain('<text');
    expect(rules(check(untitled))).toEqual([]);
  });

  // A zero-width box is not a harmless one: `intersects` only needs the far
  // edge of one to clear the near edge of the other, so a block with no width
  // still laps text either side of it.
  it('gives an empty note no box to collide with', () => {
    const over: Diagram = {
      nodes: [
        { id: 'n', shape: 'box', x: 0, y: 0, w: 200, h: 40, lines: ['label'] },
      ],
      notes: [{ x: 100, y: 20, lines: [] }],
    };
    expect(drawn(over)).not.toContain('<text>');
    expect(rules(check(over, { rules: { 'orphan-node': 'off' } }))).toEqual([]);
  });

  it('gives an empty brace label nothing to lie on', () => {
    const onIt: Diagram = {
      braces: [{ from: [0, 0], to: [200, 0], lines: [], lx: 100, ly: 26 }],
    };
    expect(drawn(onIt)).not.toContain('<text');
    expect(rules(check(onIt))).toEqual([]);
  });

  // The other direction, or the fix is "report nothing": one real line in the
  // same places still reports everything it did.
  it('still measures a block that has a line in it', () => {
    expect(
      rules(
        check(
          {
            nodes: [
              {
                id: 'n',
                shape: 'box',
                x: 0,
                y: 0,
                w: 10,
                h: 20,
                lines: ['far too wide'],
              },
            ],
            notes: [{ x: 5, y: 10, lines: ['on top of it'] }],
          },
          { rules: { 'orphan-node': 'off' } },
        ),
      ),
    ).toEqual(['text-collision', 'text-overflow']);
  });
});
