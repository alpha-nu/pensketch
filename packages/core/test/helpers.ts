// Shared plumbing for the unit tests: building the element under test,
// reading what was appended to it, and taking apart a path's `d`. Nothing
// here asserts anything - a helper that fails a test is a helper that hides
// which assertion failed.

import type { Point } from '../src/index';

const NS = 'http://www.w3.org/2000/svg';

/** A fresh, detached `<svg>`, by default in the ambient test document. */
export function makeSvg(doc: Document = document): SVGSVGElement {
  return doc.createElementNS(NS, 'svg');
}

/** Every `<path>` under an element, in document order. */
export const pathsOf = (root: Element): SVGPathElement[] =>
  Array.from(root.querySelectorAll('path'));

/** Every `<text>` under an element, in document order. */
export const textsOf = (root: Element): SVGTextElement[] =>
  Array.from(root.querySelectorAll('text'));

/** The lowercase tag name of each direct child, in document order. */
export const tagsOf = (root: Element): string[] =>
  Array.from(root.children, (child) => child.tagName.toLowerCase());

/** Each direct child, in document order. */
export const childrenOf = (root: Element): Element[] =>
  Array.from(root.children);

/**
 * The points of a path's `d`, which this renderer only ever writes as one
 * `M x y` followed by `L x y` pairs.
 */
export function pointsOf(path: Element): Point[] {
  return (path.getAttribute('d') ?? '')
    .split(/[ML]/)
    .filter((part) => part.trim() !== '')
    .map((part) => {
      const [x = Number.NaN, y = Number.NaN] = part
        .trim()
        .split(/\s+/)
        .map(Number);
      return [x, y];
    });
}

/**
 * Indexed access that reports a missing element as a missing element, rather
 * than as `undefined` surfacing three assertions later.
 */
export function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined)
    throw new Error(
      `expected an item at index ${index}, found ${items.length}`,
    );
  return item;
}
