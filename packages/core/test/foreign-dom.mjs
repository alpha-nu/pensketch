// An `<svg>` from a second, independently constructed jsdom: its own
// document, its own element constructors, its own realm. Plain ESM because
// jsdom ships no type declarations, so a TypeScript module cannot import it
// without inventing them.

import { JSDOM } from 'jsdom';

/**
 * @returns {SVGSVGElement} a detached `<svg>` owned by a fresh jsdom document.
 */
export function foreignSvg() {
  const { document } = new JSDOM().window;
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}
