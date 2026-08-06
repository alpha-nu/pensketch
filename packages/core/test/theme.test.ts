import { describe, expect, it } from 'vitest';
import type { Diagram, Theme } from '../src/index';
import { defaultTheme, draw, pen } from '../src/index';
import { makeSvg, nth, pathsOf, textsOf } from './helpers';

// Every role reaches an attribute somewhere in here: wash and pen from the
// group, ink from a plain node, pen again from an accent node and a hatch,
// muted from a plain edge label, accent from a dotted edge and a note.
const EVERY_ROLE: Diagram = {
  nodes: [
    { id: 'g', shape: 'group', x: 0, y: 0, w: 400, h: 200, lines: ['group'] },
    { id: 'a', shape: 'box', x: 20, y: 60, w: 100, h: 40, lines: ['ink'] },
    { id: 'b', shape: 'box', x: 260, y: 60, w: 100, h: 40, accent: true },
    { id: 'c', shape: 'box', x: 140, y: 140, w: 100, h: 40, hatch: true },
  ],
  edges: [
    { from: ['a', 'r'], to: ['b', 'l'], label: 'muted', lx: 190, ly: 70 },
    {
      from: ['a', 'b'],
      to: ['c', 'l'],
      dotted: true,
      label: 'accent',
      lx: 90,
      ly: 130,
    },
  ],
  notes: [{ x: 420, y: 40, lines: ['note'] }],
};

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

/** Every colour that reached a stroke attribute. */
const strokes = (svg: SVGSVGElement) =>
  sorted(pathsOf(svg).map((path) => path.getAttribute('stroke') ?? ''));

/** Every colour that reached a label's inline style. */
const labelFills = (svg: SVGSVGElement) =>
  sorted(
    textsOf(svg).map(
      (text) =>
        /fill:([^;]+)/.exec(text.getAttribute('style') ?? '')?.[1] ?? '',
    ),
  );

/** Every colour that reached a wash rect. */
const rectFills = (svg: SVGSVGElement) =>
  sorted(
    Array.from(
      svg.querySelectorAll('rect'),
      (r) => r.getAttribute('fill') ?? '',
    ),
  );

const render = (theme?: Partial<Theme>) => {
  const svg = makeSvg();
  draw(svg, EVERY_ROLE, theme === undefined ? {} : { theme });
  return svg;
};

describe('the default theme', () => {
  it('is the documented palette', () => {
    expect(defaultTheme).toEqual({
      ink: 'var(--ps-ink, #232B36)',
      pen: 'var(--ps-pen, #2B5B8A)',
      accent: 'var(--ps-accent, #B3402E)',
      muted: 'var(--ps-muted, #5A6572)',
      wash: 'var(--ps-wash, rgba(43,91,138,.05))',
    });
  });

  // The recolour-under-dark-mode promise is this and only this: the values in
  // the attributes are CSS variable references with a baked fallback, so the
  // host page moves the colours by redefining --ps-*, with no JS and no
  // redraw. What is testable here is that nothing else ever reaches an
  // attribute.
  it('writes only --ps-* references, fallback included, into attributes', () => {
    for (const value of Object.values(defaultTheme))
      expect(value).toMatch(/^var\(--ps-[a-z]+, .+\)$/);

    const svg = render();
    const emitted = [...strokes(svg), ...labelFills(svg), ...rectFills(svg)];
    expect(sorted(emitted)).toEqual(sorted(Object.values(defaultTheme)));
  });

  it('leaves path fills off entirely', () => {
    const svg = render();
    for (const path of pathsOf(svg))
      expect(path.getAttribute('fill')).toBe('none');
  });
});

describe('a partial theme override', () => {
  const overridden = { ...defaultTheme, ink: 'hotpink' };

  it('replaces the given role and no other', () => {
    const svg = render({ ink: 'hotpink' });

    // Strokes: node outlines in ink, group border and accent node and hatch
    // in pen, dotted edge in accent.
    expect(strokes(svg)).toEqual(
      sorted([overridden.ink, overridden.pen, overridden.accent]),
    );
    // Labels: group title in pen, node label in ink, plain edge label in
    // muted, dotted edge label and note in accent.
    expect(labelFills(svg)).toEqual(
      sorted([
        overridden.ink,
        overridden.pen,
        overridden.muted,
        overridden.accent,
      ]),
    );
    expect(rectFills(svg)).toEqual([overridden.wash]);
  });

  it('reaches the pen as well as the diagram', () => {
    const svg = makeSvg();
    pen(svg, { theme: { ink: 'hotpink' } }).stroke([
      [0, 0],
      [10, 0],
    ]);
    expect(nth(pathsOf(svg), 0).getAttribute('stroke')).toBe('hotpink');
  });

  it('does not write itself into the default theme', () => {
    render({ ink: 'hotpink' });
    expect(defaultTheme.ink).toBe('var(--ps-ink, #232B36)');
  });
});
