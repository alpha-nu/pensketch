import { describe, expect, it } from 'vitest';
import * as subpath from '../src/check';
import { check } from '../src/check';
import { INFLATE } from '../src/geometry';
import type { Diagram, DiagramEdge, DiagramNode } from '../src/index';

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
