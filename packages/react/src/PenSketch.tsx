import { type Diagram, draw, type Theme } from '@pensketch/core';
import {
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

/**
 * Everything an `<svg>` takes, minus its children - the diagram owns them -
 * plus what pensketch needs to draw one.
 */
export interface PenSketchProps
  extends Omit<ComponentPropsWithoutRef<'svg'>, 'children'> {
  /**
   * The picture as data. Compared by identity, never by value, so keep it
   * module-level or memoized: a fresh object literal on every render redraws
   * the diagram on every render.
   */
  diagram: Diagram;
  /**
   * Seeds the drawing's PRNG. Two diagrams with the same seed wobble
   * identically, so a seed is a choice of drawing rather than a source of
   * noise. Default: `1`.
   */
  seed?: number;
  /**
   * The roles to override, shallow-merged over `defaultTheme`. Compared by
   * identity like `diagram`, and with the same consequence when it is a fresh
   * object literal.
   */
  theme?: Partial<Theme>;
  /**
   * Required: pensketch places every shape in the diagram's own coordinate
   * space, and the viewBox is what maps that space onto the element.
   */
  viewBox: string;
}

/**
 * Renders `diagram` into a bare `<svg>`, redrawing whenever `diagram`, `seed`
 * or `theme` changes identity. Every other prop is spread onto the element, so
 * `className`, `aria-label` and the rest behave exactly as they would on a
 * hand-written `<svg>`.
 *
 * The drawing happens in an effect, which means the server renders the empty
 * element and the client fills it in after hydration - no mismatch, and no DOM
 * API touched while rendering.
 */
export const PenSketch = forwardRef(function PenSketch(
  { diagram, seed = 1, theme, ...rest }: PenSketchProps,
  ref: ForwardedRef<SVGSVGElement>,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // One element, two claims on it: the caller's ref, whatever shape it came
  // in, and the private one the drawing effect reads.
  const attach = useCallback(
    (node: SVGSVGElement | null) => {
      svgRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    // The element is this component's own and the ref is attached before any
    // effect runs, so the read is total in a way its type cannot say.
    const svg = svgRef.current as SVGSVGElement;
    // `draw` clears before it draws, so running this twice - as StrictMode
    // does - leaves exactly what running it once leaves.
    draw(svg, diagram, theme === undefined ? { seed } : { seed, theme });
  }, [diagram, seed, theme]);

  return <svg ref={attach} {...rest} />;
});
