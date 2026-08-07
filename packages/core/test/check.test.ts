import { describe, expect, it } from 'vitest';
import { check } from '../src/check';
import type { Diagram } from '../src/index';

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
