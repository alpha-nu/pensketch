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
import { makeSvg, nth, pathsOf, pointsOf, tagsOf, textsOf } from './helpers';
import { serialize } from './serialize.mjs';

const {
  DASH,
  EDGE_SIZE,
  GROUP_W,
  HATCH_INSET,
  HATCH_W,
  NOTE_SIZE,
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
});

describe('draw() render order', () => {
  it('renders group, then edge, then node, then note, then raw', () => {
    const svg = makeSvg();
    draw(svg, ALL_PHASES);

    // Each phase walks its own array in order, so the markers come out in the
    // order they were declared within each phase as well as across phases.
    expect(contents(svg)).toEqual([
      'group',
      'edge',
      'node 1',
      'node 2',
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

  it('hatches in pen, inset from the outline', () => {
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
