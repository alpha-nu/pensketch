import type { Diagram } from '@pensketch/core';

// A diagram is data, so it lives in a file of its own and diffs like code.
//
// The four groups are lanes: drawn first, behind everything, they turn a flat
// list of boxes into "who does what". Steps are numbered in their own labels
// rather than on the arrows - the gaps between lanes are 34px, which is not
// enough room to put text beside a connector without the line running through
// it.
//
// biome.json turns the formatter off for this file alone. Collapsed to one
// field per line it is 120 lines of vertical noise; as a table you can read
// the layout straight off the page, which is most of the point of a diagram
// being data.
export const OAUTH: Diagram = {
  nodes: [
    { id: 'lb', shape: 'group', x: 20,  y: 20, w: 195, h: 350, lines: ['browser'] },
    { id: 'la', shape: 'group', x: 235, y: 20, w: 185, h: 350, lines: ['your app'] },
    { id: 'ls', shape: 'group', x: 440, y: 20, w: 185, h: 350, lines: ['auth server'] },
    { id: 'lr', shape: 'group', x: 645, y: 20, w: 195, h: 350, lines: ['resource API'] },

    { id: 's1', shape: 'box', x: 40,  y: 60,  w: 155, h: 46, lines: ['1. click sign in'],    size: 12 },
    { id: 's2', shape: 'box', x: 250, y: 60,  w: 155, h: 46, lines: ['2. redirect + PKCE'],  size: 12 },
    { id: 's3', shape: 'box', x: 455, y: 140, w: 155, h: 46, lines: ['3. login + consent'],  size: 12 },
    { id: 's4', shape: 'box', x: 40,  y: 220, w: 155, h: 46, lines: ['4. code comes back'],  size: 12 },
    { id: 's5', shape: 'box', x: 250, y: 220, w: 155, h: 46, lines: ['5. code + verifier'],  size: 12, accent: true },
    { id: 's6', shape: 'box', x: 455, y: 300, w: 155, h: 46, lines: ['6. access token'],     size: 12 },
    { id: 's7', shape: 'box', x: 665, y: 300, w: 155, h: 46, lines: ['7. call with bearer'], size: 12 },
  ],
  edges: [
    { from: ['s1', 'r'], to: ['s2', 'l'] },
    // Down out of one lane, across the gap, down into the next. The corners
    // are given, not inferred: pensketch routes nothing on your behalf.
    { from: ['s2', 'b'], to: ['s3', 't'], via: [[327, 123], [532, 123]] },
    { from: ['s3', 'b'], to: ['s4', 't'], via: [[532, 203], [117, 203]] },
    { from: ['s4', 'r'], to: ['s5', 'l'] },
    { from: ['s5', 'b'], to: ['s6', 't'], via: [[327, 283], [532, 283]] },
    { from: ['s6', 'r'], to: ['s7', 'l'] },
  ],
  notes: [
    { x: 742, y: 150, anchor: 'middle',
      lines: ['the API only ever', 'sees a short-lived', 'bearer token'] },
  ],
};
