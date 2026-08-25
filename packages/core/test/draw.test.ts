import { describe, expect, it, vi } from 'vitest';
import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramNote,
  DrawOptions,
  Pen,
  Point,
  Side,
} from '../src/index';
import { anchor, constants, defaultTheme, draw } from '../src/index';
import { foreignSvg } from './foreign-dom.mjs';
import {
  childrenOf,
  makeSvg,
  nth,
  pathsOf,
  pointsOf,
  tagsOf,
  textsOf,
} from './helpers';
import { serialize } from './serialize.mjs';

const {
  AMP,
  ARC_STEPS,
  DASH,
  DEPTH,
  DEPTH_RISE,
  EDGE_SIZE,
  LOOP_OUT,
  LOOP_SPAN,
  GROUP_W,
  HATCH_INSET,
  HATCH_W,
  NOTE_SIZE,
  OVERSHOOT,
  SIZE,
  TITLE_DX,
  TITLE_DY,
  TITLE_SIZE,
  WASH_RX,
} = constants;

const attr = (el: Element, name: string) => el.getAttribute(name);
const num = (el: Element, name: string) => Number(el.getAttribute(name));
const styleOf = (el: Element) => attr(el, 'style');
const contents = (svg: SVGSVGElement) =>
  textsOf(svg).map((text) => text.textContent);

// One diagram that reaches every phase, with a marker label in each so the
// order they were drawn in can be read straight off the document.
const ALL_PHASES: Diagram = {
  nodes: [
    { id: 'g', shape: 'group', x: 0, y: 0, w: 300, h: 200, lines: ['group'] },
    { id: 'a', shape: 'box', x: 20, y: 40, w: 80, h: 40, lines: ['node 1'] },
    { id: 'b', shape: 'box', x: 200, y: 40, w: 80, h: 40, lines: ['node 2'] },
  ],
  edges: [{ from: ['a', 'r'], to: ['b', 'l'], label: 'edge', lx: 150, ly: 50 }],
  braces: [
    {
      from: [10, 30],
      to: [10, 90],
      lines: ['brace'],
      lx: 20,
      ly: 60,
    },
  ],
  notes: [
    { x: 20, y: 150, lines: ['note 1'] },
    { x: 20, y: 170, lines: ['note 2'] },
  ],
  raw: [
    (p: Pen) => p.label(150, 120, 'raw 1'),
    (p: Pen) => p.label(150, 140, 'raw 2'),
  ],
};

describe('anchor()', () => {
  it('gives the midpoint of each side', () => {
    const node: DiagramNode = {
      id: 'n',
      shape: 'box',
      x: 10,
      y: 20,
      w: 100,
      h: 40,
    };
    const expected: Record<Side, Point> = {
      t: [60, 20],
      b: [60, 60],
      l: [10, 40],
      r: [110, 40],
    };
    for (const side of ['t', 'b', 'l', 'r'] as Side[])
      expect(anchor(node, side)).toEqual(expected[side]);
  });

  it('moves t and r by the full extrusion vector at a resolved depth', () => {
    const node: DiagramNode = {
      id: 'n',
      shape: 'box',
      x: 10,
      y: 20,
      w: 100,
      h: 40,
    };
    // The flat anchor plus (d, -0.75d) at d = 10, pinned as literals so a
    // drifting DEPTH_RISE dies here rather than passing against itself.
    expect(anchor(node, 't', 10)).toEqual([70, 12.5]);
    expect(anchor(node, 'r', 10)).toEqual([120, 32.5]);
    // l and b sit on the front plane and do not move.
    expect(anchor(node, 'l', 10)).toEqual(anchor(node, 'l'));
    expect(anchor(node, 'b', 10)).toEqual(anchor(node, 'b'));
  });

  it('reads an absent, zero or negative depth as flat on every side', () => {
    const node: DiagramNode = {
      id: 'n',
      shape: 'box',
      x: 10,
      y: 20,
      w: 100,
      h: 40,
    };
    for (const side of ['t', 'b', 'l', 'r'] as Side[]) {
      expect(anchor(node, side, 0)).toEqual(anchor(node, side));
      expect(anchor(node, side, -8)).toEqual(anchor(node, side));
    }
  });
});

describe('draw() render order', () => {
  it('renders group, then edge, then node, then brace, then note, then raw', () => {
    const svg = makeSvg();
    draw(svg, ALL_PHASES);

    // Each phase walks its own array in order, so the markers come out in the
    // order they were declared within each phase as well as across phases.
    expect(contents(svg)).toEqual([
      'group',
      'edge',
      'node 1',
      'node 2',
      'brace',
      'note 1',
      'note 2',
      'raw 1',
      'raw 2',
    ]);
    // The group's wash is the first thing drawn, so everything else is over
    // it rather than under it.
    expect(tagsOf(svg)[0]).toBe('rect');
  });

  it('redraws idempotently', () => {
    const twice = makeSvg();
    draw(twice, ALL_PHASES, { seed: 3 });
    draw(twice, ALL_PHASES, { seed: 3 });

    const once = makeSvg();
    draw(once, ALL_PHASES, { seed: 3 });

    expect(contents(twice)).toEqual(contents(once));
    expect(serialize(twice)).toBe(serialize(once));
  });
});

describe('draw() determinism', () => {
  it('writes byte-identical output for the same seed', () => {
    const first = makeSvg();
    const second = makeSvg();
    draw(first, ALL_PHASES, { seed: 7 });
    draw(second, ALL_PHASES, { seed: 7 });

    expect(serialize(first)).toBe(serialize(second));
  });

  it('moves the wobble but not the text when the seed changes', () => {
    const seven = makeSvg();
    const eight = makeSvg();
    draw(seven, ALL_PHASES, { seed: 7 });
    draw(eight, ALL_PHASES, { seed: 8 });

    expect(serialize(seven)).not.toBe(serialize(eight));
    // Text is placed from the diagram's own numbers and never jittered, so a
    // different seed may not move a single label or change a single word.
    const placed = (svg: SVGSVGElement) =>
      textsOf(svg).map(
        (t) => `${attr(t, 'x')},${attr(t, 'y')}:${t.textContent}`,
      );
    expect(placed(seven)).toEqual(placed(eight));
  });
});

describe('draw() validation', () => {
  const nodes: DiagramNode[] = [
    { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50 },
    { id: 'b', shape: 'box', x: 200, y: 0, w: 100, h: 50 },
  ];
  const rejects = (diagram: Diagram, message: string) =>
    expect(() => draw(makeSvg(), diagram)).toThrowError(new Error(message));

  it('names the edge and the id when an edge starts nowhere', () => {
    rejects(
      { nodes, edges: [{ from: ['ghost', 'r'], to: ['b', 'l'] }] },
      'edge 0 names unknown node "ghost" in from; known ids are "a", "b"',
    );
  });

  // The case this change exists to remove. It did not throw before: it drew a
  // meaningless stub across the node's corner, with an arrowhead on it, and
  // said nothing - so a caller who wrote the obvious thing got rubbish and no
  // reason to doubt it.
  it('refuses a corner loop, where it used to draw a stub and say nothing', () => {
    rejects(
      { nodes, edges: [{ from: ['a', 't'], to: ['a', 'r'] }] },
      'edge 0 names node "a" at both ends but sides "t" and "r"; a self-transition attaches to one side, so name the same side in from and to',
    );
  });

  it('counts the edge that is wrong, not the one before it', () => {
    rejects(
      {
        nodes,
        edges: [
          { from: ['a', 'r'], to: ['a', 'r'] },
          { from: ['b', 'l'], to: ['b', 't'] },
        ],
      },
      'edge 1 names node "b" at both ends but sides "l" and "t"; a self-transition attaches to one side, so name the same side in from and to',
    );
  });

  // The message is not asserted because there is nothing to assert: the pen
  // refuses an empty point list, and that is the whole fix. What is asserted
  // is that it throws at all - without the guard in `arcPoints` this samples
  // until the heap gives out and takes the process with it, which no caller
  // can catch. A coordinate that large reaches a string and fails catchably at
  // any magnitude; out and span reach a count of points instead. `1e400` is
  // five characters of JSON and parses to Infinity, so no limit on request
  // size stands between a caller and this.
  it('throws instead of sampling forever when a loop is sized by NaN', () => {
    for (const bad of [{ out: Number.NaN }, { out: Number.POSITIVE_INFINITY }])
      expect(() =>
        draw(makeSvg(), {
          nodes,
          edges: [{ from: ['a', 'r'], to: ['a', 'r'], ...bad }],
        }),
      ).toThrow();
  });

  // The four ways one path can be described twice, and one message shape for
  // all of them. Written out rather than driven from a table: what a caller
  // with no view of the picture is left holding is the words, and a table
  // asserts the table.
  it('refuses an edge that is bowed and cornered at once', () => {
    rejects(
      {
        nodes,
        edges: [
          { from: ['a', 'r'], to: ['b', 'l'], bow: 30, via: [[150, 60]] },
        ],
      },
      'edge 0 carries bow; its path is already described by via',
    );
  });

  // Two notes, so the index is the note's own rather than the only one there
  // was. Before this, the pointer drew its bow and dropped the corners.
  it('refuses a note pointer that is bowed and cornered at once', () => {
    rejects(
      {
        notes: [
          { x: 10, y: 10, lines: ['fine'] },
          {
            x: 10,
            y: 40,
            lines: ['both'],
            arrowFrom: [20, 40],
            arrowTo: [120, 90],
            bow: 20,
            via: [[60, 90]],
          },
        ],
      },
      'note 1 carries bow; its path is already described by via',
    );
  });

  // Both of these drew the loop and discarded the field before this change,
  // which is the silent ignoring it exists to remove.
  it('refuses corners on a self-transition, where it used to drop them', () => {
    rejects(
      {
        nodes,
        edges: [{ from: ['a', 'r'], to: ['a', 'r'], via: [[150, 25]] }],
      },
      'edge 0 carries via; its path is already described by the side it hangs off, out and span',
    );
  });

  it('refuses a bow on a self-transition, where it used to drop it', () => {
    rejects(
      { nodes, edges: [{ from: ['a', 'r'], to: ['a', 'r'], bow: 30 }] },
      'edge 0 carries bow; its path is already described by the side it hangs off, out and span',
    );
  });

  // An empty `via` names no corner, so it contradicts nothing: a program that
  // writes the field always and fills it sometimes is not describing a path
  // twice. It is also the one shape of `via` that already draws the straight
  // line, so refusing it here would refuse what draws there.
  it('takes an empty via beside a bow, and on a loop', () => {
    expect(() =>
      draw(makeSvg(), {
        nodes,
        edges: [
          { from: ['a', 'r'], to: ['b', 'l'], bow: 30, via: [] },
          { from: ['a', 'r'], to: ['a', 'r'], via: [] },
        ],
        notes: [
          {
            x: 10,
            y: 10,
            lines: ['ok'],
            arrowFrom: [20, 40],
            arrowTo: [120, 90],
            bow: 20,
            via: [],
          },
        ],
      }),
    ).not.toThrow();
  });

  // `bow` is read against 0 rather than for its truth, so a value that is not
  // a number reaches the sampler instead of falling through to the straight
  // line. The message is not asserted, for the reason the loop's is not: the
  // arc samples to nothing and the pen refuses a point list too short to draw.
  // What is asserted is that NaN no longer draws a straight line in silence,
  // which is what `out` and `span` have refused since they existed.
  it('throws for a bow that is not a finite number, rather than drawing straight', () => {
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() =>
        draw(makeSvg(), {
          nodes,
          edges: [{ from: ['a', 'r'], to: ['b', 'l'], bow: bad }],
        }),
      ).toThrow();
      expect(() =>
        draw(makeSvg(), {
          notes: [
            {
              x: 10,
              y: 10,
              lines: ['n'],
              arrowFrom: [20, 40],
              arrowTo: [120, 90],
              bow: bad,
            },
          ],
        }),
      ).toThrow();
    }
  });

  // The depth wing of the same line: a value somewhere reads must be
  // drawable, a value nothing reads is a field that does not apply. Unlike
  // the bow's, these messages are exact, because the throw is a guard the
  // renderer runs rather than a sampler falling over.
  const badDepths = [Number.NaN, -3, Number.POSITIVE_INFINITY, 0];

  it('refuses an options depth that cannot be drawn, under the diagram-wide extrude', () => {
    for (const bad of badDepths)
      expect(() =>
        draw(makeSvg(), { nodes }, { extrude: true, depth: bad }),
      ).toThrowError(
        new Error(
          `the options depth is ${bad}; a depth is a positive finite number of px`,
        ),
      );
    // Validated because it is read, not because someone inherits it: the
    // only node carries a valid depth of its own, and the options one still
    // throws in its own words.
    expect(() =>
      draw(
        makeSvg(),
        {
          nodes: [
            { id: 'n', shape: 'box', x: 0, y: 0, w: 60, h: 40, depth: 20 },
          ],
        },
        { extrude: true, depth: Number.NaN },
      ),
    ).toThrowError(
      new Error(
        'the options depth is NaN; a depth is a positive finite number of px',
      ),
    );
  });

  it('names the node whose own depth cannot be drawn', () => {
    for (const bad of badDepths)
      expect(() =>
        draw(makeSvg(), {
          nodes: [
            {
              id: 'n',
              shape: 'box',
              x: 0,
              y: 0,
              w: 60,
              h: 40,
              extrude: true,
              depth: bad,
            },
          ],
        }),
      ).toThrowError(
        new Error(
          `node "n" has depth ${bad}; a depth is a positive finite number of px`,
        ),
      );
  });

  // The corner the two tests above leave between them, and the one a mutant
  // lived in: the extrusion is turned on by the diagram-wide switch, because
  // the node carries no `extrude` of its own, and the value that cannot be
  // drawn is the node's own `depth`. Neither the options branch nor a
  // node-level `extrude: true` reaches this throw, so dropping the inherit
  // from the validation's read of the switch used to leave every test green
  // and draw the slab at a depth the pen reads as flat.
  it('names the node whose own depth cannot be drawn under the diagram-wide extrude', () => {
    for (const bad of badDepths) {
      const svg = makeSvg();
      expect(() =>
        draw(
          svg,
          {
            nodes: [
              { id: 'a', shape: 'box', x: 0, y: 0, w: 60, h: 40, depth: bad },
            ],
          },
          { extrude: true },
        ),
      ).toThrowError(
        new Error(
          `node "a" has depth ${bad}; a depth is a positive finite number of px`,
        ),
      );
      // The guard runs ahead of the first wash, so the element is left as it
      // was found rather than holding half a diagram.
      expect(childrenOf(svg)).toHaveLength(0);
    }
  });

  // The inherit corner: the diagram-wide switch is off, so the options depth
  // is read only where a node's own `extrude: true` reaches for it - and the
  // message names that node and the field that carried the value. The flat
  // node beside it proves the read is per-node.
  it('names the node that inherits an options depth nothing else read', () => {
    expect(() =>
      draw(
        makeSvg(),
        {
          nodes: [
            { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50 },
            {
              id: 'up',
              shape: 'box',
              x: 200,
              y: 0,
              w: 100,
              h: 50,
              extrude: true,
            },
          ],
        },
        { depth: Number.POSITIVE_INFINITY },
      ),
    ).toThrowError(
      new Error(
        'node "up" extrudes at the options depth Infinity; a depth is a positive finite number of px',
      ),
    );
  });

  it('ignores a depth nothing reads, valid or not', () => {
    // Extrusion off for the node and for the diagram: `depth: 40` applies to
    // nothing, so the node draws flat and nothing throws - byte-identical to
    // the diagram that never carried the field.
    const carrying = makeSvg();
    draw(carrying, {
      nodes: [{ id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50, depth: 40 }],
    });
    const bare = makeSvg();
    draw(bare, {
      nodes: [{ id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50 }],
    });
    expect(serialize(carrying)).toBe(serialize(bare));
    // The override cutting the other way keeps the field unread: a node that
    // opts out of an extruded diagram never resolves its depth, NaN included.
    expect(() =>
      draw(
        makeSvg(),
        {
          nodes: [
            {
              id: 'a',
              shape: 'box',
              x: 0,
              y: 0,
              w: 100,
              h: 50,
              extrude: false,
              depth: Number.NaN,
            },
          ],
        },
        { extrude: true },
      ),
    ).not.toThrow();
  });

  // 2.2 shipped an incoherence: `depth: Infinity` moved `t` and `r` while
  // the pen read it as flat, so an edge floated off ink that was not there.
  // The throw lands before the group phase, the anchor reads and the pen -
  // the svg is still empty when it does - so the incoherence is dead by
  // construction rather than patched around.
  it('throws before an anchor can move for a slab the pen will not draw', () => {
    const svg = makeSvg();
    expect(() =>
      draw(svg, {
        nodes: [
          {
            id: 'a',
            shape: 'box',
            x: 0,
            y: 0,
            w: 100,
            h: 50,
            extrude: true,
            depth: Number.POSITIVE_INFINITY,
          },
          { id: 'b', shape: 'box', x: 200, y: 0, w: 100, h: 50 },
        ],
        edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
      }),
    ).toThrowError(
      new Error(
        'node "a" has depth Infinity; a depth is a positive finite number of px',
      ),
    );
    expect(childrenOf(svg)).toHaveLength(0);
  });

  it('names the edge and the id when an edge ends nowhere', () => {
    rejects(
      {
        nodes,
        edges: [
          { from: ['a', 'r'], to: ['b', 'l'] },
          { from: ['a', 'r'], to: ['phantom', 'l'] },
        ],
      },
      'edge 1 names unknown node "phantom" in to; known ids are "a", "b"',
    );
  });

  // The node lookup is keyed by a Map. An object literal would inherit
  // Object.prototype, and an edge naming "toString" would find a function
  // there and sail past the check into a crash further down.
  it('rejects an id that only Object.prototype provides', () => {
    rejects(
      { nodes, edges: [{ from: ['toString', 'r'], to: ['b', 'l'] }] },
      'edge 0 names unknown node "toString" in from; known ids are "a", "b"',
    );
  });

  it('names the node and the shape when a shape is unknown', () => {
    rejects(
      {
        nodes: [
          { id: 'odd', shape: 'hexagon', x: 0, y: 0, w: 10, h: 10 },
        ] as unknown as DiagramNode[],
      },
      'node "odd" has unknown shape "hexagon"; expected group, box, pill or diamond',
    );
  });

  // Same inherited-property trap on the shape table.
  it('rejects a shape that only Object.prototype provides', () => {
    rejects(
      {
        nodes: [
          { id: 'odd', shape: 'constructor', x: 0, y: 0, w: 10, h: 10 },
        ] as unknown as DiagramNode[],
      },
      'node "odd" has unknown shape "constructor"; expected group, box, pill or diamond',
    );
  });

  it('names the edge when a label has no lx', () => {
    const edge: DiagramEdge = {
      from: ['a', 'r'],
      to: ['b', 'l'],
      label: 'where?',
      ly: 25,
    };
    rejects(
      { nodes, edges: [edge] },
      'edge 0 has label "where?" but lx and ly are not both numbers; labels are placed by hand because text is never measured',
    );
  });

  it('names the edge when a label has no ly', () => {
    const edge: DiagramEdge = {
      from: ['a', 'r'],
      to: ['b', 'l'],
      label: 'where?',
      lx: 150,
    };
    rejects(
      { nodes, edges: [edge] },
      'edge 0 has label "where?" but lx and ly are not both numbers; labels are placed by hand because text is never measured',
    );
  });

  it('names the edge when lx and ly are not numbers', () => {
    const edge = {
      from: ['a', 'r'],
      to: ['b', 'l'],
      label: 'where?',
      lx: '150',
      ly: '25',
    } as unknown as DiagramEdge;
    rejects(
      { nodes, edges: [edge] },
      'edge 0 has label "where?" but lx and ly are not both numbers; labels are placed by hand because text is never measured',
    );
  });

  // Until this threw, `byId.set` in a loop kept the last node with a given id.
  // Every edge naming it pointed at a box the author never meant, and nothing
  // in the rendered picture said why.
  it('rejects two nodes sharing an id', () => {
    rejects(
      {
        nodes: [
          ...nodes,
          { id: 'a', shape: 'pill', x: 0, y: 100, w: 60, h: 30 },
        ],
      },
      'two nodes share the id "a"; edges name nodes by id, so ids must be unique',
    );
  });

  // The ids that do exist are what turns a typo into a one-line fix, so the
  // message carries them - capped, or a large diagram's list buries the point.
  it('lists the ids that do exist, capped past eight', () => {
    const many: DiagramNode[] = Array.from({ length: 11 }, (_, i) => ({
      id: `n${i}`,
      shape: 'box',
      x: i * 20,
      y: 0,
      w: 10,
      h: 10,
    }));
    rejects(
      { nodes: many, edges: [{ from: ['nope', 'r'], to: ['n0', 'l'] }] },
      'edge 0 names unknown node "nope" in from; known ids include "n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7" and 3 more',
    );
  });

  it('says so plainly when there are no nodes at all', () => {
    rejects(
      { edges: [{ from: ['a', 'r'], to: ['b', 'l'] }] },
      'edge 0 names unknown node "a" in from; the diagram has no nodes',
    );
  });
});

describe('draw() accessible labeling', () => {
  it('sets role and aria-label when a label is given', () => {
    const svg = makeSvg();
    const options: DrawOptions = { label: 'Request flow' };
    draw(svg, ALL_PHASES, options);

    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('Request flow');
  });

  it('sets neither when no label is given', () => {
    const svg = makeSvg();
    draw(svg, ALL_PHASES);

    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.hasAttribute('aria-label')).toBe(false);
  });

  // Setting nothing is not the same as clearing something: labeling the svg
  // in the caller's own markup is a supported way to do it, and a draw that
  // was not asked to label must leave that alone.
  it('leaves labeling the caller put in their own markup alone', () => {
    const host = document.createElement('div');
    host.innerHTML = '<svg role="img" aria-label="mine"></svg>';
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('the markup fixture has no <svg>');

    draw(svg, ALL_PHASES);

    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('mine');
  });
});

describe('draw() DOM independence', () => {
  it('renders into an svg from another jsdom, never reaching for the ambient document', () => {
    const foreign = foreignSvg();
    expect(foreign.ownerDocument).not.toBe(document);

    const ambient = vi.spyOn(document, 'createElementNS');
    try {
      draw(foreign, ALL_PHASES, { seed: 7 });
      // Asserted before restoring: mockRestore also clears the recorded
      // calls, so checking afterwards would pass no matter what happened.
      expect(ambient).not.toHaveBeenCalled();
    } finally {
      ambient.mockRestore();
    }

    const local = makeSvg();
    draw(local, ALL_PHASES, { seed: 7 });
    expect(serialize(foreign)).toBe(serialize(local));
  });
});

describe('draw() group phase', () => {
  const group: Diagram = {
    nodes: [
      {
        id: 'g',
        shape: 'group',
        x: 10,
        y: 20,
        w: 200,
        h: 100,
        lines: ['team'],
      },
    ],
  };

  it('washes the box, then borders it, then titles it in the pen colour', () => {
    const svg = makeSvg();
    draw(svg, group);

    expect(tagsOf(svg)).toEqual(['rect', ...Array(8).fill('path'), 'text']);

    const wash = nth(Array.from(svg.children), 0);
    expect(num(wash, 'x')).toBe(10);
    expect(num(wash, 'y')).toBe(20);
    expect(num(wash, 'width')).toBe(200);
    expect(num(wash, 'height')).toBe(100);
    expect(num(wash, 'rx')).toBe(WASH_RX);
    expect(attr(wash, 'fill')).toBe(defaultTheme.wash);

    for (const path of pathsOf(svg))
      expect(attr(path, 'stroke')).toBe(defaultTheme.pen);
    expect(num(nth(pathsOf(svg), 0), 'stroke-width')).toBe(GROUP_W);

    const title = nth(textsOf(svg), 0);
    expect(num(title, 'x')).toBe(10 + TITLE_DX);
    expect(num(title, 'y')).toBe(20 + TITLE_DY);
    expect(attr(title, 'text-anchor')).toBe('start');
    expect(styleOf(title)).toBe(
      `fill:${defaultTheme.pen};font-size:${TITLE_SIZE}px`,
    );
  });
});

describe('draw() edge phase', () => {
  const nodes: DiagramNode[] = [
    { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50 },
    { id: 'b', shape: 'box', x: 200, y: 0, w: 100, h: 50 },
  ];
  // Edges are drawn before nodes, so an edge's own elements are always the
  // ones at the front of the document.
  const edgeOf = (svg: SVGSVGElement) => ({
    shaft: nth(pathsOf(svg), 0),
    label: nth(textsOf(svg), 0),
  });

  it('draws a plain edge in ink and labels it in muted', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes,
      edges: [
        { from: ['a', 'r'], to: ['b', 'l'], label: 'plain', lx: 150, ly: 25 },
      ],
    });

    const { shaft, label } = edgeOf(svg);
    expect(attr(shaft, 'stroke')).toBe(defaultTheme.ink);
    expect(attr(shaft, 'stroke-dasharray')).toBeNull();
    expect(label.textContent).toBe('plain');
    expect(styleOf(label)).toBe(
      `fill:${defaultTheme.muted};font-size:${EDGE_SIZE}px`,
    );
    expect(attr(label, 'text-anchor')).toBe('middle');
  });

  it('draws a dotted edge and its label in the accent colour', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes,
      edges: [
        {
          from: ['a', 'r'],
          to: ['b', 'l'],
          dotted: true,
          label: 'maybe',
          lx: 150,
          ly: 25,
          anchor: 'start',
        },
      ],
    });

    const { shaft, label } = edgeOf(svg);
    expect(attr(shaft, 'stroke')).toBe(defaultTheme.accent);
    expect(attr(shaft, 'stroke-dasharray')).toBe(DASH);
    expect(styleOf(label)).toBe(
      `fill:${defaultTheme.accent};font-size:${EDGE_SIZE}px`,
    );
    expect(attr(label, 'text-anchor')).toBe('start');
  });

  it('threads the shaft from anchor through via to anchor', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes,
      edges: [{ from: ['a', 'r'], to: ['b', 'l'], via: [[150, 200]] }],
    });

    const points = pointsOf(nth(pathsOf(svg), 0));
    const near = (target: Point) =>
      points.some(([x, y]) => Math.hypot(x - target[0], y - target[1]) < 2);
    expect(near(anchor(nth(nodes, 0), 'r'))).toBe(true);
    expect(near([150, 200])).toBe(true);
    expect(near(anchor(nth(nodes, 1), 'l'))).toBe(true);
  });
});

describe('draw() self-transitions', () => {
  const nodes: DiagramNode[] = [
    { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50 },
  ];
  // The right side of `a`: x = 100, vertical middle y = 25.
  const MID: Point = [100, 25];
  const loopOf = (edge: DiagramEdge) => {
    const svg = makeSvg();
    draw(svg, { nodes, edges: [edge] });
    return svg;
  };

  it('leaves and returns to the side both ends name', () => {
    const points = pointsOf(
      nth(pathsOf(loopOf({ from: ['a', 'r'], to: ['a', 'r'] })), 0),
    );
    const first = nth(points, 0);
    const last = nth(points, points.length - 1);

    // Both anchors on the side, half a span either way from its middle. The
    // tolerance is the pen's own: the M point wanders the full amplitude and
    // the last point of a leg is damped, which is what every other assertion
    // in this file allows for too.
    expect(Math.abs(first[0] - MID[0])).toBeLessThanOrEqual(1.3);
    expect(Math.abs(first[1] - (MID[1] - LOOP_SPAN / 2))).toBeLessThanOrEqual(
      1.3,
    );
    expect(Math.abs(last[0] - MID[0])).toBeLessThanOrEqual(0.52);
    expect(Math.abs(last[1] - (MID[1] + LOOP_SPAN / 2))).toBeLessThanOrEqual(
      0.52,
    );
  });

  it("sets the anchors span apart, and span is the caller's to change", () => {
    const separation = (edge: DiagramEdge) => {
      const points = pointsOf(nth(pathsOf(loopOf(edge)), 0));
      return nth(points, points.length - 1)[1] - nth(points, 0)[1];
    };
    // Both endpoints carry jitter, so the gap between them is good to the sum
    // of their two bounds and no better. Without the second case a renderer
    // that ignored `span` entirely would pass the first - which is why the
    // number it asks for has to be one `LOOP_SPAN` is not. It was 40 until
    // `LOOP_SPAN` became 40, at which point this test passed with `span` read
    // and with `span` ignored alike, and said so in neither.
    expect(separation({ from: ['a', 'r'], to: ['a', 'r'] })).toBeGreaterThan(
      LOOP_SPAN - 1.82,
    );
    expect(separation({ from: ['a', 'r'], to: ['a', 'r'] })).toBeLessThan(
      LOOP_SPAN + 1.82,
    );
    expect(
      separation({ from: ['a', 'r'], to: ['a', 'r'], span: 64 }),
    ).toBeGreaterThan(64 - 1.82);
    expect(
      separation({ from: ['a', 'r'], to: ['a', 'r'], span: 64 }),
    ).toBeLessThan(64 + 1.82);
  });

  it("projects LOOP_OUT beyond the side, and out is the caller's to change", () => {
    const reach = (edge: DiagramEdge) =>
      Math.max(...pointsOf(nth(pathsOf(loopOf(edge)), 0)).map(([x]) => x)) -
      MID[0];

    // Two corrections between `out` and the furthest ink, and both have to be
    // in the bound or this asserts nothing. The sweep is sampled, so the
    // furthest vertex falls half a chord short of the apex - the same
    // shortfall pen.test.ts pins for an arc. Then the pen jitters it, which
    // can push it back out by up to half the amplitude.
    const apex = (out: number) => out * Math.cos(Math.PI / ARC_STEPS);
    const reaches = (edge: DiagramEdge, out: number) => {
      expect(reach(edge)).toBeGreaterThanOrEqual(apex(out) - 1.3);
      expect(reach(edge)).toBeLessThanOrEqual(apex(out) + 1.3);
    };
    reaches({ from: ['a', 'r'], to: ['a', 'r'] }, LOOP_OUT);
    reaches({ from: ['a', 'r'], to: ['a', 'r'], out: 20 }, 20);
  });

  it('hangs off whichever side is named', () => {
    const away = {
      r: ([x]: Point) => x - 100,
      l: ([x]: Point) => -x,
      t: ([, y]: Point) => -y,
      b: ([, y]: Point) => y - 50,
    };
    for (const side of ['r', 'l', 't', 'b'] as const) {
      const points = pointsOf(
        nth(pathsOf(loopOf({ from: ['a', side], to: ['a', side] })), 0),
      );
      // Every point of the loop is outside the box on the named side, and the
      // furthest is LOOP_OUT away, within the jitter. A loop drawn on the
      // wrong side, or inside the node, fails on the first clause rather than
      // the second - which is the one that would otherwise pass on any side.
      const apex = LOOP_OUT * Math.cos(Math.PI / ARC_STEPS);
      expect(Math.min(...points.map(away[side]))).toBeGreaterThanOrEqual(-1.3);
      expect(Math.max(...points.map(away[side]))).toBeGreaterThanOrEqual(
        apex - 1.3,
      );
      expect(Math.max(...points.map(away[side]))).toBeLessThanOrEqual(
        apex + 1.3,
      );
    }
  });

  // 2.5: a loop is an edge. None of this is loop-specific code - it works
  // because `draw` asks nothing about a loop after choosing its points, so
  // these assertions are here to keep it that way.
  it('takes dotted, label, lx, ly and anchor exactly as any edge does', () => {
    const svg = loopOf({
      from: ['a', 'r'],
      to: ['a', 'r'],
      dotted: true,
      label: 'retry',
      lx: 170,
      ly: 25,
      anchor: 'start',
    });

    const paths = pathsOf(svg);
    // Shaft dashed, barbs bare - the arrowhead rule every edge follows.
    expect(attr(nth(paths, 0), 'stroke-dasharray')).toBe(DASH);
    expect(attr(nth(paths, 2), 'stroke-dasharray')).toBeNull();
    expect(attr(nth(paths, 0), 'stroke')).toBe(defaultTheme.accent);

    const label = nth(textsOf(svg), 0);
    expect(label.textContent).toBe('retry');
    expect(num(label, 'x')).toBe(170);
    expect(attr(label, 'text-anchor')).toBe('start');
    expect(styleOf(label)).toBe(
      `fill:${defaultTheme.accent};font-size:${EDGE_SIZE}px`,
    );
  });

  it('still needs coordinates for its label, like every other edge', () => {
    expect(() =>
      draw(makeSvg(), {
        nodes,
        edges: [{ from: ['a', 'r'], to: ['a', 'r'], label: 'no home' }],
      }),
    ).toThrowError(/lx and ly are not both numbers/);
  });

  // `??` and not `||`: a caller who asks for nought gets nought. The two
  // spellings read alike in a diff and differ by a whole loop in the picture,
  // and neither value is one a drawing would notice going missing.
  it('takes out 0 and span 0 as asked rather than as absent', () => {
    const loop = (edge: DiagramEdge) => pointsOf(nth(pathsOf(loopOf(edge)), 0));
    const reach = (edge: DiagramEdge) =>
      Math.max(...loop(edge).map(([x]) => x)) - MID[0];
    const apart = (edge: DiagramEdge) => {
      const pts = loop(edge);
      return Math.abs(nth(pts, pts.length - 1)[1] - nth(pts, 0)[1]);
    };
    const both: DiagramEdge = { from: ['a', 'r'], to: ['a', 'r'] };

    // Against the constants rather than against numbers copied out of them,
    // so that moving a default cannot quietly stop this asserting anything.
    expect(reach(both)).toBeGreaterThan(LOOP_OUT / 2);
    expect(reach({ ...both, out: 0 })).toBeLessThan(2);
    expect(apart(both)).toBeGreaterThan(LOOP_SPAN / 2);
    expect(apart({ ...both, span: 0 })).toBeLessThan(3);
  });

  // The entire point of doing this in data rather than through `raw`: a
  // callback cannot cross this boundary, and a loop has to. The crossing on
  // its own cannot fail - arrays, strings and numbers all survive JSON - so
  // what is asserted is the pair of claims that can. That `draw` hands the
  // diagram back as it found it matters most to the caller who renders the
  // same object twice, and it is the one defect a round trip would otherwise
  // hide, because a mutated diagram serializes to its mutated self.
  it('leaves the diagram as it found it, and draws it the same after JSON', () => {
    const diagram: Diagram = {
      nodes,
      edges: [
        {
          from: ['a', 'r'],
          to: ['a', 'r'],
          out: 40,
          span: 18,
          label: 'again',
          lx: 150,
          ly: 25,
        },
        // Sized by nothing, so a `draw` that wrote its defaults back onto the
        // caller's edge would show up here and nowhere else. The edge above
        // carries both numbers already and would absorb the same mutation
        // without a trace.
        { from: ['a', 't'], to: ['a', 't'] },
      ],
    };
    const before = JSON.stringify(diagram);
    const direct = makeSvg();
    draw(direct, diagram);
    expect(JSON.stringify(diagram)).toBe(before);

    const crossed = makeSvg();
    draw(crossed, JSON.parse(before) as Diagram);
    expect(serialize(crossed)).toBe(serialize(direct));
  });
});

describe('draw() braces', () => {
  const nodes: DiagramNode[] = [
    { id: 'a', shape: 'box', x: 40, y: 40, w: 150, h: 46, lines: ['one'] },
    { id: 'b', shape: 'box', x: 40, y: 110, w: 150, h: 46, lines: ['two'] },
    { id: 'c', shape: 'box', x: 40, y: 180, w: 150, h: 46, lines: ['three'] },
  ];
  // The shape the change exists for: three boxes marked as a set without a
  // rectangle drawn round them, and no `raw` callback anywhere in it.
  const spanning: Diagram = {
    nodes,
    braces: [
      {
        from: [210, 40],
        to: [210, 226],
        depth: -26,
        lines: ['the batch'],
        lx: 250,
        ly: 133,
      },
    ],
  };

  it('draws a brace over what it spans, from data alone', () => {
    const svg = makeSvg();
    draw(svg, spanning);
    const bare = makeSvg();
    draw(bare, { nodes });
    // Two paths and no more: the brace is one stroke, and nothing draws a
    // rectangle round the set it marks. Measured as a difference rather than
    // as a total, so it says what the brace costs rather than what a box does.
    expect(pathsOf(svg).length - pathsOf(bare).length).toBe(2);
    expect(contents(svg)).toEqual(['one', 'two', 'three', 'the batch']);
  });

  it('strokes the brace and its label in theme.pen, not ink or accent', () => {
    const svg = makeSvg();
    draw(svg, {
      braces: [{ from: [0, 0], to: [0, 100], lines: ['set'], lx: 30, ly: 50 }],
    });
    for (const path of pathsOf(svg))
      expect(attr(path, 'stroke')).toBe(defaultTheme.pen);
    expect(styleOf(nth(textsOf(svg), 0))).toBe(
      `fill:${defaultTheme.pen};font-size:${SIZE}px`,
    );
  });

  it('refuses lines without coordinates, as an edge label is refused', () => {
    expect(() =>
      draw(makeSvg(), {
        braces: [{ from: [0, 0], to: [0, 100], lines: ['set'], lx: 30 }],
      }),
    ).toThrowError(
      new Error(
        'brace 0 has lines but lx and ly are not both numbers; labels are placed by hand because text is never measured',
      ),
    );
  });

  // A brace is data, which is the whole reason it is not a `raw` callback.
  it('survives a JSON boundary and draws the same on the other side', () => {
    const before = JSON.stringify(spanning);
    const direct = makeSvg();
    draw(direct, spanning);
    expect(JSON.stringify(spanning)).toBe(before);

    const crossed = makeSvg();
    draw(crossed, JSON.parse(before) as Diagram);
    expect(serialize(crossed)).toBe(serialize(direct));
  });

  // The phase draws from the seeded sequence only when it has something to
  // draw, so every diagram written before this change renders byte for byte
  // as it did. The parity tests hold the same claim against goldens generated
  // from the reference renderer; this holds it against the empty array, which
  // those cannot reach.
  it('consumes nothing from the sequence when there are no braces', () => {
    const without = makeSvg();
    const empty = makeSvg();
    draw(without, { nodes });
    draw(empty, { nodes, braces: [] });
    expect(serialize(empty)).toBe(serialize(without));
  });
});

describe('draw() bowed connectors', () => {
  const nodes: DiagramNode[] = [
    { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 50 },
    { id: 'b', shape: 'box', x: 200, y: 0, w: 100, h: 50 },
    { id: 'c', shape: 'box', x: 0, y: 200, w: 100, h: 50 },
  ];
  // a's right side is [100, 25] and b's left is [200, 25], so the chord
  // between them lies along y = 25. a's bottom is [50, 50] and c's top is
  // [50, 200], so that one runs down x = 50. Both are read as a signed
  // distance from the chord, positive to the right of travel, which is what
  // the field claims to be measured in.
  const shaft = (edge: DiagramEdge) => {
    const svg = makeSvg();
    draw(svg, { nodes, edges: [edge] });
    return pointsOf(nth(pathsOf(svg), 0));
  };
  const rightGoingRight = (edge: DiagramEdge) =>
    shaft(edge).map(([, y]) => y - 25);
  const rightGoingDown = (edge: DiagramEdge) =>
    shaft(edge).map(([x]) => 50 - x);
  // Half the jitter amplitude, which is as far as the pen moves any point.
  const J = 1.3;

  it('bows a pair between one node and another to opposite sides', () => {
    const there = rightGoingRight({
      from: ['a', 'r'],
      to: ['b', 'l'],
      bow: 30,
    });
    const back = rightGoingRight({ from: ['b', 'l'], to: ['a', 'r'], bow: 30 });

    // Right of travel, on a screen whose y grows downward, is below the line
    // going out and above it coming back - so the same `bow` on an edge and
    // its reverse draws two lines and not one. Neither strays to the wrong
    // side of the chord by more than the pen's own wander.
    expect(Math.min(...there)).toBeGreaterThan(-J);
    expect(Math.max(...back)).toBeLessThan(J);

    // 30 px was asked for. The 124-degree sweep takes nine chords, an odd
    // number, so the apex falls between two vertices rather than on one and
    // the deepest sits 29.59 px off the chord - 0.41 px short, measured.
    const DEEP = 29.59;
    expect(Math.max(...there)).toBeGreaterThan(DEEP - J);
    expect(Math.max(...there)).toBeLessThan(DEEP + J);
    expect(Math.min(...back)).toBeLessThan(-(DEEP - J));
    expect(Math.min(...back)).toBeGreaterThan(-(DEEP + J));
  });

  // The case that separates a perpendicular from a fixed side of the page: on
  // a chord running down rather than across, right of travel is smaller x.
  // Built as (dy, -dx) instead of (-dy, dx) it lands on the other one, and
  // every assertion above still passes.
  it('turns the perpendicular with the chord, not with the page', () => {
    const down = rightGoingDown({ from: ['a', 'b'], to: ['c', 't'], bow: 30 });
    const other = rightGoingDown({
      from: ['a', 'b'],
      to: ['c', 't'],
      bow: -30,
    });

    // A shallower sweep across a longer chord: 87 degrees at a radius of
    // 108.75, seven chords, deepest vertex 29.36 px off. This is also the
    // pair that crosses `atan2`'s own seam at the -x axis, where the two end
    // angles come back a turn apart and the sweep has to be brought back.
    const DEEP = 29.36;
    expect(Math.min(...down)).toBeGreaterThan(-J);
    expect(Math.max(...down)).toBeGreaterThan(DEEP - J);
    expect(Math.max(...down)).toBeLessThan(DEEP + J);
    expect(Math.max(...other)).toBeLessThan(J);
    expect(Math.min(...other)).toBeLessThan(-(DEEP - J));
    expect(Math.min(...other)).toBeGreaterThan(-(DEEP + J));
  });

  it('draws a bow deeper than half the chord instead of flattening it', () => {
    // 80 px across a 100 px chord, which puts the circle's centre on the
    // bow's own side of the line. Nothing corrects that, and nothing here
    // should: it is the arc that was asked for.
    const edge: DiagramEdge = { from: ['a', 'r'], to: ['b', 'l'], bow: 80 };
    const deep = rightGoingRight(edge);
    const DEEP = 79.61;
    expect(Math.min(...deep)).toBeGreaterThan(-J);
    expect(Math.max(...deep)).toBeGreaterThan(DEEP - J);
    expect(Math.max(...deep)).toBeLessThan(DEEP + J);

    // The sweep is 232 degrees, so the arc reaches 5.6 px back behind each
    // anchor - measured, and four times the pen's own wander. An arc of half
    // a turn or less stays between the two anchors, which is what a bow
    // silently clamped to the chord would draw.
    const xs = shaft(edge).map(([x]) => x);
    expect(Math.min(...xs)).toBeLessThan(100 - J);
    expect(Math.max(...xs)).toBeGreaterThan(200 + J);
  });

  // Nought is not a flat arc - an arc through it has neither centre nor
  // radius - it is the line the edge would have drawn without the field at
  // all, and it has to be that line down to the byte rather than to a
  // tolerance. That the same line is also the one drawn before bows existed
  // is what the parity tests hold, by re-rendering the reference's fixtures.
  it('takes a bow of 0 as the straight line, byte for byte', () => {
    const straight = makeSvg();
    draw(straight, { nodes, edges: [{ from: ['a', 'r'], to: ['b', 'l'] }] });
    const flat = makeSvg();
    draw(flat, {
      nodes,
      edges: [{ from: ['a', 'r'], to: ['b', 'l'], bow: 0 }],
    });
    expect(serialize(flat)).toBe(serialize(straight));
  });
});

describe('draw() node phase', () => {
  const at = (
    extra: Partial<Exclude<DiagramNode, { shape: 'group' }>>,
  ): Diagram => ({
    nodes: [{ id: 'n', shape: 'box', x: 0, y: 0, w: 60, h: 40, ...extra }],
  });

  it('strokes a plain node in ink and an accent node in pen', () => {
    const plain = makeSvg();
    draw(plain, at({}));
    expect(attr(nth(pathsOf(plain), 0), 'stroke')).toBe(defaultTheme.ink);

    const accent = makeSvg();
    draw(accent, at({ accent: true }));
    expect(attr(nth(pathsOf(accent), 0), 'stroke')).toBe(defaultTheme.pen);
  });

  it('draws each shape with the primitive it names', () => {
    // A box is four independent sides; a pill and a diamond are each one
    // closed polyline.
    const shapes = [
      ['box', 8],
      ['pill', 2],
      ['diamond', 2],
    ] as const;
    for (const [shape, paths] of shapes) {
      const svg = makeSvg();
      draw(svg, at({ shape }));
      expect(pathsOf(svg)).toHaveLength(paths);
    }
  });

  const hatchInk = (svg: SVGSVGElement): Point[] =>
    pathsOf(svg)
      .filter((path) => num(path, 'stroke-width') === HATCH_W)
      .flatMap((path) => pointsOf(path));

  it('hatches a box in pen, inset from its outline', () => {
    const svg = makeSvg();
    draw(svg, at({ hatch: true }));

    const hatched = pathsOf(svg).filter(
      (path) => num(path, 'stroke-width') === HATCH_W,
    );
    expect(hatched.length).toBeGreaterThan(0);
    for (const path of hatched) {
      expect(attr(path, 'stroke')).toBe(defaultTheme.pen);
      for (const [x, y] of pointsOf(path)) {
        // Inside the inset box, give or take the hatch jitter.
        expect(x).toBeGreaterThanOrEqual(HATCH_INSET - 1);
        expect(x).toBeLessThanOrEqual(60 - HATCH_INSET + 1);
        expect(y).toBeGreaterThanOrEqual(HATCH_INSET - 1);
        expect(y).toBeLessThanOrEqual(40 - HATCH_INSET + 1);
      }
    }
  });

  // The two shapes whose outline is not their box. Both used to be shaded to
  // the box regardless: a pill overshot its ellipse by 15.5 px on the 150 x 50
  // this repository ships, and a diamond filled all four corners of its box,
  // which is half the box's area and none of the shape's. Held to the outline
  // here, not to the box, so that neither can quietly go back.
  it('cuts a hatched pill to its ellipse', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes: [
        { id: 'n', shape: 'pill', x: 0, y: 0, w: 150, h: 50, hatch: true },
      ],
    });

    const ink = hatchInk(svg);
    expect(ink.length).toBeGreaterThan(0);
    for (const [x, y] of ink) {
      // Radii grown by the jitter, so only ink the renderer aimed outside can
      // fail this.
      const rx = 75 + 1;
      const ry = 25 + 1;
      expect(((x - 75) / rx) ** 2 + ((y - 25) / ry) ** 2).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it('cuts a hatched diamond to its four sides, leaving the corners of its box bare', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes: [
        { id: 'n', shape: 'diamond', x: 0, y: 0, w: 150, h: 76, hatch: true },
      ],
    });

    const ink = hatchInk(svg);
    expect(ink.length).toBeGreaterThan(0);
    // |dx|/a + |dy|/b <= 1 is the diamond; the slack is the jitter carried
    // through both terms.
    for (const [x, y] of ink)
      expect(Math.abs(x - 75) / 75 + Math.abs(y - 38) / 38).toBeLessThanOrEqual(
        1.03,
      );
    // And said the other way round: a 12 px square in each corner of the box,
    // every one of them wholly outside the diamond, and every one of them
    // shaded before this. The two assertions fail differently - the one above
    // lets a clip a little too generous through, and this one names the four
    // triangles that are half the box's area and none of the shape's.
    for (const [cx, cy] of [
      [0, 0],
      [138, 0],
      [0, 64],
      [138, 64],
    ] as const)
      expect(
        ink.some(
          ([x, y]) => x >= cx && x <= cx + 12 && y >= cy && y <= cy + 12,
        ),
      ).toBe(false);
  });

  it('centres the label and takes the size the node asks for', () => {
    const standard = makeSvg();
    draw(standard, at({ lines: ['hello'] }));
    const label = nth(textsOf(standard), 0);
    expect(num(label, 'x')).toBe(30);
    expect(num(label, 'y')).toBe(20);
    expect(styleOf(label)).toBe(`fill:${defaultTheme.ink};font-size:${SIZE}px`);

    const sized = makeSvg();
    draw(sized, at({ lines: ['hello'], size: 9 }));
    expect(styleOf(nth(textsOf(sized), 0))).toBe(
      `fill:${defaultTheme.ink};font-size:9px`,
    );
  });

  it('draws no text for a node with no lines', () => {
    const svg = makeSvg();
    draw(svg, at({}));
    expect(textsOf(svg)).toHaveLength(0);
  });
});

describe('draw() extrusion', () => {
  const BOX: Diagram = {
    nodes: [{ id: 'n', shape: 'box', x: 0, y: 0, w: 60, h: 40 }],
  };
  const inkPaths = (svg: SVGSVGElement) =>
    pathsOf(svg).filter((path) => attr(path, 'stroke') === defaultTheme.ink);
  const mutedPaths = (svg: SVGSVGElement) =>
    pathsOf(svg).filter((path) => attr(path, 'stroke') === defaultTheme.muted);
  // A jittered point lands within amplitude / 2 of where it was aimed, so an
  // assertion against that bound fails only if the renderer aimed elsewhere.
  const expectNear = (actual: Point, expected: Point) => {
    expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(AMP / 2);
    expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(AMP / 2);
  };
  // The offset chain is the first path after a box's eight front sides, and
  // its first point is the top-left corner plus the extrusion vector - the
  // one point that reads the resolved depth straight off the render.
  const chainStart = (svg: SVGSVGElement): Point =>
    nth(pointsOf(nth(pathsOf(svg), 8)), 0);

  it('extrudes a box under the diagram-wide switch', () => {
    const flat = makeSvg();
    draw(flat, BOX);
    const extruded = makeSvg();
    draw(extruded, BOX, { extrude: true });

    // The slab is ordinary passes: one chain (two passes), two connectors
    // (two each), and the muted face shading after them - which the flat
    // render has none of.
    expect(inkPaths(extruded)).toHaveLength(inkPaths(flat).length + 6);
    expect(mutedPaths(flat)).toHaveLength(0);
    expect(mutedPaths(extruded).length).toBeGreaterThan(0);
  });

  it('extrudes at DEPTH when no depth is given anywhere', () => {
    const svg = makeSvg();
    draw(svg, BOX, { extrude: true });
    expectNear(chainStart(svg), [DEPTH, -DEPTH_RISE * DEPTH]);
  });

  it('takes the node depth over the options depth', () => {
    const svg = makeSvg();
    draw(
      svg,
      {
        nodes: [{ id: 'n', shape: 'box', x: 0, y: 0, w: 60, h: 40, depth: 20 }],
      },
      { extrude: true, depth: 10 },
    );
    expectNear(chainStart(svg), [20, -DEPTH_RISE * 20]);
  });

  it('flattens one node of an extruded diagram: extrude false wins', () => {
    const optOut: Diagram = {
      nodes: [
        { id: 'n', shape: 'box', x: 0, y: 0, w: 60, h: 40, extrude: false },
      ],
    };
    const flattened = makeSvg();
    draw(flattened, optOut, { extrude: true, depth: 20 });
    const flat = makeSvg();
    draw(flat, BOX);

    expect(serialize(flattened)).toBe(serialize(flat));
  });

  it('extrudes one node of a flat diagram: extrude true wins', () => {
    const optIn: Diagram = {
      nodes: [
        { id: 'n', shape: 'box', x: 0, y: 0, w: 60, h: 40, extrude: true },
      ],
    };
    const byNode = makeSvg();
    draw(byNode, optIn);
    const byOption = makeSvg();
    draw(byOption, BOX, { extrude: true });

    // The node's own switch resolves to the render the diagram-wide one
    // produces: same default depth, same sequence, same bytes.
    expect(serialize(byNode)).toBe(serialize(byOption));
    expect(mutedPaths(byNode).length).toBeGreaterThan(0);
  });

  it('draws a group-only diagram flat under a diagram-wide extrude', () => {
    const grouped: Diagram = {
      nodes: [
        { id: 'g', shape: 'group', x: 0, y: 0, w: 200, h: 100, lines: ['set'] },
      ],
    };
    const bare = makeSvg();
    draw(bare, grouped);
    const switched = makeSvg();
    draw(switched, grouped, { extrude: true, depth: 40 });

    // A group bounds a set, it is not an object: the diagram-wide pair
    // changes nothing about its frame, not one byte.
    expect(serialize(switched)).toBe(serialize(bare));
  });

  it('keeps the group frame bytes while extruding the shapes beside it', () => {
    const mixed: Diagram = {
      nodes: [
        { id: 'g', shape: 'group', x: 0, y: 0, w: 300, h: 200, lines: ['set'] },
        { id: 'n', shape: 'box', x: 20, y: 40, w: 80, h: 40 },
      ],
    };
    const flat = makeSvg();
    draw(flat, mixed);
    const extruded = makeSvg();
    draw(extruded, mixed, { extrude: true });

    // The group phase draws first - wash, two frame passes, title - so its
    // four elements lead both documents, and extrusion downstream of them
    // cannot move a byte they already hold.
    const frame = (svg: SVGSVGElement) =>
      childrenOf(svg)
        .slice(0, 4)
        .map((el) => el.outerHTML);
    expect(frame(extruded)).toEqual(frame(flat));
    expect(mutedPaths(extruded).length).toBeGreaterThan(0);
  });

  // A group's anchors are flat on the same terms its frame is: it bounds a
  // set rather than standing as an object, so the diagram-wide pair moves
  // neither. The three tests above compare frame bytes, and a group that
  // wrongly resolved a depth would leave every one of those bytes alone - an
  // anchor is the only thing that moves, and nothing else in this suite
  // attaches an edge to a group at all.
  it('keeps an edge attached to a group on the flat anchor', () => {
    const svg = makeSvg();
    draw(
      svg,
      {
        nodes: [
          {
            id: 'g',
            shape: 'group',
            x: 40,
            y: 20,
            w: 160,
            h: 60,
            lines: ['set'],
          },
          { id: 'n', shape: 'box', x: 320, y: 140, w: 80, h: 40 },
        ],
        edges: [
          { from: ['g', 'r'], to: ['n', 'l'] },
          { from: ['n', 'b'], to: ['g', 't'] },
        ],
      },
      { extrude: true, seed: 7 },
    );
    // The group frame is drawn in the pen colour, so the ink paths start at
    // the edges; an arrow is a shaft and two barbs at two passes each, so
    // each edge contributes six of them and every shaft is the first of six.
    const shaft = (i: number) => pointsOf(nth(inkPaths(svg), i * 6));
    const out = shaft(0);
    const back = shaft(1);
    // g's r midpoint, (40 + 160, 20 + 30). Both sides the extrusion vector
    // would move are asserted: were a group to resolve DEPTH, this end would
    // start at (212, 41) and the other would land at (132, 11), each some
    // nine times the jitter bound from where it belongs.
    expectNear(nth(out, 0), [200, 50]);
    // g's t midpoint, (40 + 80, 20), where the second edge points.
    expectNear(nth(back, back.length - 1), [120, 20]);
  });

  it('ignores the pair on a group itself: a field that does not apply', () => {
    // `GroupNode` does not carry the pair, so the types and the schema both
    // refuse it there; the cast is how a JavaScript caller's data gets past
    // them, and what it finds is a field that does not apply, ignored.
    const carrying = {
      nodes: [
        {
          id: 'g',
          shape: 'group',
          x: 0,
          y: 0,
          w: 200,
          h: 100,
          lines: ['set'],
          extrude: true,
          depth: 40,
        },
      ] as unknown as DiagramNode[],
    };
    const bare: Diagram = {
      nodes: [
        { id: 'g', shape: 'group', x: 0, y: 0, w: 200, h: 100, lines: ['set'] },
      ],
    };
    const withPair = makeSvg();
    draw(withPair, carrying);
    const without = makeSvg();
    draw(without, bare);

    expect(serialize(withPair)).toBe(serialize(without));
  });

  it('renders a flat diagram byte-identically whether the pair is absent or off', () => {
    // The pre-change bytes themselves are pinned by the parity goldens; what
    // this adds in-process is that `extrude: false` and a depth nothing reads
    // put nothing into them.
    const bare = makeSvg();
    draw(bare, ALL_PHASES, { seed: 7 });
    const off = makeSvg();
    draw(off, ALL_PHASES, { seed: 7, extrude: false, depth: 40 });

    expect(serialize(off)).toBe(serialize(bare));
  });

  it('starts an edge on the slab silhouette, not the wall behind it', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes: [
        {
          id: 'a',
          shape: 'box',
          x: 0,
          y: 0,
          w: 60,
          h: 40,
          extrude: true,
          depth: 10,
        },
        { id: 'b', shape: 'box', x: 200, y: 0, w: 60, h: 40 },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
    });
    const points = pointsOf(nth(pathsOf(svg), 0));
    // a's r anchor plus the full vector (10, -7.5): the same point `anchor`
    // reports, 12.5 px from the flat midpoint - an order of magnitude past
    // the jitter bound, so aiming at the wall behind the slab fails here.
    expectNear(nth(points, 0), [70, 12.5]);
    // The flat target does not move: the shaft still lands on b's l anchor.
    expectNear(nth(points, points.length - 1), [200, 20]);
  });

  it('lands an edge into an extruded t on the moved anchor', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes: [
        { id: 'a', shape: 'box', x: 0, y: 100, w: 60, h: 40 },
        {
          id: 'b',
          shape: 'box',
          x: 200,
          y: 100,
          w: 60,
          h: 40,
          extrude: true,
          depth: 10,
        },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 't'] }],
    });
    const points = pointsOf(nth(pathsOf(svg), 0));
    // b's t anchor plus the vector: (200 + 30 + 10, 100 - 7.5).
    expectNear(nth(points, points.length - 1), [240, 92.5]);
  });

  it('pins a flat-by-override endpoint while the other end rides the switch', () => {
    const svg = makeSvg();
    draw(
      svg,
      {
        nodes: [
          { id: 'a', shape: 'box', x: 0, y: 0, w: 60, h: 40 },
          {
            id: 'b',
            shape: 'box',
            x: 200,
            y: 0,
            w: 60,
            h: 40,
            extrude: false,
          },
        ],
        edges: [{ from: ['a', 'r'], to: ['b', 't'] }],
      },
      { extrude: true, depth: 20 },
    );
    const points = pointsOf(nth(pathsOf(svg), 0));
    // a extrudes under the diagram switch at the options depth: its r anchor
    // moves by (20, -15).
    expectNear(nth(points, 0), [80, 5]);
    // b opted out, so its t anchor - the side that would move - stays flat.
    // Were the override lost, the shaft would end at (250, -15).
    expectNear(nth(points, points.length - 1), [230, 0]);
  });

  it('hangs a self-transition off the moved side of an extruded node', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes: [
        {
          id: 'a',
          shape: 'box',
          x: 0,
          y: 0,
          w: 100,
          h: 50,
          extrude: true,
          depth: 10,
        },
      ],
      edges: [{ from: ['a', 'r'], to: ['a', 'r'] }],
    });
    const points = pointsOf(nth(pathsOf(svg), 0));
    // The loop derives from the same `anchor` an edge does, so its whole
    // geometry rides the moved midpoint (110, 17.5) - a loop on a slab's r
    // side sits on the silhouette, half a span either way from it.
    expectNear(nth(points, 0), [110, 17.5 - LOOP_SPAN / 2]);
    expectNear(nth(points, points.length - 1), [110, 17.5 + LOOP_SPAN / 2]);
  });

  it('leaves a note arrow on its literal points beside an extruded node', () => {
    const svg = makeSvg();
    draw(svg, {
      nodes: [
        {
          id: 'a',
          shape: 'box',
          x: 0,
          y: 0,
          w: 60,
          h: 40,
          extrude: true,
          depth: 10,
        },
      ],
      notes: [
        {
          x: 150,
          y: 100,
          lines: ['careful'],
          arrowFrom: [150, 90],
          arrowTo: [60, 20],
        },
      ],
    });
    // A note pointer is given points rather than sides, so extrusion moves
    // nothing about it: aimed at the flat r midpoint, it still lands there,
    // on the wall - where the slab's edges now attach 12.5 px away. Pointing
    // at the silhouette is the author's line to move.
    const arrow = pointsOf(
      nth(
        pathsOf(svg).filter(
          (path) => attr(path, 'stroke') === defaultTheme.accent,
        ),
        0,
      ),
    );
    expectNear(nth(arrow, 0), [150, 90]);
    expectNear(nth(arrow, arrow.length - 1), [60, 20]);
  });

  // The hand order an extruded node is drawn in, end to end: front outline,
  // faces, face shading, then the front face's own `hatch: true` shading and
  // the label. It is the sequence a reveal animates in, and no golden can
  // hold it - the goldens are flat - so a hatched slab is the only thing that
  // pins it, and nothing else in the repository draws one.
  it('lays down front outline, faces, face shading, hatching, then label', () => {
    const x = 20;
    const y = 20;
    const w = 170;
    const h = 70;
    const svg = makeSvg();
    draw(
      svg,
      {
        nodes: [
          {
            id: 'n',
            shape: 'box',
            x,
            y,
            w,
            h,
            hatch: true,
            lines: ['slab'],
            extrude: true,
            depth: 20,
          },
        ],
      },
      { seed: 7 },
    );

    // The front plane cannot reach past its own right edge, or above its own
    // top, by more than a corner overshoot and the pen's wander. Anything
    // that does is the offset chain or one of the two connectors to it, and
    // at a depth of 20 those clear the bound by 13.7 px.
    const reach = OVERSHOOT + AMP;
    const offset = (el: Element) =>
      pointsOf(el).some(([px, py]) => px > x + w + reach || py < y - reach);
    const kindOf = (el: Element) => {
      if (el.tagName === 'text') return 'label';
      const ink = attr(el, 'stroke');
      if (ink === defaultTheme.muted) return 'face shading';
      if (ink === defaultTheme.pen) return 'hatching';
      return offset(el) ? 'faces' : 'front outline';
    };
    // Run-length encoded, so what is asserted is the order of the five phases
    // and that each is contiguous - not how many strokes a gap constant
    // happens to put in one of them.
    const phases = childrenOf(svg)
      .map(kindOf)
      .filter((kind, i, all) => kind !== all[i - 1]);

    expect(phases).toEqual([
      'front outline',
      'faces',
      'face shading',
      'hatching',
      'label',
    ]);
  });
});

describe('draw() note phase', () => {
  const note = (extra: Partial<DiagramNote>): Diagram => ({
    notes: [{ x: 400, y: 100, lines: ['careful'], ...extra }],
  });

  it('writes a note in the accent colour, anchored start by default', () => {
    const svg = makeSvg();
    draw(svg, note({}));

    expect(tagsOf(svg)).toEqual(['text']);
    const text = nth(textsOf(svg), 0);
    expect(styleOf(text)).toBe(
      `fill:${defaultTheme.accent};font-size:${NOTE_SIZE}px`,
    );
    expect(attr(text, 'text-anchor')).toBe('start');
  });

  it('takes the anchor the note asks for', () => {
    const svg = makeSvg();
    draw(svg, note({ anchor: 'middle' }));
    expect(attr(nth(textsOf(svg), 0), 'text-anchor')).toBe('middle');
  });

  it('draws the arrow only once both of its ends are given', () => {
    const halfArrow = makeSvg();
    draw(halfArrow, note({ arrowFrom: [400, 110] }));
    expect(pathsOf(halfArrow)).toHaveLength(0);

    const arrowed = makeSvg();
    draw(arrowed, note({ arrowFrom: [400, 110], arrowTo: [300, 150] }));
    const paths = pathsOf(arrowed);
    expect(paths).toHaveLength(6);
    expect(attr(nth(paths, 0), 'stroke')).toBe(defaultTheme.accent);
    expect(attr(nth(paths, 0), 'stroke-dasharray')).toBe(DASH);
  });

  it('threads the note arrow through its via points', () => {
    const svg = makeSvg();
    draw(
      svg,
      note({ arrowFrom: [400, 110], via: [[350, 200]], arrowTo: [300, 150] }),
    );

    const points = pointsOf(nth(pathsOf(svg), 0));
    expect(points.some(([x, y]) => Math.hypot(x - 350, y - 200) < 2)).toBe(
      true,
    );
  });

  // A pointer runs from text to the thing the text is about, which is exactly
  // where a straight line is most likely to cross what it points at. The
  // offsets below are signed the same way `bow` is: positive is the right hand
  // of someone walking from `arrowFrom` to `arrowTo`.
  it('bows the pointer to the right of travel, and back for a negative', () => {
    const ends: [Point, Point] = [
      [400, 100],
      [300, 100],
    ];
    // Spread rather than `bow` directly: under exactOptionalPropertyTypes an
    // explicit `undefined` is not the same as an absent field, and absent is
    // the case the last assertion is about.
    const offsets = (bow?: number) => {
      const svg = makeSvg();
      draw(
        svg,
        note({
          arrowFrom: ends[0],
          arrowTo: ends[1],
          ...(bow === undefined ? {} : { bow }),
        }),
      );
      // Travel is -x, so the right hand of it points up the screen, and an
      // offset below the chord is a negative y difference.
      return pointsOf(nth(pathsOf(svg), 0)).map(([, y]) => 100 - y);
    };
    expect(Math.max(...offsets(30))).toBeGreaterThan(28);
    expect(Math.min(...offsets(-30))).toBeLessThan(-28);
    // Straight, and straight to within the pen's own wander of 1.3 px.
    expect(Math.max(...offsets().map(Math.abs))).toBeLessThan(2);
  });
});

describe('draw() with nothing to draw', () => {
  it('empties the svg and leaves it empty', () => {
    const svg = makeSvg();
    draw(svg, ALL_PHASES);
    expect(svg.children.length).toBeGreaterThan(0);

    draw(svg, {});

    expect(svg.children.length).toBe(0);
    expect(svg.hasAttribute('role')).toBe(false);
  });
});
