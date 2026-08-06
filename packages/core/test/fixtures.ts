import type { Diagram } from '../src/index';

// The two diagrams the reference implementation renders, transcribed from it
// so the port can be held to the reference's bytes. Non-ASCII glyphs stay
// \uXXXX escapes, exactly as the reference writes them.
//
// The reference's raw callbacks name the stroke options `w` and `amp`; the
// public option names are `width` and `amplitude`. Only the names differ -
// every number here is the reference's.

/** Exercises every renderer feature. Rendered at seed 7. */
export const SAMPLER: Diagram = {
  nodes: [
    {
      id: 'grp',
      shape: 'group',
      x: 20,
      y: 30,
      w: 560,
      h: 370,
      lines: ['a group \u2014 wash + sketched border + title'],
    },
    {
      id: 'a',
      shape: 'box',
      x: 60,
      y: 90,
      w: 180,
      h: 60,
      lines: ['plain box', '(two lines)'],
    },
    {
      id: 'b',
      shape: 'box',
      x: 320,
      y: 90,
      w: 180,
      h: 60,
      lines: ['accent box'],
      accent: true,
    },
    {
      id: 'd',
      shape: 'diamond',
      x: 90,
      y: 200,
      w: 150,
      h: 90,
      lines: ['diamond?'],
      size: 13,
    },
    {
      id: 'p',
      shape: 'pill',
      x: 320,
      y: 220,
      w: 180,
      h: 56,
      lines: ['a pill'],
    },
    {
      id: 'h',
      shape: 'box',
      x: 60,
      y: 330,
      w: 120,
      h: 50,
      lines: [],
      hatch: true,
    },
  ],
  edges: [
    { from: ['a', 'r'], to: ['b', 'l'] },
    { from: ['a', 'b'], to: ['d', 't'] },
    { from: ['b', 'b'], to: ['p', 't'] },
    {
      from: ['d', 'r'],
      to: ['p', 'l'],
      via: [[280, 248]],
      label: 'yes',
      lx: 285,
      ly: 232,
    },
    {
      from: ['d', 'b'],
      to: ['h', 't'],
      via: [[165, 312]],
      dotted: true,
      label: 'no',
      lx: 188,
      ly: 312,
      anchor: 'start',
    },
  ],
  notes: [
    {
      x: 640,
      y: 110,
      lines: ['a red note \u2014 with', 'a dotted arrow'],
      anchor: 'start',
      arrowFrom: [660, 132],
      via: [[590, 150]],
      arrowTo: [506, 120],
    },
  ],
  raw: [
    (S) =>
      S.label(
        640,
        210,
        ['raw callbacks: draw anything', 'with the primitive set'],
        { size: 13, anchor: 'start', color: 'var(--muted)' },
      ),
    (S) =>
      S.stroke(
        [
          [640, 240],
          [860, 242],
        ],
        { color: 'var(--pen)', width: 1.2, amplitude: 1.8 },
      ),
    (S) =>
      S.arrow(
        [
          [640, 290],
          [860, 290],
        ],
        { dotted: true, color: 'var(--red)' },
      ),
    (S) =>
      S.label(640, 330, ['hatch fill \u2193 in the group'], {
        size: 12.5,
        anchor: 'start',
        color: 'var(--muted)',
      }),
  ],
};

/** Real-world sample: The Responsible Harness, D2. Rendered at seed 11. */
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
        color: 'var(--pen)',
        anchor: 'start',
      });
      S.stroke(
        [
          [658, 132],
          [790, 134],
        ],
        { color: 'var(--pen)', width: 1.2, amplitude: 1.6 },
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
        {
          size: 13,
          anchor: 'start',
        },
      );
    },
  ],
};
