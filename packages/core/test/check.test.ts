import { describe, expect, it } from 'vitest';
import { check } from '../src/check';
import type { Diagram, DiagramNode } from '../src/index';

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
