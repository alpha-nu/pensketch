// Shared plumbing for the animation tests: a drawn `<svg>` to animate, and
// enough of a CSS reader to make claims about the stylesheet by parsing rather
// than by looking. Nothing here asserts anything - a helper that fails a test
// is a helper that hides which assertion failed.

import type { Diagram, DrawOptions } from '@pensketch/core';
import { draw } from '@pensketch/core';

const NS = 'http://www.w3.org/2000/svg';

/** A fresh `<svg>` with a diagram already drawn into it. */
export function drawn(
  diagram: Diagram,
  options: DrawOptions = { order: true },
): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  draw(svg, diagram, options);
  return svg;
}

/** Every `<style>` under an element, in document order. */
export const stylesIn = (root: Element): Element[] =>
  Array.from(root.querySelectorAll('style'));

/** Each attribute of an element as `name=value`, sorted. */
export const attrsOf = (element: Element): string[] =>
  element
    .getAttributeNames()
    .map((name) => `${name}=${element.getAttribute(name)}`)
    .sort();

/**
 * A stylesheet split into its `@keyframes` blocks and everything else, with
 * braces counted rather than assumed, so a keyframe block containing braces of
 * its own comes out whole.
 */
export function splitKeyframes(css: string): {
  keyframes: string[];
  rest: string;
} {
  const keyframes: string[] = [];
  let rest = '';
  let from = 0;
  for (;;) {
    const at = css.indexOf('@keyframes', from);
    if (at === -1) {
      rest += css.slice(from);
      return { keyframes, rest };
    }
    rest += css.slice(from, at);
    const open = css.indexOf('{', at);
    if (open === -1) throw new Error(`@keyframes at ${at} opens no block`);
    let depth = 0;
    let end = open;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}' && --depth === 0) break;
    }
    if (depth !== 0) throw new Error(`@keyframes at ${at} is never closed`);
    keyframes.push(css.slice(at, end + 1));
    from = end + 1;
  }
}

/**
 * Every property a stylesheet declares, in order. A declaration's name is what
 * follows a `{` or a `;`, which is true of no selector - `path:not(...)`
 * follows a combinator - and of no media feature, which follows a `(`.
 */
export const declaredIn = (css: string): string[] =>
  Array.from(css.matchAll(/[{;]\s*([a-z-]+)\s*:/g)).map(
    (found) => found[1] as string,
  );

/**
 * Every style rule in a stylesheet, as selector and body. Only sound once the
 * `@keyframes` blocks are out, because it is the absence of nested braces that
 * tells a rule from the at-rule wrapping it.
 */
export const rulesIn = (
  css: string,
): Array<{ selector: string; body: string }> =>
  Array.from(css.matchAll(/([^{}]+)\{([^{}]+)\}/g)).map((found) => ({
    selector: (found[1] as string).trim(),
    body: (found[2] as string).trim(),
  }));
