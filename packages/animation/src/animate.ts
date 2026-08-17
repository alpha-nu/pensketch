import { rules } from './rules';

const NS = 'http://www.w3.org/2000/svg';

/**
 * The timing, and nothing else. Everything a diagram can differ in rides on
 * these three, because the rules themselves are a constant: two diagrams on
 * one page carry byte-identical stylesheets and are told apart only by what
 * their own roots carry.
 *
 * Milliseconds, so that a caller writes numbers rather than CSS. What is left
 * out is left unset, and the stylesheet's own fallbacks answer for it - two
 * seconds for the drawing, half of one for any single element, `ease-out` for
 * both - so the defaults have exactly one home.
 */
export interface AnimateOptions {
  /** How long the whole drawing takes, first stroke to last, in ms. */
  duration?: number;
  /** How long any one element takes to appear, in ms. */
  stroke?: number;
  /** The easing every element is given, as a CSS `<easing-function>`. */
  easing?: string;
}

/**
 * A caller's string, on its way into a `<style>` element's contents.
 *
 * Two exits, and both are closed here.
 *
 * `<style>` is a raw-text element: nothing inside it is markup and no entity is
 * decoded, so the one sequence that leaves it is the closing tag's own
 * `</style`. Left alone, an `easing` of `x}}</style><img src=x onerror=…><style>`
 * ends the element and materialises a live one. Refusing `<` closes that whole.
 *
 * The second is narrower and stays inside CSS, which is why it is easy to stop
 * at the first. The value is written into `@scope{:scope{--ps-ease:HERE}}`, so a
 * `}` closes those braces and everything after it is a rule at the top level of
 * a stylesheet that is **document-scoped** - `ease}}img{display:none}` hides
 * every image on the page. No script and no markup, but not nothing, and it
 * arrives through the same caller as the first: one templating a timing option
 * from input. A guard that took one and left the other would be answering half
 * of one question.
 *
 * All three options go through here, not only `easing`: `duration` and `stroke`
 * are numbers in TypeScript, which is a claim about the call site rather than a
 * guarantee about what arrives at runtime.
 *
 * Written as CSS escapes rather than HTML entities, because an entity inside raw
 * text is six literal characters rather than the one it names. Six hex digits
 * each, so the character after can never be read as a seventh. A timing option
 * carrying either of these is nonsense whatever happens; this keeps it nonsense
 * that stays inside the block it was written into.
 *
 * The same shape as the escape `@pensketch/mcp` puts on a caller's label before
 * it reaches an attribute: a caller's string, a context that does not escape
 * for you, one substitution at the boundary.
 */
const escapeStyle = (value: string) =>
  String(value).replace(/[<}]/g, (c) => (c === '<' ? '\\00003c' : '\\00007d'));

/** The custom properties an options object asks for, and only those. */
const timing = (options: AnimateOptions): Array<[string, string]> => {
  const set: Array<[string, string]> = [];
  if (options.duration !== undefined)
    set.push(['--ps-dur', `${options.duration}ms`]);
  if (options.stroke !== undefined)
    set.push(['--ps-stroke', `${options.stroke}ms`]);
  if (options.easing !== undefined) set.push(['--ps-ease', options.easing]);
  return set;
};

/**
 * Makes an `<svg>` that `draw` filled draw itself, by putting the stylesheet
 * inside it as its first child and the timing on the element itself.
 *
 * **Call this after `draw`, never before.** `draw` removes every child of the
 * element it fills, so a `<style>` put there first goes with them and the
 * diagram simply appears. The same is true of a redraw: `draw` called again on
 * an element that was animated takes the stylesheet with it, and `animate` has
 * to be called again. Nothing about the signature says so, which is why it is
 * said here.
 *
 * `draw` must also have been passed `order: true`. Without it no element
 * carries the `--ps-i` the rules read, the `animation` shorthand is invalid at
 * computed-value time, and the diagram renders finished and still - the same
 * picture it would have with no stylesheet at all, rather than a blank one.
 *
 * Nothing is added to the element but the `<style>` and the custom properties
 * a caller asked for: no class, no id. The element belongs to the caller, and
 * the rules find it through an implicit `@scope` instead.
 *
 * @param svg - The element `draw` filled.
 * @param options - The timing. Anything left out keeps the stylesheet's own
 * default.
 *
 * @example
 * ```js
 * import { draw } from '@pensketch/core';
 * import { animate } from '@pensketch/animation';
 *
 * const svg = document.querySelector('svg');
 * draw(svg, diagram, { order: true });
 * animate(svg, { duration: 3000 });
 * ```
 */
export function animate(
  svg: SVGSVGElement,
  options: AnimateOptions = {},
): void {
  // The owner document, never a global one: the same code has to run under a
  // browser, jsdom or any other conforming DOM.
  const style = svg.ownerDocument.createElementNS(NS, 'style');
  style.textContent = rules;
  // First child, so the rules are in place before anything they describe. On
  // an empty element `firstChild` is null and this appends.
  svg.insertBefore(style, svg.firstChild);
  for (const [name, value] of timing(options))
    svg.style.setProperty(name, value);
}

/**
 * The same thing for a caller holding markup rather than an element.
 *
 * It takes the **contents** of an `<svg>` and returns contents: this is what
 * `@pensketch/core/server`'s `renderToString` hands back, the caller supplying
 * the wrapper themselves. Nothing here looks for an `<svg>` tag, and passing
 * one whole would put the `<style>` outside it, where its scope is the
 * document.
 *
 * The timing cannot be written onto a wrapper this function never sees, so it
 * is written into the stylesheet instead, in a scoped block of its own that
 * reaches exactly the same element `animate` would have set it on. The rules
 * that follow it are the constant, unchanged.
 *
 * @param markup - The contents of an `<svg>`, drawn with `order: true`.
 * @param options - The timing. Anything left out keeps the stylesheet's own
 * default.
 *
 * @example
 * ```js
 * import { renderToString } from '@pensketch/core/server';
 * import { animateMarkup } from '@pensketch/animation';
 *
 * const inner = animateMarkup(renderToString(diagram, { order: true }), {
 *   duration: 3000,
 * });
 * const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">${inner}</svg>`;
 * ```
 */
export function animateMarkup(
  markup: string,
  options: AnimateOptions = {},
): string {
  // Escaped here and not in `timing`, because the two callers are not in the
  // same position. `animate` hands each value to `style.setProperty`, and CSSOM
  // serialises what it stores - a value carrying `<` never reaches markup at
  // all. This one writes the value into a `<style>` itself, so it is the one
  // that has to.
  const set = timing(options)
    .map(([name, value]) => `${name}:${escapeStyle(value)}`)
    .join(';');
  const own = set ? `@scope{:scope{${set}}}` : '';
  return `<style>${own}${rules}</style>${markup}`;
}
