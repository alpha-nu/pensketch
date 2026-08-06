// The one serializer behind both the checked-in goldens and the values
// compared against them. Plain ESM on purpose: the golden generator runs
// under bare Node, which cannot import a TypeScript module.

/**
 * Serialize an element's descendants: one line per element, depth-first in
 * document order, each line being the lowercase tag name followed by
 * `name="value"` for every attribute and, for `<text>`, its text content.
 *
 * Attributes are sorted by attribute *name*, which makes the output
 * independent of the order a DOM implementation happens to report them in.
 * Sorting the formatted `name="value"` strings instead would differ: `-`
 * sorts below `=`, so `stroke-linecap` would come out before `stroke`.
 *
 * The root element itself is never emitted, so the result says nothing about
 * how the container was created or what attributes it carries.
 *
 * @param {Element} root
 * @returns {string}
 */
export function serialize(root) {
  const lines = [];
  collect(root, lines);
  return lines.join('\n');
}

/**
 * @param {Element} parent
 * @param {string[]} lines
 */
function collect(parent, lines) {
  for (const child of parent.children) {
    lines.push(lineFor(child));
    collect(child, lines);
  }
}

/**
 * @param {Element} el
 * @returns {string}
 */
function lineFor(el) {
  const tag = el.tagName.toLowerCase();
  const parts = [tag];
  const names = Array.from(el.attributes, (a) => a.name).sort();
  for (const name of names) parts.push(`${name}="${el.getAttribute(name)}"`);
  if (tag === 'text') parts.push(el.textContent);
  return parts.join(' ');
}
