import type { Diagram } from '@pensketch/core';

// A diagram is data, so it lives in a file of its own and diffs like code.
// Non-ASCII glyphs stay \uXXXX escapes, which keeps what is rendered
// independent of how this file is decoded.
export const BUDGETS: Diagram = {
  nodes: [
    {
      id: 'outer',
      shape: 'group',
      x: 30,
      y: 40,
      w: 600,
      h: 390,
      lines: [
        'T0 \u00B7 infrastructure ceiling \u2014 e.g. 85s (the edge kills the line here)',
      ],
    },
    {
      id: 'think',
      shape: 'group',
      x: 60,
      y: 95,
      w: 540,
      h: 190,
      lines: ['T1 \u00B7 reasoning budget \u2014 e.g. 70s'],
    },
    {
      id: 'deliv',
      shape: 'group',
      x: 60,
      y: 315,
      w: 540,
      h: 90,
      lines: ['T2 \u00B7 delivery tail \u2014 e.g. 12s, independent'],
    },
    {
      id: 'laps',
      shape: 'box',
      x: 90,
      y: 155,
      w: 300,
      h: 95,
      lines: [
        'reason \u21C4 act rounds',
        'each action carries its',
        'own smaller bound',
      ],
      size: 12.5,
    },
    {
      id: 'sliver',
      shape: 'box',
      x: 425,
      y: 155,
      w: 150,
      h: 95,
      lines: [],
      hatch: true,
    },
  ],
  edges: [],
  notes: [
    {
      x: 500,
      y: 135,
      lines: ['R \u00B7 absolute reserve \u2014 e.g. 9s'],
      anchor: 'middle',
    },
    {
      x: 500,
      y: 268,
      lines: [
        '= min synthesis + min handoff',
        '+ slack \u2014 never a fraction of T1',
      ],
      anchor: 'middle',
    },
  ],
  raw: [
    (S) =>
      S.label(
        330,
        372,
        [
          'deliver \u00B7 persist (per-statement bound) \u00B7 extras (own cap, skipped when degraded)',
        ],
        { size: 12.5 },
      ),
    (S) => {
      S.label(660, 120, ['INVARIANTS'], {
        size: 15,
        color: 'var(--ps-pen, #2B5B8A)',
        anchor: 'start',
      });
      S.stroke(
        [
          [658, 132],
          [790, 134],
        ],
        { color: 'var(--ps-pen, #2B5B8A)', width: 1.2, amplitude: 1.6 },
      );
      S.label(660, 168, ['T1 + T2 < T0', '(70 + 12 = 82 < 85)'], {
        size: 13,
        anchor: 'start',
      });
      S.label(660, 232, ['R is absolute \u2014 never', 'a fraction of T1'], {
        size: 13,
        anchor: 'start',
      });
      S.label(660, 296, ['every hop carries its', 'own smaller bound'], {
        size: 13,
        anchor: 'start',
      });
      S.label(
        660,
        360,
        ['budgets are spent once', '\u2014 no in-loop retries'],
        { size: 13, anchor: 'start' },
      );
    },
  ],
};
