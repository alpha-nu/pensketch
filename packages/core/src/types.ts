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
  rect(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  /** An ellipse inscribed in the box, traced as one wobbling loop. */
  pill(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  /** A diamond through the midpoints of the box's four sides. */
  diamond(
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: StrokeOptions,
  ): void;
  /**
   * Diagonal shading across the box, clipped to it at both ends. Default
   * color: `theme.ink`.
   */
  hatch(x: number, y: number, w: number, h: number, color?: string): void;
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
  /** Which outline to trace around the box. */
  shape: 'box' | 'pill' | 'diamond';
  /** Label lines, one `<text>` each. Omit for an unlabelled shape. */
  lines?: string[];
  /** Label font size in px. Default: `13.5`. */
  size?: number;
  /** Stroke in `theme.pen` rather than `theme.ink`. Default: `false`. */
  accent?: boolean;
  /** Shade the interior, inset 4 px, in `theme.pen`. Default: `false`. */
  hatch?: boolean;
}

/** Anything a diagram can place: a group, or one of the drawn shapes. */
export type DiagramNode = GroupNode | ShapeNode;

/**
 * An arrow from one node's side to another's. The path is exactly the legs
 * between the anchors and whatever `via` points are given, in order: nothing
 * routes around obstacles.
 */
export interface DiagramEdge {
  /** The id of the node to leave, and which side to leave from. */
  from: [string, Side];
  /** The id of the node to reach, and which side the head lands on. */
  to: [string, Side];
  /** Corner points between the two anchors. */
  via?: Point[];
  /** Dash the line and recolor it, and its label, to `theme.accent`. */
  dotted?: boolean;
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
  /** Corner points between `arrowFrom` and `arrowTo`. */
  via?: Point[];
  /** Where the pointer arrow ends. Drawn only when both ends are given. */
  arrowTo?: Point;
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
}
