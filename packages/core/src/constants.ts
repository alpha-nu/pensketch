// Every aesthetic number the renderer bakes into its output, named once here
// so none of them can hide inside a draw call. A number added to this file
// belongs in the frozen object at the bottom too, or it is invisible to the
// tests and the documentation alike.

/** Nominal length in px of one jittered polyline segment. */
export const SEG_LEN = 26;
/**
 * Fewest segments a polyline leg is ever split into, and the fewest chords an
 * arc is sampled into: the same floor, one level up. A degenerate arc is two
 * chords, each of which `pass` then splits into two segments of its own.
 */
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
/**
 * Segments in a full turn of an arc. A partial sweep takes its share, so a
 * half circle is cut into half as many and density does not change with the
 * angle asked for. Equal to `PILL_STEPS` by construction rather than by
 * accident: a full sweep then samples the ellipse `pill` samples for the box,
 * at the same angles, though `pill` jitters its radii on top of that.
 *
 * It is a floor on density, not a ceiling. Past a radius of about 108 px a
 * chord this coarse would outrun `SEG_LEN`, and an arc is sampled more
 * finely so that no leg of a curve is longer than a leg of a straight line.
 */
export const ARC_STEPS = 26;
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
/**
 * How far a self-transition projects beyond the side it leaves, in px, when
 * the edge does not say.
 *
 * A starting point rather than a computed value: nothing here measures a node
 * to decide how far its loop should reach, because that would be layout. It is
 * three quarters of `LOOP_SPAN`, and the ratio is what carries the shape: far
 * below half of it the arc flattens into a dome, far above the whole of it the
 * arc closes into a spike growing out of the node's own outline.
 *
 * It was 60, against a `LOOP_SPAN` of 24, both read off the state-machine
 * example's hand-drawn loop - seven points placed by eye. A circular arc
 * through the same two anchors is not that shape: a freehand loop bulges past
 * its anchors, and this one cannot, its height being exactly `span`. So the
 * pair kept that drawing's anchors, lost its proportions, and drew a dart.
 * Corrected against the drawing rather than the arithmetic, which is the only
 * thing that can settle a number like this. A caller whose node is much
 * smaller or much busier will still want their own.
 */
export const LOOP_OUT = 30;
/**
 * How far apart a self-transition's two anchors sit along its side, in px,
 * when the edge does not say. Centred on the side's midpoint, so the loop
 * leaves above and returns below.
 *
 * Sized to fit inside the shorter side of the box this project's own diagrams
 * settle on - about 150 x 46 - so a loop hanging off a left or right side
 * keeps both its anchors on the side. On a side shorter than this they run
 * past the corners, which is the caller's to notice rather than the renderer's
 * to correct. No rule measures a loop against the node it hangs off, and none
 * is coming: relating the two is the layout this library does not do.
 */
export const LOOP_SPAN = 40;
/** Note font size in px. */
export const NOTE_SIZE = 13;
/** Jitter amplitude in px of a note's arrow. */
export const NOTE_AMP = 2;
/** Seed used when none is given. */
export const SEED = 1;

/**
 * Every aesthetic constant, frozen, so a test or a document can name a number
 * instead of repeating it. None of them is configurable: the look is the
 * product, and moving any one of them moves the rendered bytes of every
 * diagram already drawn.
 */
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
  ARC_STEPS,
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
  LOOP_OUT,
  LOOP_SPAN,
  NOTE_SIZE,
  NOTE_AMP,
  SEED,
});
