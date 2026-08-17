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

/**
 * A stand-in for `@pensketch/animation`'s `animate`, which these tests
 * deliberately do not import: this package declares no relationship with that
 * one, and a test resolving it through the workspace symlink would be proving
 * something no consumer's install can reproduce. What the prop promises is
 * that it takes *a function* and applies it to the filled element, so a
 * function that does what the real one does to the DOM - a `<style>` as the
 * element's first child - is the whole of what there is to observe here.
 *
 * What the rules then do in a browser is the animation package's own gate,
 * and jsdom could not witness it anyway: it neither computes `@scope` nor
 * runs an animation.
 */
export function stylesheet(svg: SVGSVGElement): void {
  const style = svg.ownerDocument.createElementNS(NS, 'style');
  style.textContent = ':scope>path{animation:ps-draw 1s}';
  svg.insertBefore(style, svg.firstChild);
}
