// Every aesthetic number the renderer bakes into its output. They are frozen,
// not configurable: the look is the product, and changing any of them moves
// the rendered bytes of every existing diagram.

/** Nominal length in px of one jittered polyline segment. */
export const SEG_LEN = 26;
/** Fewest segments a polyline leg is ever split into. */
export const MIN_STEPS = 2;
/** Jitter multiplier at a leg's final point, so joints stay tight. */
export const END_DAMP = 0.4;
/** Default stroke width in px of the primary pass. */
export const WIDTH = 1.6;
/** Default jitter amplitude in px. */
export const AMP = 2.6;
/** Second pass stroke width, as a fraction of the primary pass. */
export const PASS2_W = 0.75;
/** Opacity of the primary stroke pass. */
export const OP1 = 0.92;
/** Opacity of the second stroke pass. */
export const OP2 = 0.5;
/** stroke-dasharray value used for dotted strokes. */
export const DASH = '2 7';
/** Length in px of each arrowhead barb. */
export const HEAD_LEN = 10;
/** Half-angle in radians between the two arrowhead barbs and the shaft. */
export const HEAD_SPREAD = 0.5;
/** Jitter amplitude in px of the arrowhead barbs. */
export const HEAD_AMP = 1.2;
/** Largest corner overshoot in px at each end of a rect side. */
export const OVERSHOOT = 4;
/** Number of segments around a pill outline. */
export const PILL_STEPS = 26;
/** Jitter in px of a pill's horizontal radius, per outline point. */
export const PILL_JX = 3;
/** Jitter in px of a pill's vertical radius, per outline point. */
export const PILL_JY = 2;
/** Jitter amplitude in px of a pill outline. */
export const PILL_AMP = 1.4;
/** Distance in px between hatch lines. */
export const HATCH_GAP = 11;
/** Stroke width in px of a hatch line. */
export const HATCH_W = 1;
/** Jitter amplitude in px of a hatch line. */
export const HATCH_AMP = 1.2;
/** Inset in px of a node's hatch fill from its outline. */
export const HATCH_INSET = 4;
/** Default label font size in px. */
export const SIZE = 13.5;
/** Default label line height, as a multiple of the font size. */
export const LINE_H = 1.28;
/** Corner radius in px of a group's wash rect. */
export const WASH_RX = 6;
/** Stroke width in px of a group border. */
export const GROUP_W = 1.4;
/** Jitter amplitude in px of a group border. */
export const GROUP_AMP = 3.2;
/** Group title offset in px from the group's left edge. */
export const TITLE_DX = 14;
/** Group title offset in px from the group's top edge. */
export const TITLE_DY = 18;
/** Group title font size in px. */
export const TITLE_SIZE = 14;
/** Edge label font size in px. */
export const EDGE_SIZE = 12.5;
/** Note font size in px. */
export const NOTE_SIZE = 13;
/** Jitter amplitude in px of a note's arrow. */
export const NOTE_AMP = 2;
/** Seed used when none is given. */
export const SEED = 1;

/** Every aesthetic constant, frozen, for tests and documentation. */
export const constants = Object.freeze({
  SEG_LEN,
  MIN_STEPS,
  END_DAMP,
  WIDTH,
  AMP,
  PASS2_W,
  OP1,
  OP2,
  DASH,
  HEAD_LEN,
  HEAD_SPREAD,
  HEAD_AMP,
  OVERSHOOT,
  PILL_STEPS,
  PILL_JX,
  PILL_JY,
  PILL_AMP,
  HATCH_GAP,
  HATCH_W,
  HATCH_AMP,
  HATCH_INSET,
  SIZE,
  LINE_H,
  WASH_RX,
  GROUP_W,
  GROUP_AMP,
  TITLE_DX,
  TITLE_DY,
  TITLE_SIZE,
  EDGE_SIZE,
  NOTE_SIZE,
  NOTE_AMP,
  SEED,
});
