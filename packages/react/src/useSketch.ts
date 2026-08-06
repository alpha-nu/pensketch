import { type Pen, type PenOptions, pen } from '@pensketch/core';
import { type RefObject, useEffect, useRef } from 'react';

/**
 * The escape hatch from `<PenSketch>`: a ref to put on an `<svg>` of your own,
 * and a callback handed a `Pen` bound to it once it is mounted. The svg is
 * cleared before each run, so the callback always draws onto an empty element.
 *
 * The callback runs again whenever it, `options.seed` or `options.theme`
 * changes identity - so keep the callback module-level or memoized, or it
 * redraws on every render.
 *
 * @param sketch - What to draw. Every call on the pen consumes numbers from
 * the seeded sequence, so the order of the calls is part of the output.
 * @param options - The seed and theme the pen is built with.
 *
 * @example
 * ```tsx
 * import { useSketch } from '@pensketch/react';
 * import type { Pen } from '@pensketch/core';
 *
 * // Module scope: a callback that keeps its identity does not redraw.
 * function sketch(p: Pen) {
 *   p.rect(20, 20, 200, 90);
 *   p.label(120, 65, 'hand-drawn box');
 *   p.arrow([[220, 65], [320, 65]]);
 *   p.pill(320, 40, 150, 50);
 *   p.label(395, 65, ['a pill', '(two lines)']);
 * }
 *
 * export function Sketch() {
 *   const ref = useSketch(sketch, { seed: 3 });
 *   return <svg ref={ref} viewBox="0 0 500 130" />;
 * }
 * ```
 */
export function useSketch(
  sketch: (pen: Pen) => void,
  options: PenOptions = {},
): RefObject<SVGSVGElement | null> {
  const { seed, theme } = options;
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    // Which element the ref reaches is the caller's decision, and a ref they
    // never attached reaches none.
    const svg = ref.current;
    if (!svg) return;
    // Cleared child by child rather than through innerHTML, which is an HTML
    // parser detour that not every DOM implementation offers on SVG elements.
    // Clearing first is also what makes a second run - StrictMode's - leave
    // exactly what the first left.
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // Absent options are omitted rather than passed as undefined, so the
    // defaults stay core's to choose.
    sketch(
      pen(svg, {
        ...(seed === undefined ? {} : { seed }),
        ...(theme === undefined ? {} : { theme }),
      }),
    );
  }, [sketch, seed, theme]);

  return ref;
}
