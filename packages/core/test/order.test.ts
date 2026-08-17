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
 * at 2000 elements `(1999 / 2000).toFixed(3)` is `1.000`. A plain box is eight
 * paths - four sides at two passes - so 250 of them stand exactly on it. Not a
 * size only a generator reaches: a 200x120 hatched node is 64 elements
 * measured, so 32 of them do the same.
 */
const AT_THE_BOUND: Diagram = {
  nodes: Array.from(
    { length: 250 },
    (_, i): DiagramNode => ({
      id: `n${i}`,
      shape: 'box',
      x: 20,
      y: 20 + i * 60,
      w: 80,
      h: 40,
    }),
  ),
};

describe('the order a hand would draw in', () => {
  it('numbers every node shape below every connector, and all text above both', () => {
    const svg = stamped(SHAPES_AND_CONNECTORS);
    const shapes = inked(svg, PEN);
    const connectors = inked(svg, INK);
    const texts = textsOf(svg).map(fractionOf);

    // Counts first: without them the comparisons below would hold of two
    // empty sets, which is the shape a broken classifier takes.
    // Three boxes, four sides each, two passes a side.
    expect(shapes).toHaveLength(24);
    // Three connectors, a shaft and two barbs each, two passes each.
    expect(connectors).toHaveLength(18);
    // Three node labels and one edge label.
    expect(texts).toHaveLength(4);

    expect(Math.max(...shapes)).toBeLessThan(Math.min(...connectors));
    expect(Math.min(...texts)).toBeGreaterThan(Math.max(...connectors));
  });

  it('numbers the group frame below everything it contains', () => {
    const svg = stamped(WITH_GROUP);
    const frame = inked(svg, PEN);
    const inside = inked(svg, INK);
    const texts = textsOf(svg).map(fractionOf);

    // Four sides, two passes a side.
    expect(frame).toHaveLength(8);
    // Two boxes and one connector.
    expect(inside).toHaveLength(22);
    // The group's title and the two node labels.
    expect(texts).toHaveLength(3);

    // The wash is the first thing a hand puts down and the first child in the
    // document, so the two agree at zero.
    expect(fractionOf(nth(childrenOf(svg), 0))).toBe(0);
    expect(Math.max(...frame)).toBeLessThan(Math.min(...inside));
    expect(Math.min(...texts)).toBeGreaterThan(Math.max(...inside));
  });

  it('leaves every piece of text until last, whatever phase drew it', () => {
    const svg = stamped(EVERY_PHASE);
    const texts = textsOf(svg).map(fractionOf);
    const rest = childrenOf(svg)
      .filter((el) => el.tagName !== 'text')
      .map(fractionOf);

    // The group title, the edge label, two node labels, the brace label, the
    // note and the raw callback's label: one from each phase there is.
    expect(texts).toHaveLength(7);
    expect(rest.length).toBeGreaterThan(0);
    expect(Math.min(...texts)).toBeGreaterThan(Math.max(...rest));
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
  it('stays under one at 2000 elements, where rounding would not have', () => {
    const svg = stamped(AT_THE_BOUND);
    const fractions = childrenOf(svg).map(fractionOf);

    expect(fractions).toHaveLength(2000);
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
