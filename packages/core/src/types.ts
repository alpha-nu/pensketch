import type { Theme } from './theme';

export type Point = [number, number];

export type Side = 't' | 'b' | 'l' | 'r';

export interface StrokeOptions {
  // Any CSS color or var() expression. Default: theme.ink.
  color?: string;
  // Default: false.
  dotted?: boolean;
  // Primary-pass stroke width in px. Default: 1.6.
  width?: number;
  // Jitter amplitude in px. Default: 2.6.
  amplitude?: number;
}

export interface LabelOptions {
  // Font size in px. Default: 13.5.
  size?: number;
  // Default: theme.ink.
  color?: string;
  // Default: 'middle'.
  anchor?: 'start' | 'middle' | 'end';
  // Line height as a multiple of the font size. Default: 1.28.
  lineHeight?: number;
}

export interface PenOptions {
  // Default: 1.
  seed?: number;
  // Shallow-merged over defaultTheme.
  theme?: Partial<Theme>;
}

export interface Pen {
  stroke(pts: Point[], opts?: StrokeOptions): void;
  arrow(pts: Point[], opts?: StrokeOptions): void;
  rect(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  pill(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  diamond(
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: StrokeOptions,
  ): void;
  hatch(x: number, y: number, w: number, h: number, color?: string): void;
  label(
    x: number,
    y: number,
    lines: string | string[],
    opts?: LabelOptions,
  ): void;
  wash(x: number, y: number, w: number, h: number, fill?: string): void;
  // The pen's seeded PRNG. Calling it advances the sequence.
  rng(): number;
}

interface NodeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// A group's title is drawn unconditionally, so declaring it optional would
// invite a shape of data that cannot be rendered.
interface GroupNode extends NodeBox {
  shape: 'group';
  lines: string[];
}

interface ShapeNode extends NodeBox {
  shape: 'box' | 'pill' | 'diamond';
  lines?: string[];
  // Label font size override.
  size?: number;
  // Stroke with theme.pen instead of theme.ink.
  accent?: boolean;
  // Hatch-fill the interior, inset 4 px, in theme.pen.
  hatch?: boolean;
}

export type DiagramNode = GroupNode | ShapeNode;

export interface DiagramEdge {
  from: [string, Side];
  to: [string, Side];
  // Waypoints between the two anchors.
  via?: Point[];
  // Dotted implies the accent color.
  dotted?: boolean;
  label?: string;
  // Label position. Both are required when label is set.
  lx?: number;
  ly?: number;
  // Label anchor. Default: 'middle'.
  anchor?: 'start' | 'middle' | 'end';
}

export interface DiagramNote {
  x: number;
  y: number;
  lines: string[];
  // Default: 'start'.
  anchor?: 'start' | 'middle' | 'end';
  arrowFrom?: Point;
  via?: Point[];
  // The arrow is drawn only when both arrowFrom and arrowTo are set.
  arrowTo?: Point;
}

export interface Diagram {
  nodes?: DiagramNode[];
  edges?: DiagramEdge[];
  notes?: DiagramNote[];
  raw?: Array<(pen: Pen) => void>;
}

export interface DrawOptions extends PenOptions {
  // Sets role="img" and aria-label on the svg.
  label?: string;
}
