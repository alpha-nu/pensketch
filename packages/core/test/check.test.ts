import { describe, expect, it } from 'vitest';
import { check } from '../src/check';
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

describe('out-of-bounds', () => {
  const VIEW_BOX = [0, 0, 500, 300] as const;
  const wired = (nodes: DiagramNode[], edges: DiagramEdge[]): Diagram => ({
    nodes,
    edges,
  });

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
    expect(findings.map((f) => f.subjects)).toEqual([['edge 0'], ['note 0']]);
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
            lx: 250,
            ly: 12,
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
