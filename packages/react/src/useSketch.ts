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
