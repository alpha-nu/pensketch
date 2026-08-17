// One diagram carrying all three of the things the stylesheet tells apart: a
// solid stroke, a dotted one - which is a path the renderer leaves
// `pathLength` off and this package must fade rather than draw - and text.
// And a second one, so a claim about two diagrams on a page has two.

import type { Diagram } from '@pensketch/core';

export const FLOW: Diagram = {
  nodes: [
    {
      id: 'in',
      shape: 'pill',
      x: 40,
      y: 50,
      w: 160,
      h: 50,
      lines: ['request'],
    },
    {
      id: 'work',
      shape: 'box',
      x: 300,
      y: 50,
      w: 180,
      h: 50,
      lines: ['do the work'],
    },
  ],
  edges: [
    { from: ['in', 'r'], to: ['work', 'l'] },
    {
      from: ['work', 'b'],
      to: ['in', 'b'],
      via: [
        [390, 140],
        [120, 140],
      ],
      dotted: true,
    },
  ],
};

/** A second diagram, so two on a page can be compared. */
export const NOTE: Diagram = {
  nodes: [{ id: 'a', shape: 'box', x: 20, y: 20, w: 120, h: 60 }],
  notes: [{ x: 160, y: 50, lines: ['a note'] }],
};
