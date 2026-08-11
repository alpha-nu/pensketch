import type { Diagram } from '@pensketch/core';

// A diagram is data, so it lives in a file of its own and diffs like code -
// and here it is data computed from application state, which is the whole
// reason this is the React example. Three things about the picture depend on
// how far the incident has got, and nothing else does:
//
//   the accented node    where it is right now
//   the dotted edges     what has not happened - the steps ahead, and the two
//                        paths nobody wants to take at all
//   the bracket's reach  how long customers have been able to see it
//
// biome.json turns the formatter off for this file alone. Collapsed to one
// field per line the table below is vertical noise; as a table you can read
// the layout straight off the page, which is most of the point of a diagram
// being data.

/**
 * The frame the drawing is placed in: `viewBox` on the element, and - split
 * into four numbers - what `check` needs to run `out-of-bounds`. One string,
 * so the page and the checker cannot disagree about the frame.
 */
export const VIEW_BOX = '0 0 990 270';

const X0 = 40;    // left edge of the first box, and where the brace starts
const ROW = 130;  // top of every box
const W = 150;    // 150 x 46 is the proportion this project's own diagrams
const H = 46;     // settle on for a labelled box

// The five stages in order. Of the four numbers a box needs, `x` is the only
// one that differs between them, so it is the only one written out.
const STAGE_TABLE = [
  { id: 'paged',    shape: 'pill', x: X0,  label: 'paged' },
  { id: 'triage',   shape: 'box',  x: 230, label: 'triage' },
  { id: 'mitigate', shape: 'box',  x: 420, label: 'mitigate' },
  { id: 'verify',   shape: 'box',  x: 610, label: 'verify' },
  { id: 'clear',    shape: 'pill', x: 800, label: 'all clear' },
] as const;

/** The stages in order, for whatever control drives the picture. */
export const STAGES = STAGE_TABLE.map(({ label }) => label);

// Customers stop seeing an incident when the fix is verified, not when
// someone declares it over, so the brace stops at `verify` however far the
// control is pushed.
const LAST_AFFECTED = 3;

// Two fields that are present or absent rather than true or false, so that a
// diagram served as JSON carries what it draws and not a column of `false`.
const accented = (on: boolean): { accent?: true } => (on ? { accent: true } : {});
const unreached = (on: boolean): { dotted?: true } => (on ? { dotted: true } : {});

/**
 * The picture at one stage, `0` for freshly paged.
 *
 * Solid is what has happened. Everything else is dotted: the steps ahead, and
 * the escalation and the failed fix, which are drawn at every stage - they are
 * always possible - and dotted at every stage, because in this run neither
 * happened.
 */
export function incident(stage: number): Diagram {
  // The right edge of the furthest stage the brace covers. A fold rather than
  // a lookup: the table above is the only place the layout is stated, and
  // reading it back out arithmetically would be a second place to keep in step.
  const spanEnd = STAGE_TABLE.reduce(
    (x, s, i) => (i <= stage && i <= LAST_AFFECTED ? s.x + W : x),
    X0 + W,
  );

  return {
    nodes: STAGE_TABLE.map(({ id, shape, x, label }, i) => ({
      id, shape, x, y: ROW, w: W, h: H, lines: [label], ...accented(i === stage),
    })),
    edges: [
      { from: ['paged',    'r'], to: ['triage',   'l'], ...unreached(stage < 1) },
      { from: ['triage',   'r'], to: ['mitigate', 'l'], ...unreached(stage < 2) },
      { from: ['mitigate', 'r'], to: ['verify',   'l'], ...unreached(stage < 3) },
      { from: ['verify',   'r'], to: ['clear',    'l'], ...unreached(stage < 4) },

      // A self-transition at the defaults: the same node and the same side
      // named twice. `span` 40 puts both anchors well inside the 150 px side
      // it hangs off, and `out` 30 projects into empty space below the row.
      { from: ['triage', 'b'], to: ['triage', 'b'],
        dotted: true, label: 'escalate', lx: 305, ly: 224 },

      // The way back when the fix did not hold. Bowed, because both anchors
      // sit at y 176 - which is the line the two boxes' own bottom edges are
      // drawn on, so straight this arrow vanishes into them. Nothing reports
      // that: no rule compares an edge with a node's outline, and with the bow
      // taken off `check` finds no fault at all. A render is what tells you.
      { from: ['verify', 'b'], to: ['mitigate', 'b'], bow: -18,
        dotted: true, label: 'still broken', lx: 590, ly: 210 },
    ],
    braces: [
      // A bracket rather than a brace, because this one's span goes from 150
      // px to 720 as the incident runs. A curly brace turns its corners at a
      // fixed radius and draws its tip at another, so both keep their size at
      // any width and only the two straight runs between them grow: it reads
      // as a brace at 150 px and as an underline with a bump at 720. A
      // bracket is three straight lines and looks the same at every width.
      //
      // Nothing measures what a bracket spans, so both ends and the label are
      // this file's own numbers - including the midpoint the label sits over,
      // which moves as the span grows.
      { from: [X0, 112], to: [spanEnd, 112], depth: -20, kind: 'square',
        lines: ['customers', 'affected'], lx: (X0 + spanEnd) / 2, ly: 62, anchor: 'middle' },
    ],
  };
}
