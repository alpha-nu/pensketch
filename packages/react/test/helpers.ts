// Shared plumbing for the binding tests: finding the mounted element, and
// producing the bytes core writes for the same drawing outside React, which is
// what every "did it draw" assertion compares against. Nothing here asserts
// anything - a helper that fails a test is a helper that hides which assertion
// failed.

import type { Diagram, DrawOptions, Pen, PenOptions } from '@pensketch/core';
import { draw, pen } from '@pensketch/core';

const NS = 'http://www.w3.org/2000/svg';

/** The `<svg>` a render mounted, reported as missing when it is missing. */
export function svgIn(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('expected a mounted <svg>, found none');
  return svg;
}

/** What `draw` writes for this diagram, outside React. */
export function drawn(diagram: Diagram, options?: DrawOptions): string {
  const svg = document.createElementNS(NS, 'svg');
  draw(svg, diagram, options);
  return svg.innerHTML;
}

/** What a fresh pen writes for this callback, outside React. */
export function sketched(
  sketch: (pen: Pen) => void,
  options?: PenOptions,
): string {
  const svg = document.createElementNS(NS, 'svg');
  sketch(pen(svg, options));
  return svg.innerHTML;
}

/** The direct children of an element, as the node instances themselves. */
export const childrenOf = (element: Element): Element[] =>
  Array.from(element.children);
