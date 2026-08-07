import { draw } from './draw';
import { element, markup } from './markup';
import type { Diagram, DrawOptions } from './types';

/**
 * Renders a diagram to SVG markup with no DOM in sight — no browser, no
 * jsdom, no global `document`. Same renderer, same seeded sequence, same
 * bytes: this draws through `draw` into a shim rather than reimplementing
 * anything, because a second renderer that quietly disagreed would break the
 * byte-parity contract in silence.
 *
 * What comes back is the *contents* of an `<svg>`, not the element itself,
 * exactly as `draw` fills an element the caller already has. Supply the
 * wrapper, and with it the `viewBox`, the accessible name and any styling:
 *
 * ```js
 * import { renderToString } from '@pensketch/core/server';
 *
 * const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 150"
 *   role="img" aria-label="Request flow">${renderToString(diagram, { seed: 7 })}</svg>`;
 * ```
 *
 * `DrawOptions.label` is accepted for signature parity with `draw`, which
 * sets `role` and `aria-label` on the element it is given. Nothing here has
 * that element, so the option changes no bytes of the result — put the two
 * attributes on the wrapper, as above.
 */
export function renderToString(
  diagram: Diagram,
  options: DrawOptions = {},
): string {
  const root = element('svg');
  // The shim is a DOM only as far as `draw` reaches into one, which no type
  // can say. Every member it touches is implemented; the rest of
  // `SVGSVGElement` is not, and never runs.
  draw(root as unknown as SVGSVGElement, diagram, options);
  return markup(root);
}
