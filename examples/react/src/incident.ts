import type { Diagram } from '@pensketch/core';

// A diagram is data, so it lives in a file of its own and diffs like code -
// and here it is data computed from application state, which is the whole
// reason this is the React example. Three things about the picture depend on
// how far the incident has got, and nothing else does:
//
//   the accented nodes   where it is right now - two of them at the end
//   the shaded nodes     the stages already behind it
//   the dotted edges     what has not happened - the steps ahead, and the two
//                        paths nobody wants to take at all
//
// biome.json turns the formatter off for this file alone. Collapsed to one
// field per line the tables below are vertical noise; as tables you can read
// the layout straight off the page, which is most of the point of a diagram
// being data.

/**
 * The frame the drawing is placed in: `viewBox` on the element, and - split
 * into four numbers - what `check` needs to run `out-of-bounds`. One string,
 * so the page and the checker cannot disagree about the frame.
 */
export const VIEW_BOX = '0 0 1110 270';

const W = 150;  // 150 x 46 is the proportion this project's own diagrams
const H = 46;   // settle on for a labelled box

// The stages, in the order they happen. The spine stops at the decision,
// because the last stage is two nodes rather than one - declaring it over and
// writing it up are the same moment - and a flow that stops being sequential
// is the reason this picture is not a row.
//
// The diamond is taller than the boxes and centred on the same line, so its
// left and right anchors sit where theirs do.
const SPINE = [
  { id: 'paged',    shape: 'box',     x: 40,  y: 110, h: H,  label: 'paged' },
  { id: 'triage',   shape: 'box',     x: 230, y: 110, h: H,  label: 'triage' },
  { id: 'mitigate', shape: 'box',     x: 420, y: 110, h: H,  label: 'mitigate' },
  { id: 'fixed',    shape: 'diamond', x: 610, y: 95,  h: 76, label: 'fixed?' },
] as const;

const OVER = [
  { id: 'clear', shape: 'pill', x: 800, y: 40,  h: H, label: 'all clear' },
  { id: 'post',  shape: 'box',  x: 800, y: 180, h: H, label: 'postmortem' },
] as const;

/** The stages in order, for whatever control drives the picture. */
export const STAGES = [...SPINE.map(({ label }) => label), 'all clear'];

const LAST = SPINE.length;

// Fields that are present or absent rather than true or false, so that a
// diagram served as JSON carries what it draws and not a column of `false`.
const accented = (on: boolean): { accent?: true } => (on ? { accent: true } : {});
const unreached = (on: boolean): { dotted?: true } => (on ? { dotted: true } : {});
// `hatch` shades inside the outline the node is drawn with, inset 4px, so the
// diamond takes it on the same terms as the boxes: it used to be held to them
// alone, because shading followed the box and filled the four corners a
// diamond has not got. Nothing past the diamond is ever shaded, which is a
// statement about the incident rather than about the renderer: the pair at the
// end is never behind you.
const shaded = (on: boolean): { hatch?: true } => (on ? { hatch: true } : {});

/**
 * The picture at one stage, `0` for freshly paged.
 *
 * Solid is what has happened. Everything else is dotted: the steps ahead, and
 * the escalation and the failed fix, which are drawn at every stage because
 * they are always possible and dotted at every stage, because in this run
 * neither happened.
 */
export function incident(stage: number): Diagram {
  return {
    nodes: [
      ...SPINE.map(({ id, shape, x, y, h, label }, i) => ({
        id, shape, x, y, w: W, h, lines: [label],
        ...accented(i === stage), ...shaded(i < stage),
      })),
      ...OVER.map(({ id, shape, x, y, h, label }) => ({
        id, shape, x, y, w: W, h, lines: [label], ...accented(stage === LAST),
      })),
    ],
    edges: [
      { from: ['paged',    'r'], to: ['triage',   'l'], ...unreached(stage < 1) },
      { from: ['triage',   'r'], to: ['mitigate', 'l'], ...unreached(stage < 2) },
      { from: ['mitigate', 'r'], to: ['fixed',    'l'], ...unreached(stage < 3) },

      // The fork. Both leave the same anchor and turn at the same corner, so
      // the first 20px of the two is one line; `check` reports a pair drawn on
      // top of one another the *whole* way, and these part company.
      { from: ['fixed', 'r'], to: ['clear', 'l'], via: [[780, 133], [780, 63]],
        label: 'yes', lx: 766, ly: 88, anchor: 'end', ...unreached(stage < LAST) },
      { from: ['fixed', 'r'], to: ['post',  'l'], via: [[780, 133], [780, 203]],
        ...unreached(stage < LAST) },

      // A self-transition at the defaults: the same node and the same side
      // named twice. `span` 40 puts both anchors well inside the 150 px side
      // it hangs off, and `out` 30 projects into empty space below the row.
      { from: ['triage', 'b'], to: ['triage', 'b'],
        dotted: true, label: 'escalate', lx: 305, ly: 204 },

      // The way back when the answer is no. Bowed, because straight it would
      // run along the bottom edge of the box it arrives at and vanish into it.
      // Nothing reports that: no rule compares an edge with a node's outline,
      // and with the bow taken off `check` finds no fault at all. A render is
      // what tells you.
      { from: ['fixed', 'b'], to: ['mitigate', 'b'], bow: -20,
        dotted: true, label: 'no', lx: 588, ly: 210 },
    ],
    braces: [
      // A curly brace over the pair, and vertical, which is what lets it be
      // curly at all: the corners turn at one fixed radius and the tip at
      // another, so a brace keeps its shape only near the 150-220 px this
      // project's other two are drawn at. Across the row it would have been an
      // underline with a bump; down the side of the stacked pair it is 186.
      //
      // Nothing measures what a brace spans, so both ends and the label are
      // this file's own numbers.
      // `depth` is measured to the right of travel and this span travels top
      // to bottom, so right of travel is screen *left*: a positive depth would
      // point the tip back into the pair and leave the arms facing the label,
      // which is a brace drawn the wrong way round.
      { from: [970, 40], to: [970, 226], depth: -26,
        lines: ['when it', 'is over'], lx: 1006, ly: 133, anchor: 'start' },
    ],
  };
}
