import { describe, expect, it } from 'vitest';
import type { Diagram, DiagramNode, Pen } from '../src/index';
import { constants, draw, pen } from '../src/index';
import { childrenOf, makeSvg, nth, pathsOf, tagsOf, textsOf } from './helpers';
import { serialize } from './serialize.mjs';

const { DASH, TITLE_SIZE } = constants;

const attr = (el: Element, name: string) => el.getAttribute(name);

// Sentinel colours rather than the default palette, so a path's `stroke` says
// which phase drew it. `accent: true` puts a node's outline in `theme.pen` and
// leaves every connector in `theme.ink`; a group's border, a brace and a
// node's hatching are the only other paths in `theme.pen`, so a diagram below
// carries accent nodes or a group, never both, and none of them is hatched.
// (A group's title and a brace's label are `theme.pen` too, and harmless: they
// are `<text>`, which `inked` never looks at.)
const INK = 'INK';
const PEN = 'PEN';
const THEME = { ink: INK, pen: PEN };

/** A fresh `<svg>` drawn at a fixed seed with the option on. */
const stamped = (diagram: Diagram): SVGSVGElement => {
  const svg = makeSvg();
  draw(svg, diagram, { seed: 7, theme: THEME, order: true });
  return svg;
};

/**
 * The fraction an element carries. `--ps-i` is written ahead of whatever style
 * the element already had, so it is always the first declaration and reading
 * it off the front is also what proves it went there.
 */
const fractionOf = (el: Element): number => {
  const found = /^--ps-i:([0-9.]+);/.exec(attr(el, 'style') ?? '');
  if (!found)
    throw new Error(
      `expected <${el.tagName}> to carry --ps-i, its style is ${attr(el, 'style')}`,
    );
  return Number(found[1]);
};

/** The fractions of every path drawn in `color`. */
const inked = (svg: SVGSVGElement, color: string): number[] =>
  pathsOf(svg)
    .filter((p) => attr(p, 'stroke') === color)
    .map(fractionOf);

/**
 * The fractions of the annotations: a brace's stroke and a note's pointer.
 * Found by position rather than by colour, because colour cannot do both. A
 * note's pointer is `theme.accent` and could be picked out that way, but a
 * brace is `theme.pen` and so is the group border drawn long before it, so one
 * of the two would need finding some other way regardless. Both phases run
 * after every node shape and every connector, so the annotations are the paths
 * following the last `theme.ink` one - and that the document order is the one
 * it always was is what `moves nothing in the document` asserts.
 */
const annotationsOf = (svg: SVGSVGElement): number[] => {
  const paths = pathsOf(svg);
  const strokes = paths.map((p) => attr(p, 'stroke'));
  return paths.slice(strokes.lastIndexOf(INK) + 1).map(fractionOf);
};

// Accent nodes, so `theme.pen` names the shapes and `theme.ink` names the
// connectors, and no group: a group border would be `theme.pen` too.
const SHAPES_AND_CONNECTORS: Diagram = {
  nodes: [
    {
      id: 'a',
      shape: 'box',
      x: 20,
      y: 20,
      w: 80,
      h: 40,
      lines: ['a'],
      accent: true,
    },
    {
      id: 'b',
      shape: 'box',
      x: 220,
      y: 20,
      w: 80,
      h: 40,
      lines: ['b'],
      accent: true,
    },
    {
      id: 'c',
      shape: 'box',
      x: 220,
      y: 160,
      w: 80,
      h: 40,
      lines: ['c'],
      accent: true,
    },
  ],
  edges: [
    { from: ['a', 'r'], to: ['b', 'l'], label: 'one', lx: 160, ly: 30 },
    { from: ['b', 'b'], to: ['c', 't'] },
    { from: ['a', 'b'], to: ['c', 'l'] },
  ],
};

// A group, plain nodes and one connector, so `theme.pen` names the group's
// border alone and `theme.ink` names everything drawn inside it.
const WITH_GROUP: Diagram = {
  nodes: [
    { id: 'g', shape: 'group', x: 0, y: 0, w: 340, h: 120, lines: ['group'] },
    { id: 'a', shape: 'box', x: 20, y: 50, w: 80, h: 40, lines: ['a'] },
    { id: 'b', shape: 'box', x: 220, y: 50, w: 80, h: 40, lines: ['b'] },
  ],
  edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
};

// One diagram that reaches every phase, so the braces, the notes and the raw
// callbacks are ranked rather than assumed.
const EVERY_PHASE: Diagram = {
  nodes: [
    { id: 'g', shape: 'group', x: 0, y: 0, w: 340, h: 220, lines: ['group'] },
    { id: 'a', shape: 'box', x: 20, y: 50, w: 80, h: 40, lines: ['a'] },
    { id: 'b', shape: 'box', x: 220, y: 50, w: 80, h: 40, lines: ['b'] },
  ],
  edges: [{ from: ['a', 'r'], to: ['b', 'l'], label: 'one', lx: 160, ly: 60 }],
  braces: [
    { from: [20, 110], to: [300, 110], lines: ['brace'], lx: 20, ly: 130 },
  ],
  notes: [
    {
      x: 20,
      y: 180,
      lines: ['note'],
      arrowFrom: [60, 180],
      arrowTo: [160, 140],
    },
  ],
  raw: [(p: Pen) => p.label(240, 180, 'raw')],
};

// Two connectors, one dotted, so one diagram carries dashed paths and undashed
// ones and the guard is measured against both at once.
const DOTTED: Diagram = {
  nodes: [
    { id: 'a', shape: 'box', x: 20, y: 20, w: 80, h: 40 },
    { id: 'b', shape: 'box', x: 220, y: 20, w: 80, h: 40 },
  ],
  edges: [
    { from: ['a', 'r'], to: ['b', 'l'] },
    { from: ['a', 'b'], to: ['b', 'b'], dotted: true },
  ],
};

/**
 * The count where three decimals stop being able to say `[0, 1)` by rounding:
 * at 2000 gestures `(1999 / 2000).toFixed(3)` is `1.000`. The unit is the
 * gesture, not the element, since both passes of a stroke share one number -
 * a plain box is eight paths pairing into four gestures, so 500 of them
 * stand exactly on the bound.
 */
// Tiny boxes, deliberately: the bound is counted in gestures and a box is
// four of them at any size, while the cost of drawing scales with perimeter
// - at 80x40 the five hundred of them timed out under a loaded suite.
const AT_THE_BOUND: Diagram = {
  nodes: Array.from(
    { length: 500 },
    (_, i): DiagramNode => ({
      id: `n${i}`,
      shape: 'box',
      x: 20,
      y: 20 + i * 16,
      w: 20,
      h: 10,
    }),
  ),
};

describe('the order a hand would draw in', () => {
  it('numbers every node shape below every connector, and each label beside what it names', () => {
    const svg = stamped(SHAPES_AND_CONNECTORS);
    const shapes = inked(svg, PEN);
    const connectors = inked(svg, INK);
    const texts = textsOf(svg);
    const nodeLabels = texts
      .filter((t) => t.textContent !== 'one')
      .map(fractionOf);
    const edgeLabel = texts
      .filter((t) => t.textContent === 'one')
      .map(fractionOf);

    // Counts first: without them the comparisons below would hold of two
    // empty sets, which is the shape a broken classifier takes.
    // Three boxes, four sides each, two passes a side.
    expect(shapes).toHaveLength(24);
    // Three connectors, a shaft and two barbs each, two passes each.
    expect(connectors).toHaveLength(18);
    expect(nodeLabels).toHaveLength(3);
    expect(edgeLabel).toHaveLength(1);

    expect(Math.max(...shapes)).toBeLessThan(Math.min(...connectors));
    // A label rides its own phase - a node's words land with the node,
    // before any connector, and an edge's label lands with the edges. An
    // earlier revision queued every label at the end, where at 122 strokes
    // all the lettering fit in the final tenth of the runtime.
    expect(Math.max(...nodeLabels)).toBeLessThan(Math.min(...connectors));
    expect(Math.min(...edgeLabel)).toBeGreaterThan(Math.max(...shapes));
  });

  it('numbers the group frame below everything it contains', () => {
    const svg = stamped(WITH_GROUP);
    const frame = inked(svg, PEN);
    const inside = inked(svg, INK);
    const texts = textsOf(svg);
    const title = texts
      .filter((t) => t.textContent === 'group')
      .map(fractionOf);
    const labels = texts
      .filter((t) => t.textContent !== 'group')
      .map(fractionOf);

    // Four sides, two passes a side.
    expect(frame).toHaveLength(8);
    // Two boxes and one connector.
    expect(inside).toHaveLength(22);
    expect(title).toHaveLength(1);
    expect(labels).toHaveLength(2);

    // The wash is the first thing a hand puts down and the first child in the
    // document, so the two agree at zero.
    expect(fractionOf(nth(childrenOf(svg), 0))).toBe(0);
    expect(Math.max(...frame)).toBeLessThan(Math.min(...inside));
    // The title is the group phase's own last word, written before anything
    // is drawn inside the region it names; the node labels land among the
    // shapes they name rather than after everything.
    expect(Math.max(...title)).toBeLessThan(Math.min(...inside));
    for (const label of labels) {
      expect(label).toBeGreaterThan(Math.min(...inside));
      expect(label).toBeLessThan(Math.max(...inside));
    }
  });

  it('writes each label right after the thing it names', () => {
    const svg = stamped(EVERY_PHASE);
    const spoken = textsOf(svg)
      .map((t) => ({ text: t.textContent, at: fractionOf(t) }))
      .sort((a, b) => a.at - b.at)
      .map(({ text }) => text);

    // One piece of text from every phase there is, each in its phase's own
    // place: the group titled before its contents, each node labelled as it
    // is drawn, the edge labelled with the connectors, and the annotations'
    // words where the annotations are.
    expect(spoken).toEqual(['group', 'a', 'b', 'one', 'brace', 'note', 'raw']);

    // And the reversal that specifies the change: the lettering interleaves
    // with the drawing rather than queueing after all of it.
    const texts = textsOf(svg).map(fractionOf);
    const rest = childrenOf(svg)
      .filter((el) => el.tagName !== 'text')
      .map(fractionOf);
    expect(Math.min(...texts)).toBeLessThan(Math.max(...rest));
  });

  it('gives both passes of one gesture the same number', () => {
    const svg = stamped(SHAPES_AND_CONNECTORS);
    const paths = pathsOf(svg);
    // The pen traces every stroke twice, back to back, so the paths pair up
    // in document order - and a pair is one movement of one hand, so it
    // draws as one. Numbered apart, every line was visibly drawn and then
    // drawn again, and half the runtime went to the redraw.
    expect(paths.length % 2).toBe(0);
    for (let i = 0; i < paths.length; i += 2)
      expect(fractionOf(nth(paths, i))).toBe(fractionOf(nth(paths, i + 1)));
    // The distinct numbers count gestures, not elements.
    const distinct = new Set(childrenOf(svg).map(fractionOf));
    expect(distinct.size).toBeGreaterThan(0);
    expect(distinct.size).toBeLessThan(childrenOf(svg).length);
  });

  it('measures every solid gesture against the longest', () => {
    const svg = stamped(SHAPES_AND_CONNECTORS);
    const lens = pathsOf(svg).map(
      (p) => /--ps-len:([0-9.]+);/.exec(attr(p, 'style') ?? '')?.[1],
    );
    // Every path here is solid, so every path carries a ratio; both passes
    // of a pair carry the same one, measured off the first pass, because a
    // pair that disagreed about its duration would visibly split.
    expect(lens.every((l) => l !== undefined)).toBe(true);
    for (let i = 0; i < lens.length; i += 2) expect(lens[i]).toBe(lens[i + 1]);
    // The longest gesture says exactly 1.00 - it is the unit the others are
    // measured in - and nothing exceeds it.
    const numbers = lens.map(Number);
    expect(Math.max(...numbers)).toBe(1);
    expect(Math.min(...numbers)).toBeGreaterThan(0);
    // Text carries no length: it is written, not drawn on.
    for (const t of textsOf(svg))
      expect(attr(t, 'style')).not.toContain('--ps-len');
  });

  it('leaves --ps-len off a dashed path, which fades rather than draws', () => {
    const svg = stamped(DOTTED);
    const dashed = pathsOf(svg).filter((p) => attr(p, 'stroke-dasharray'));
    expect(dashed.length).toBeGreaterThan(0);
    for (const p of dashed) expect(attr(p, 'style')).not.toContain('--ps-len');
  });

  it('numbers a brace and a note above everything they annotate', () => {
    const svg = stamped(EVERY_PHASE);
    const annotations = annotationsOf(svg);
    const drawn = inked(svg, INK);

    // The brace's stroke, two passes, and the note's pointer, a shaft and two
    // barbs at two passes each.
    expect(annotations).toHaveLength(8);
    // Two boxes at eight paths each, and one connector at six.
    expect(drawn).toHaveLength(22);

    // An annotation is drawn over the thing it annotates, which is the whole
    // reason this phase sits after the shapes and the connectors rather than
    // between them. Nothing above pins it from below: text is ranked last
    // whatever phase drew it, so the brace's label and the note say nothing
    // about where the brace's stroke and the note's pointer go.
    expect(Math.min(...annotations)).toBeGreaterThan(Math.max(...drawn));
  });

  it('moves nothing in the document', () => {
    const plain = makeSvg();
    draw(plain, EVERY_PHASE, { seed: 7, theme: THEME });
    const svg = stamped(EVERY_PHASE);

    expect(tagsOf(svg)).toEqual(tagsOf(plain));
    // The `d` of every path in document order: the seeded sequence is
    // consumed in the order it always was, and nothing was reordered after.
    expect(pathsOf(svg).map((p) => attr(p, 'd'))).toEqual(
      pathsOf(plain).map((p) => attr(p, 'd')),
    );
    expect(textsOf(svg).map((t) => t.textContent)).toEqual(
      textsOf(plain).map((t) => t.textContent),
    );
  });

  it('counts fractions, from zero and under one', () => {
    const svg = stamped(EVERY_PHASE);
    const fractions = childrenOf(svg).map(fractionOf);

    expect(Math.min(...fractions)).toBe(0);
    expect(Math.max(...fractions)).toBeLessThan(1);
    // Three decimals, so a fraction is `0.` and three digits and nothing else.
    for (const el of childrenOf(svg))
      expect(attr(el, 'style')).toMatch(/^--ps-i:0\.[0-9]{3};/);
  });

  // The other end of the same bound, and the one the 46 elements of
  // `EVERY_PHASE` cannot reach: the fraction is truncated to three decimals
  // rather than rounded, and only a drawing this size tells the two apart.
  it('stays under one at 2000 gestures, where rounding would not have', {
    timeout: 15000,
  }, () => {
    const svg = stamped(AT_THE_BOUND);
    const fractions = childrenOf(svg).map(fractionOf);

    // 500 boxes, eight paths each, pairing into 2000 gestures. Three
    // decimals resolve at most a thousand distinct steps, so past a thousand
    // gestures neighbours start sharing a value - the bound this test pins
    // is the top staying under one, not every gesture keeping its own step.
    expect(fractions).toHaveLength(4000);
    expect(Math.min(...fractions)).toBe(0);
    // 1999 of 2000 truncates to .999 and rounds to 1.000, so the value is the
    // whole assertion; `toBeLessThan(1)` would pass on either.
    expect(Math.max(...fractions)).toBe(0.999);
    for (const el of childrenOf(svg))
      expect(attr(el, 'style')).toMatch(/^--ps-i:0\.[0-9]{3};/);
  });
});

describe('a dashed stroke is left alone', () => {
  it('normalises every undashed path and no dashed one', () => {
    const svg = stamped(DOTTED);
    const dashed = pathsOf(svg).filter(
      (p) => attr(p, 'stroke-dasharray') !== null,
    );
    const plain = pathsOf(svg).filter(
      (p) => attr(p, 'stroke-dasharray') === null,
    );

    // The dotted connector's shaft is drawn twice and dashed both times; its
    // barbs are never dashed, so one connector supplies both halves of this.
    expect(dashed.map((p) => attr(p, 'stroke-dasharray'))).toEqual([
      DASH,
      DASH,
    ]);
    expect(plain.length).toBeGreaterThan(0);

    expect(dashed.map((p) => attr(p, 'pathLength'))).toEqual([null, null]);
    expect(plain.map((p) => attr(p, 'pathLength'))).toEqual(
      plain.map(() => '1'),
    );
  });

  it('normalises nothing that is not a path', () => {
    const svg = stamped(EVERY_PHASE);
    const others = childrenOf(svg).filter((el) => el.tagName !== 'path');

    // The group's wash and every `<text>`.
    expect(others.length).toBeGreaterThan(0);
    expect(others.map((el) => attr(el, 'pathLength'))).toEqual(
      others.map(() => null),
    );
  });
});

describe('off by default', () => {
  it('adds neither --ps-i nor pathLength when order is unset', () => {
    const svg = makeSvg();
    draw(svg, EVERY_PHASE, { seed: 7, theme: THEME });
    const drawn = childrenOf(svg);

    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.map((el) => attr(el, 'pathLength'))).toEqual(
      drawn.map(() => null),
    );
    expect(
      drawn.filter((el) => (attr(el, 'style') ?? '').includes('--ps-i')),
    ).toEqual([]);
  });

  it('renders the same bytes for `order: false` as for no option at all', () => {
    const absent = makeSvg();
    draw(absent, EVERY_PHASE, { seed: 7, theme: THEME });
    const off = makeSvg();
    draw(off, EVERY_PHASE, { seed: 7, theme: THEME, order: false });

    expect(serialize(off)).toBe(serialize(absent));
  });
});

describe('an existing style is not clobbered', () => {
  it('writes --ps-i ahead of the fill and font-size a `<text>` carries', () => {
    const svg = stamped(EVERY_PHASE);
    // The group's title, which is drawn in `theme.pen` at `TITLE_SIZE`.
    const title = nth(textsOf(svg), 0);

    expect(attr(title, 'style')).toMatch(
      new RegExp(`^--ps-i:0\\.[0-9]{3};fill:${PEN};font-size:${TITLE_SIZE}px$`),
    );
  });
});

describe('a bare pen is untouched', () => {
  it('stamps nothing a caller draws by hand', () => {
    // Drawn first and with the option on, because the index is a property of
    // `draw`'s phases: a pen built afterwards has to be unaffected by it.
    stamped(EVERY_PHASE);

    const svg = makeSvg();
    const p = pen(svg, { seed: 7, theme: THEME });
    p.rect(10, 10, 60, 30);
    p.arrow([
      [70, 25],
      [140, 25],
    ]);
    p.label(100, 60, 'by hand');
    const drawn = childrenOf(svg);

    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.map((el) => attr(el, 'pathLength'))).toEqual(
      drawn.map(() => null),
    );
    expect(
      drawn.filter((el) => (attr(el, 'style') ?? '').includes('--ps-i')),
    ).toEqual([]);
  });
});

describe('the order the story runs in', () => {
  /** A fresh `<svg>` drawn at a fixed seed with the flow stamping. */
  const flowStamped = (diagram: Diagram): SVGSVGElement => {
    const svg = makeSvg();
    draw(svg, diagram, { seed: 7, theme: THEME, order: 'flow' });
    return svg;
  };

  /**
   * Every piece of text in stamp order. Labels ride their units - a node's
   * words land with the node, an edge's with the edge - so the words read
   * back in stamp order ARE the walk, and every expectation below is a
   * story rather than an inequality soup.
   */
  const story = (svg: SVGSVGElement): (string | null)[] =>
    textsOf(svg)
      .map((t) => ({ text: t.textContent, at: fractionOf(t) }))
      .sort((a, b) => a.at - b.at)
      .map(({ text }) => text);

  // Declared against the flow on purpose: `nodes` runs c, b, a while the
  // story runs a, b, c, so phase order and flow order disagree everywhere
  // they can.
  const CHAIN: Diagram = {
    nodes: [
      { id: 'c', shape: 'box', x: 420, y: 20, w: 80, h: 40, lines: ['c'] },
      { id: 'b', shape: 'box', x: 220, y: 20, w: 80, h: 40, lines: ['b'] },
      { id: 'a', shape: 'box', x: 20, y: 20, w: 80, h: 40, lines: ['a'] },
    ],
    edges: [
      { from: ['a', 'r'], to: ['b', 'l'], label: 'ab', lx: 160, ly: 30 },
      { from: ['b', 'r'], to: ['c', 'l'], label: 'bc', lx: 360, ly: 30 },
    ],
  };

  it('walks the graph from its root, wherever the declarations put it', () => {
    expect(story(flowStamped(CHAIN))).toEqual(['a', 'ab', 'b', 'bc', 'c']);
  });

  it('stamps different numbers from the hand order on the same bytes', () => {
    const hand = stamped(CHAIN);
    const flow = flowStamped(CHAIN);
    // Same elements in the same document order, byte for byte...
    expect(pathsOf(flow).map((p) => attr(p, 'd'))).toEqual(
      pathsOf(hand).map((p) => attr(p, 'd')),
    );
    // ...and a different count over them: hand order letters this diagram
    // shapes-then-connectors, flow order interleaves them.
    expect(story(hand)).toEqual(['c', 'b', 'a', 'ab', 'bc']);
    expect(story(flow)).toEqual(['a', 'ab', 'b', 'bc', 'c']);
  });

  it('follows one branch to its end before the next, in edges order', () => {
    const svg = flowStamped({
      nodes: [
        { id: 'a', shape: 'box', x: 20, y: 90, w: 80, h: 40, lines: ['a'] },
        { id: 'b', shape: 'box', x: 220, y: 20, w: 80, h: 40, lines: ['b'] },
        { id: 'c', shape: 'box', x: 220, y: 160, w: 80, h: 40, lines: ['c'] },
        { id: 'd', shape: 'box', x: 420, y: 20, w: 80, h: 40, lines: ['d'] },
      ],
      edges: [
        { from: ['a', 'r'], to: ['b', 'l'], label: 'one', lx: 160, ly: 60 },
        { from: ['a', 'b'], to: ['c', 'l'], label: 'two', lx: 160, ly: 170 },
        { from: ['b', 'r'], to: ['d', 'l'], label: 'deep', lx: 360, ly: 30 },
      ],
    });
    // Depth-first: the first branch's whole subtree - b and everything b
    // opens - draws before the second branch's edge is picked up.
    expect(story(svg)).toEqual(['a', 'one', 'b', 'deep', 'd', 'two', 'c']);
  });

  it('starts a cycle at its first declared node, and a lone self-loop at its own', () => {
    const cycle = flowStamped({
      nodes: [
        { id: 'x', shape: 'box', x: 20, y: 20, w: 80, h: 40, lines: ['x'] },
        { id: 'y', shape: 'box', x: 220, y: 20, w: 80, h: 40, lines: ['y'] },
      ],
      edges: [
        { from: ['x', 'r'], to: ['y', 'l'], label: 'xy', lx: 160, ly: 10 },
        { from: ['y', 'b'], to: ['x', 'b'], label: 'yx', lx: 160, ly: 110 },
      ],
    });
    // No root - each enters the other - so the walk opens at the first
    // declaration, and the edge back into visited ground is stamped without
    // re-entering it.
    expect(story(cycle)).toEqual(['x', 'xy', 'y', 'yx']);

    // A self-transition counts as leaving, not entering: the node it
    // decorates is still a root, and the loop draws right after it.
    const loop = flowStamped({
      nodes: [
        { id: 's', shape: 'box', x: 20, y: 20, w: 100, h: 50, lines: ['s'] },
      ],
      edges: [
        { from: ['s', 'b'], to: ['s', 'b'], label: 'again', lx: 70, ly: 120 },
      ],
    });
    expect(story(loop)).toEqual(['s', 'again']);
  });

  it('lets scenery keep its declared place rather than jumping the queue', () => {
    const svg = flowStamped({
      nodes: [
        { id: 'a', shape: 'box', x: 20, y: 20, w: 80, h: 40, lines: ['a'] },
        { id: 'b', shape: 'box', x: 220, y: 20, w: 80, h: 40, lines: ['b'] },
        // An island: no edge in, none out. It is not a start of anything,
        // so it draws where it is declared - after the story it decorates.
        {
          id: 'legend',
          shape: 'box',
          x: 20,
          y: 160,
          w: 120,
          h: 40,
          lines: ['legend'],
        },
      ],
      edges: [
        { from: ['a', 'r'], to: ['b', 'l'], label: 'ab', lx: 160, ly: 30 },
      ],
    });
    expect(story(svg)).toEqual(['a', 'ab', 'b', 'legend']);
  });

  it('keeps the group frames first and the annotations last', () => {
    const svg = flowStamped(EVERY_PHASE);
    const spoken = story(svg);
    expect(spoken[0]).toBe('group');
    expect(spoken.slice(-3)).toEqual(['brace', 'note', 'raw']);
    // The frame's stroke still counts from zero, before anything inside it.
    expect(fractionOf(nth(childrenOf(svg), 0))).toBe(0);
    const annotations = annotationsOf(svg);
    const drawn = inked(svg, INK);
    expect(Math.min(...annotations)).toBeGreaterThan(Math.max(...drawn));
  });

  it('moves nothing in the document and shares each gesture pair', () => {
    const plain = makeSvg();
    draw(plain, EVERY_PHASE, { seed: 7, theme: THEME });
    const svg = flowStamped(EVERY_PHASE);
    expect(tagsOf(svg)).toEqual(tagsOf(plain));
    expect(pathsOf(svg).map((p) => attr(p, 'd'))).toEqual(
      pathsOf(plain).map((p) => attr(p, 'd')),
    );
    // Both passes of one stroke still share a number: units hold whole
    // gestures, so the pairing survives any ranking.
    const paths = pathsOf(svg);
    for (let i = 0; i < paths.length; i += 2)
      expect(fractionOf(nth(paths, i))).toBe(fractionOf(nth(paths, i + 1)));
    const fractions = childrenOf(svg).map(fractionOf);
    expect(Math.min(...fractions)).toBe(0);
    expect(Math.max(...fractions)).toBeLessThan(1);
  });
});
