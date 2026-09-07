import type { Theme } from './theme';

/**
 * An `[x, y]` position in the diagram's own coordinate space, which is the
 * one the `<svg>` viewBox declares rather than screen pixels.
 */
export type Point = [number, number];

/**
 * Which side of a node's box an edge attaches to: top, bottom, left, right.
 */
export type Side = 't' | 'b' | 'l' | 'r';

/** Per-call overrides for any of the pen's outline primitives. */
export interface StrokeOptions {
  /** Any CSS color or `var()` expression. Default: `theme.ink`. */
  color?: string;
  /** Dash the line. Arrowheads ignore this. Default: `false`. */
  dotted?: boolean;
  /**
   * Stroke width in px of the primary pass; the lighter second pass is drawn
   * at three quarters of it. Default: `1.6`.
   */
  width?: number;
  /**
   * How far in px a point may wander from its true position. Larger values
   * read as a shakier hand. Default: `2.6`.
   */
  amplitude?: number;
}

/** Per-call overrides for the pen's closed shapes: every stroke override, plus depth. */
export interface ShapeOptions extends StrokeOptions {
  /**
   * Extrude the shape by this many px. The faces are the run of the ideal
   * outline whose outward normals point up-right with the extrusion vector
   * `(depth, -0.75 × depth)`: that run is redrawn offset by the vector as one
   * polyline, joined to the outline at its two silhouette points and ribbed
   * at each interior corner, and every face that descends the screen is
   * hatched in `theme.muted` - a box's right face, a pill's whole band.
   * Winding is read off the
   * outline's signed area, so a mirrored dimension still extrudes outward.
   * Default: absent.
   *
   * Absent, zero, negative or non-finite draws no faces, consumes nothing
   * from the seeded sequence, and leaves the shape's bytes exactly what the
   * optionless call drew. That is the pen ignoring a depth rather than the
   * library accepting one: hand the same zero, negative or non-finite number
   * to `draw` where something reads it and it throws before drawing anything,
   * naming the node or the option that carried it. A pen validates nothing;
   * the renderer above it does.
   *
   * A pill has a size below which there is no outline to extrude, and the
   * bound is on its *larger* dimension: faces appear once that reaches
   * `3 × ARC_MIN_CHORD / π`, 11.4592 px, because below it the sampled
   * ellipse is two chords - one diameter, enclosing no area to wind. So a
   * 1 x 11.46 pill extrudes and an 11.45 x 11.45 one does not. A box and a
   * diamond have four literal corners at every size and extrude at any
   * non-zero one.
   */
  depth?: number;
}

/** Per-call overrides for text. Nothing here measures or wraps a string. */
export interface LabelOptions {
  /** Font size in px. Default: `13.5`. */
  size?: number;
  /** Any CSS color or `var()` expression. Default: `theme.ink`. */
  color?: string;
  /** Which end of the text sits on the given x. Default: `'middle'`. */
  anchor?: 'start' | 'middle' | 'end';
  /** Line spacing as a multiple of the font size. Default: `1.28`. */
  lineHeight?: number;
}

/** What a pen is built with, whether it is built directly or by `draw`. */
export interface PenOptions {
  /**
   * Seeds the pen's PRNG. Two pens with the same seed wobble identically, so
   * a seed is a choice of drawing rather than a source of noise. Default: `1`.
   */
  seed?: number;
  /** The roles to override, shallow-merged over `defaultTheme`. */
  theme?: Partial<Theme>;
}

/**
 * The low-level drawing surface. Every method appends elements to the `<svg>`
 * the pen was built with and consumes numbers from its seeded sequence, so
 * the order the methods are called in is part of the rendered output.
 */
export interface Pen {
  /**
   * A polyline through `pts`, cut into short segments, jittered, and traced
   * twice. Needs at least one point; below that it throws a `TypeError`.
   */
  stroke(pts: Point[], opts?: StrokeOptions): void;
  /**
   * `stroke`, plus two barbs at the last point aimed back along the final
   * leg. The barbs are never dashed, whatever `dotted` says, because a dashed
   * arrowhead reads as noise. Needs at least two points; below that it throws
   * a `TypeError`.
   */
  arrow(pts: Point[], opts?: StrokeOptions): void;
  /**
   * A rectangle drawn as four independent sides, each overshooting its
   * corners by up to 4 px, which is what keeps it from looking machine-made.
   */
  rect(x: number, y: number, w: number, h: number, opts?: ShapeOptions): void;
  /** An ellipse inscribed in the box, traced as one wobbling loop. */
  pill(x: number, y: number, w: number, h: number, opts?: ShapeOptions): void;
  /**
   * An elliptical arc around `(cx, cy)` with radii `rx` and `ry`, swept from
   * angle `from` to angle `to`, for the curved connectors a straight run of
   * points cannot state: a loop back onto a node's own side, or a bow that
   * holds two edges of the same pair apart. Both angles are in radians, and
   * the sign of `to - from` gives the direction the sweep travels. An
   * increasing angle turns from the +x axis towards +y, which is clockwise on
   * screen, because SVG's y grows downward. The arc is sampled into a polyline
   * and drawn through `stroke`, so it wobbles like everything else and no
   * curve command reaches the markup. Up to a radius of about 108 px a full
   * turn samples the same ellipse `pill` samples for the same box, at the same
   * angles — the ellipse, not the drawing: `pill` wobbles its radii per point
   * and strokes lighter, so the two wobble differently along one path. Beyond
   * that radius an arc takes more points than `pill` does, so that no leg of a
   * curve is ever longer than a leg of a straight line.
   */
  arc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    from: number,
    to: number,
    opts?: StrokeOptions,
  ): void;
  /** A diamond through the midpoints of the box's four sides. */
  diamond(
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: ShapeOptions,
  ): void;
  /**
   * Diagonal shading across the box, clipped to it at both ends. Default
   * color: `theme.ink`.
   *
   * Given `clip`, a closed polygon in the same coordinates, each diagonal is
   * cut to that instead — the same lines, cut somewhere else — so a shape
   * narrower than its box is shaded inside itself. The box still says which
   * diagonals are ruled, so pass the one the polygon sits in. The polygon may
   * repeat its first point at the end or not; the edges are walked wrapping
   * round either way. Concave is fine, and so is self-intersecting: crossings
   * are paired in order along the line, which fills by the even-odd rule.
   */
  hatch(
    x: number,
    y: number,
    w: number,
    h: number,
    color?: string,
    clip?: Point[],
  ): void;
  /**
   * One `<text>` per line, the block centered on `(x, y)`. A plain string is
   * one line. Where the lines break is the caller's decision: nothing in
   * pensketch measures text.
   */
  label(
    x: number,
    y: number,
    lines: string | string[],
    opts?: LabelOptions,
  ): void;
  /** A plain rounded background rect. Default fill: `theme.wash`. */
  wash(x: number, y: number, w: number, h: number, fill?: string): void;
  /**
   * The pen's seeded PRNG, returning a float in `[0, 1)`. Calling it advances
   * the sequence every later stroke draws from.
   */
  rng(): number;
}

/**
 * The box a node occupies. Boxes are placed by hand and never fitted to their
 * text, because nothing here measures text.
 */
interface NodeBox {
  /** How edges name this node. Unique within the diagram. */
  id: string;
  /** Left edge of the box. */
  x: number;
  /** Top edge of the box. */
  y: number;
  /** Width of the box in px. */
  w: number;
  /** Height of the box in px. */
  h: number;
}

/**
 * A titled region drawn behind everything else. Its title is drawn
 * unconditionally, so `lines` is required here and optional on every other
 * shape: an untitled group cannot render.
 */
interface GroupNode extends NodeBox {
  /** Selects the group treatment: a wash, a border, and a title. */
  shape: 'group';
  /** The title, drawn inside the top left corner in `theme.pen`. */
  lines: string[];
}

/** A drawn node, with an optional label centered in its box. */
interface ShapeNode extends NodeBox {
  /**
   * Which outline to trace around the box. Default: `'box'`.
   *
   * Optional because a box is what most nodes are - 71 of the 100 drawn nodes
   * across the 15 figures this repository ships - and every one of them
   * spelled the field out. An agent writing a diagram pays for that in tokens it
   * generates one at a time, so the common case is the one that should be
   * free to write. An omitted `shape` and `shape: 'box'` produce the same
   * bytes; nothing existing changes.
   */
  shape?: 'box' | 'pill' | 'diamond';
  /** Label lines, one `<text>` each. Omit for an unlabelled shape. */
  lines?: string[];
  /**
   * Label font size in px. Default: `13.5`.
   *
   * Leave it alone until something says otherwise. It shrinks the text, never
   * the box, so it is the answer to one question only: a label `check`
   * reports as `text-overflow` that cannot be shortened or given a wider box.
   * Setting it across a diagram for consistency is a decision about that
   * diagram, not a habit.
   */
  size?: number;
  /** Stroke in `theme.pen` rather than `theme.ink`. Default: `false`. */
  accent?: boolean;
  /**
   * Shade the node with diagonal lines, inset 4 px, in `theme.pen`. Default:
   * `false`.
   *
   * The shading follows the outline the shape is drawn with, so a pill is
   * shaded inside its ellipse and a diamond inside its four sides. Until
   * 0.3.0 it followed the *box* instead, reaching into corners a pill and a
   * diamond have not got.
   */
  hatch?: boolean;
  /**
   * Extrude this node into a slab: the run of its outline facing up-right is
   * redrawn offset by `(depth, -0.75 × depth)` and joined to it at the two
   * silhouette points and ribbed at each interior corner, with every
   * descending face hatched in `theme.muted`.
   * Default: the diagram's `extrude` option, then `false`. The override cuts
   * both ways - `true` raises this node out of a flat diagram, and `false`
   * flattens it in an extruded one.
   *
   * A shape too small to carry a face is drawn flat whatever this says, and
   * nothing reports it: the pair is read, nothing throws, no face appears and
   * the anchors do not move, so `true` on a 10 × 8 pill renders the bytes the
   * flat node does. Only a pill has such a size - under
   * `3 × ARC_MIN_CHORD / π`, 11.4592 px, in its larger dimension - and a box
   * or a diamond extrudes at any non-zero one.
   */
  extrude?: boolean;
  /**
   * Depth in px when this node extrudes, over the diagram's `depth` option
   * and then `12`. The default is calibrated on a box, which reads as a slab
   * at any scale; a pill wants a depth near a third of its height to read as
   * a coin, and a diamond prefers staying flat - the per-shape record sits
   * on `constants.DEPTH`. When extrusion is off for this node the field
   * applies to nothing and is ignored.
   *
   * Where it is read it has to be a positive finite number of px, or `draw`
   * throws naming this node before it draws anything - `0`, a negative,
   * `NaN` and `Infinity` alike. An inherited options depth is judged on the
   * same terms and reported against the node that inherited it, and `check`
   * reports both in the same words, as `undrawable-depth`, an error.
   *
   * The number is judged for what it is, not for the box it lands in: a
   * shape too small to carry a face has its depth validated and then draws
   * flat anyway, so `12` on a 10 × 8 pill is accepted, changes no byte and
   * moves no anchor, on the terms `extrude` above states.
   */
  depth?: number;
}

/** Anything a diagram can place: a group, or one of the drawn shapes. */
export type DiagramNode = GroupNode | ShapeNode;

/**
 * An arrow from one node's side to another's. Its path is the one this edge's
 * own fields describe and nothing more: a straight run between the anchors,
 * the legs through `via`, an arc set by `bow`, or the loop a self-transition
 * hangs off one side. Nothing is inferred and nothing routes around an
 * obstacle.
 */
export interface DiagramEdge {
  /** The id of the node to leave, and which side to leave from. */
  from: [string, Side];
  /**
   * The id of the node to reach, and which side the head lands on.
   *
   * Naming the same node and the same side as `from` draws a self-transition:
   * a loop off that side, leaving and returning to it, with the arrowhead on
   * the anchor it returns to. The same node with two *different* sides throws
   * — a loop attaches to one side, and a corner loop is a different shape with
   * its own geometry to get right.
   */
  to: [string, Side];
  /**
   * How far a self-transition projects beyond its side, in px. Default: `30`.
   *
   * Ignored unless `from` and `to` name the same node and side. It is a
   * starting point rather than a fitted value: nothing measures the node to
   * decide how far its loop should reach, because that would be layout. On a
   * small or crowded node, choose your own: `check` reports a loop that leaves
   * the frame, and nothing reports one that lands on a neighbour.
   *
   * Keep it near three quarters of `span`, which is the ratio that makes the
   * arc read as a loop. Far below half of `span` it flattens into a shallow
   * dome; far above the whole of `span` it closes into a spike growing out of
   * the node's own outline. No rule reports either — a shape nobody meant is
   * still a shape, and this is the one number here you cannot check by eye.
   *
   * A loop is sampled into chords no longer than a straight line's, so the
   * number of points it costs grows with this. A value that is not a finite
   * number throws rather than sampling; a merely enormous one is drawn, and
   * one large enough exhausts memory before it finishes.
   */
  out?: number;
  /**
   * How far apart a self-transition's two anchors sit along its side, in px,
   * centred on the side's midpoint. Default: `40`, which fits inside the 46 px
   * height of the box proportion this project's own diagrams settle on.
   *
   * Ignored unless `from` and `to` name the same node and side. A value wider
   * than the side itself puts the anchors past the corners, which is the
   * caller's to notice rather than the renderer's to correct. As with `out`, a
   * value that is not a finite number throws rather than sampling.
   */
  span?: number;
  /**
   * Corner points between the two anchors, walked in order and used exactly
   * as given. Nothing is inferred and nothing routes around an obstacle: an
   * orthogonal path is the corners you supply, not a mode. Omit it and the
   * arrow runs straight from one anchor to the other, through whatever is in
   * the way.
   *
   * `draw` throws when this is given alongside `bow`, and when a
   * self-transition carries it. Each describes a whole path and a path is
   * described once; a loop's is settled by the side it hangs off and by `out`
   * and `span`, so there are no corners between its anchors to place. An
   * empty array describes no corners and is refused nowhere.
   */
  via?: Point[];
  /**
   * How far the arrow bows off the straight line between its anchors, in px.
   * Default: `0`, which is that straight line.
   *
   * The path becomes the circular arc through both anchors whose furthest
   * point sits this far from the middle of that line, measured at a right
   * angle to it. A positive value bows to the right of travel, so an edge and
   * its reverse given the same `bow` bow to opposite sides and stay two
   * readable lines rather than one.
   *
   * A value deeper than half the distance between the anchors is drawn as
   * asked: the arc simply carries more than half a turn. As with a loop, the
   * curve is sampled into chords no longer than a straight line's, so the
   * points it costs grow with the value. And as with `out` and `span`, a value
   * that is not a finite number throws rather than sampling.
   *
   * `draw` throws when this is given alongside `via`, and when a
   * self-transition carries it: each describes a whole path, and a loop's is
   * already settled by the side it hangs off and by `out` and `span`.
   */
  bow?: number;
  /** Dash the line and recolor it, and its label, to `theme.accent`. */
  dotted?: boolean;
  /**
   * Draw this edge as the one that goes over wherever it crosses another, so
   * a reader can tell which of two lines is continuous. Default: `false`.
   *
   * What moves is the *other* line: it is broken for `HOP_GAP` px where the
   * two cross, and this edge is drawn straight through. Nothing is added to
   * this edge's own path.
   *
   * Overrides `DrawOptions.hops` in both directions, so `false` is an opt-out
   * of a diagram-wide switch and not merely the absence of an opt-in. Where
   * both edges of a crossing hop, the one later in `edges` goes over.
   *
   * Only a crossing is bridged, and only against another edge: two edges
   * meeting at a shared anchor grow nothing, two drawn along one another grow
   * nothing, and a node's outline, a brace and a note's pointer are not
   * considered. A crossing under the arrowhead is skipped, where a bump would
   * be illegible and would aim the barbs off the line of travel.
   */
  hop?: boolean;
  /** A single line of text. Requires `lx` and `ly`. */
  label?: string;
  /** Label x. `draw` throws if `label` is set and this is not a number. */
  lx?: number;
  /** Label y. `draw` throws if `label` is set and this is not a number. */
  ly?: number;
  /** Which end of the label sits on `lx`. Default: `'middle'`. */
  anchor?: 'start' | 'middle' | 'end';
}

/**
 * Free-standing annotation text in `theme.accent`, optionally with a dotted
 * arrow pointing at what it is about.
 */
export interface DiagramNote {
  /** Horizontal origin of the text; `anchor` says which end of it sits here. */
  x: number;
  /** Vertical center of the whole block of lines. */
  y: number;
  /** The lines of the note, one `<text>` each. */
  lines: string[];
  /** Which end of the text sits on `x`. Default: `'start'`. */
  anchor?: 'start' | 'middle' | 'end';
  /** Where the pointer arrow starts. */
  arrowFrom?: Point;
  /**
   * Corner points between `arrowFrom` and `arrowTo`. `draw` throws when they
   * are given alongside `bow`, as it does on an edge: a path is described
   * once.
   */
  via?: Point[];
  /**
   * How far the pointer bows off the straight line between its two ends, in
   * px, with the meaning `bow` carries on an edge: positive is to the right of
   * travel, and `0` is that straight line. Default: `0`.
   *
   * A pointer is the case a bow was wanted for first — it starts at text and
   * ends at whatever the text is about, and a straight run between those two
   * often crosses the very thing it points at.
   *
   * Refused alongside a non-empty `via`, exactly as on an edge, with a named
   * message. A non-finite value is not refused in that sense: it reaches the
   * sampler and dies there as a bare `TypeError` naming no field, the way
   * `out`, `span` and an edge's own `bow` do. A named message for the four is
   * a follow-up, not a promise this line should imply.
   */
  bow?: number;
  /** Where the pointer arrow ends. Drawn only when both ends are given. */
  arrowTo?: Point;
}

/**
 * A brace or a square bracket over a span, with an optional label.
 *
 * What a group does — bounding a set and naming it — for the two cases a
 * rectangle cannot serve: sets that overlap, and a span that should be marked
 * without enclosing what is inside it. Drawn in `theme.pen`, the same role a
 * group's border and a group's title carry, so a reader who has learned what
 * that blue means here has already learned what a brace is.
 *
 * Nothing about it is inferred from what it happens to span. `from`, `to` and
 * `depth` are the whole of its shape, in the caller's own coordinates.
 */
export interface DiagramBrace {
  /** Where the span starts. */
  from: Point;
  /** Where the span ends. */
  to: Point;
  /**
   * How far the tip stands off the midpoint of the span, in px, perpendicular
   * to it. Positive is to the right of travel, the sign convention an edge's
   * `bow` carries, so flipping a brace to the other side of what it spans is a
   * minus sign. Default: `26`.
   *
   * A starting point rather than a fitted value: nothing measures what the
   * brace spans. `0` draws a straight line, which is legal and is not a brace.
   */
  depth?: number;
  /**
   * `'curly'` for a brace, four quarter-arcs and two runs meeting at a point;
   * `'square'` for a bracket, four points and no curve in it. Default:
   * `'curly'`.
   */
  kind?: 'curly' | 'square';
  /**
   * The lines of the label, one `<text>` each, in `theme.pen`. `lines` rather
   * than one string, as an edge's `label` is: a brace over a column of rows is
   * exactly where a second line wants to go.
   *
   * Requires `lx` and `ly`, and `draw` throws without them, in the words it
   * uses for an edge label. Nothing places the text relative to the tip — this
   * library never measures text, and a caller who chose `depth` knows where
   * the tip is.
   */
  lines?: string[];
  /** Where the label sits horizontally; `anchor` says which end sits here. */
  lx?: number;
  /** The vertical centre of the block of lines. Required once `lines` is. */
  ly?: number;
  /** Which end of the label sits on `lx`. Default: `'start'`. */
  anchor?: 'start' | 'middle' | 'end';
}

/**
 * A picture as data. The phases are drawn in the order they are declared
 * here, which is both the z-order and the order the seeded sequence is
 * consumed in, so it is part of the rendered bytes.
 */
export interface Diagram {
  /** Groups are drawn first, behind everything; the rest after the edges. */
  nodes?: DiagramNode[];
  /** Arrows, drawn over the groups and under the shapes they connect. */
  edges?: DiagramEdge[];
  /**
   * Braces and brackets, drawn after the shapes and before the notes: over
   * what they span, and under the annotation that explains them. The position
   * is part of the rendered bytes, not an implementation detail.
   */
  braces?: DiagramBrace[];
  /** Annotations, drawn over everything but the raw callbacks. */
  notes?: DiagramNote[];
  /**
   * The escape hatch, run last. Each callback is handed the same pen the rest
   * of the diagram was drawn with, mid-sequence.
   */
  raw?: Array<(pen: Pen) => void>;
}

/** What `draw` takes: everything a pen takes, plus how it announces itself. */
export interface DrawOptions extends PenOptions {
  /**
   * Sets `role="img"` and `aria-label` on the `<svg>`, so a screen reader
   * announces the diagram as one image instead of reading its labels loose.
   * Left unset, neither attribute is touched.
   */
  label?: string;
  /**
   * Draw every edge hopping over the edges it crosses. Default: `false`, so a
   * diagram that asks for nothing renders exactly as it did before hops
   * existed.
   *
   * An edge's own `hop` wins over this either way, which is what lets one
   * connector opt out without turning the switch off for the picture.
   */
  hops?: boolean;
  /**
   * Extrude every drawn shape into a slab. Default: `false`, so a diagram
   * that asks for nothing renders exactly as it did before depth existed.
   *
   * A node's own `extrude` wins over this either way, as an edge's `hop`
   * wins over `hops`: an extruded diagram can flatten one node and a flat
   * diagram can raise one. A group never extrudes - it bounds a set rather
   * than being an object - so its frame draws flat whatever this says, and so
   * does a shape with no face to carry at its size: a pill under 11.4592 px
   * in its larger dimension, and nothing else at any non-zero one.
   */
  extrude?: boolean;
  /**
   * Depth in px for every node extruded without a `depth` of its own.
   * Default: `12`, calibrated on a box; a pill wants a depth near a third
   * of its height and a diamond prefers staying flat - the per-shape record
   * sits on `constants.DEPTH`.
   *
   * Validated wherever it could be read, which is wider than where it is
   * drawn: `draw` throws on anything that is not a positive finite number of
   * px whenever `extrude` above is on - with every node opted out, and with
   * no nodes at all - and again through each node that extrudes on its own
   * and reaches for this. A value neither the switch nor any node reads is
   * ignored.
   *
   * Bounded by nothing, and the most expensive number in this object. Depth
   * costs about 84 B of markup per px - least squares over depths of 100 to
   * 1000 on one 150 x 46 box at seed 7 - on top of about 4.6 kB for the
   * faces themselves, so that one box at `depth: 1000` renders 90 kB. `check`
   * reads this number's form and not its cost: it passes `depth: 20000` in
   * under a millisecond, where drawing the same one-box diagram emits 1.7 MB
   * of markup.
   */
  depth?: number;
  /**
   * Stamp every element with `--ps-i`, how far through the drawing it is, as a
   * fraction in `[0, 1)`. Default: `false`, so a diagram that asks for nothing
   * renders exactly the bytes it always did - no attribute added, no element
   * moved.
   *
   * The number counts in the order a hand would draw in, which is not the
   * order the document is in: group frames, then node shapes, then the
   * connectors between them, then braces, notes and `raw`, and then every
   * piece of text whatever phase drew it. A fraction rather than a count, so a
   * page states one duration and every diagram takes it whatever its element
   * count.
   *
   * Every path carrying no `stroke-dasharray` also gains `pathLength="1"`,
   * which normalises it so one keyframe draws a 400 px connector and a 12 px
   * arrowhead barb at the same rate. A dashed path is left alone: `pathLength`
   * rescales every distance along a path and the dash pattern is one, so the
   * dashes would be stretched past the end of the line and the stroke would
   * render solid.
   *
   * Nothing is reordered. The z-order, the seeded sequence and the elements
   * themselves are what they were; only the number differs from document
   * order. A `pen` driven by hand is uninstrumented - the index is a property
   * of `draw`'s phases, and a pen has none.
   */
  order?: boolean;
}
