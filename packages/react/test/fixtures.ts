// The diagram the README and the React quickstart show, as data. It exercises
// all three shapes, a plain edge, a labelled edge and a dotted one, which is
// enough of the renderer for a binding test to notice a diagram that only
// half arrived.

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
      id: 'gate',
      shape: 'diamond',
      x: 260,
      y: 35,
      w: 150,
      h: 80,
      lines: ['allowed?'],
    },
    {
      id: 'work',
      shape: 'box',
      x: 480,
      y: 50,
      w: 180,
      h: 50,
      lines: ['do the work'],
      accent: true,
    },
  ],
  edges: [
    { from: ['in', 'r'], to: ['gate', 'l'] },
    { from: ['gate', 'r'], to: ['work', 'l'], label: 'yes', lx: 445, ly: 60 },
    {
      from: ['gate', 'b'],
      to: ['in', 'b'],
      via: [
        [335, 135],
        [120, 135],
      ],
      dotted: true,
      label: 'no',
      lx: 225,
      ly: 122,
    },
  ],
};

/** A second diagram, so a redraw has something else to become. */
export const NOTE: Diagram = {
  nodes: [{ id: 'a', shape: 'box', x: 20, y: 20, w: 120, h: 60 }],
  notes: [{ x: 160, y: 50, lines: ['a note'] }],
};

export const VIEW_BOX = '0 0 700 150';
