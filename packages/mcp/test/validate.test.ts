import { describe, expect, it } from 'vitest';
import { refuseDiagram } from '../src/validate';

// The formatter's own corners, driven directly. The protocol suite proves
// the refusals a caller meets over the wire; these are the branches a
// realistic tool call cannot reach - the boundary's zod layer refuses a
// non-object diagram and caps the arrays long before either gets here.

describe('refuseDiagram', () => {
  it('passes a valid diagram silently', () => {
    expect(
      refuseDiagram({
        nodes: [{ id: 'a', x: 0, y: 0, w: 100, h: 40, lines: ['a'] }],
      }),
    ).toBeNull();
  });

  // zod refuses a non-object first, so this line is defence in depth - but
  // a defence that crashed would be worse than none, which is what makes it
  // worth one test.
  it('names the whole diagram when the defect has no path', () => {
    expect(refuseDiagram(null)).toContain('the diagram must be object');
  });

  // A keyword the formatter has no sentence for falls back to Ajv's own
  // message behind the caller's path - here `minItems`, from an edge end
  // one element short.
  it('keeps the path on a defect it has no sentence for', () => {
    const text = refuseDiagram({
      nodes: [{ id: 'a', x: 0, y: 0, w: 100, h: 40 }],
      edges: [{ from: ['a'], to: ['a', 't'] }],
    });
    expect(text).toContain('edges[0].from must NOT have fewer than 2 items');
  });

  // A shape no branch owns fails every branch at its own constant, and the
  // honest line is all of them at once rather than whichever branch spoke
  // first.
  it('collapses the shape constants into one allowed list', () => {
    const text = refuseDiagram({
      nodes: [{ id: 'a', shape: 'circle', x: 0, y: 0, w: 100, h: 40 }],
    });
    expect(text).toContain('nodes[0].shape must be one of');
    for (const shape of ['"group"', '"box"', '"pill"', '"diamond"'])
      expect(text).toContain(shape);
  });

  // `label` is a real field on an edge, so the nudge must not fire there -
  // and must fire on a note, where it is the same guess `text` is.
  it('nudges label toward lines on a note and not on an edge', () => {
    const onNote = refuseDiagram({
      notes: [{ x: 1, y: 1, label: 'guessed' }],
    });
    expect(onNote).toContain('notes[0] has no field "label"');
    expect(onNote).toContain('words go in "lines"');

    const onEdge = refuseDiagram({
      nodes: [{ id: 'a', x: 0, y: 0, w: 10, h: 10 }],
      edges: [{ from: ['a', 't'], to: ['a', 't'], text: 'guessed' }],
    });
    expect(onEdge).toContain('edges[0] has no field "text"');
    expect(onEdge).not.toContain('words go in "lines"');
  });

  it('counts what it does not list past the cap', () => {
    const text = refuseDiagram({
      nodes: Array.from({ length: 30 }, (_, i) => ({
        id: `n${i}`,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        text: 'wrong field',
      })),
    });
    expect(text).toContain('more, not listed');
    expect(text?.match(/has no field/g)?.length).toBeLessThanOrEqual(20);
  });
});
