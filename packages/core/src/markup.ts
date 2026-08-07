// A DOM the size of what this package actually touches, and a serializer for
// it. Internal: no entry point re-exports either, so `./server` publishes
// exactly one name.
//
// `draw` and `pen` between them use seven members of the DOM -
// `ownerDocument.createElementNS`, `setAttribute`, `appendChild`,
// `textContent`, `firstChild` and `removeChild` - because element creation
// deliberately goes through the target's own document rather than a global
// one. That decision is what makes fifty lines enough here: no jsdom, no
// browser, no native code, and rendering works wherever JavaScript does.

/**
 * The reading half, which a real `Element` satisfies as it stands — so the
 * same serializer walks a browser's tree and this one, and the two can be
 * compared without either side describing itself.
 *
 * `ArrayLike` rather than `Iterable` because that is what `HTMLCollection`
 * and `NamedNodeMap` are without the `DOM.Iterable` lib, and widening the
 * project's lib to make a serializer read better is the wrong way round.
 */
export interface Readable {
  tagName: string;
  children: ArrayLike<Readable>;
  textContent: string | null;
  attributes: ArrayLike<{ name: string }>;
  getAttribute(name: string): string | null;
}

/** The writing half, which is what `draw` needs and this module supplies. */
export interface Shim extends Readable {
  children: Shim[];
  textContent: string;
  setAttribute(name: string, value: string): void;
  appendChild(node: Shim): void;
  removeChild(node: Shim): void;
  firstChild: Shim | null;
  ownerDocument: { createElementNS(ns: string, name: string): Shim };
}

/** One element, with the members `draw` and `pen` reach for and no others. */
export function element(tagName: string): Shim {
  const attrs = new Map<string, string>();
  const children: Shim[] = [];

  return {
    tagName,
    children,
    textContent: '',
    // A live view, in the order a real `NamedNodeMap` reports: insertion.
    // Nothing downstream depends on that order - the serializer sorts.
    get attributes() {
      return [...attrs.keys()].map((name) => ({ name }));
    },
    get firstChild() {
      return children[0] ?? null;
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    appendChild: (node) => {
      children.push(node);
    },
    removeChild: (node) => {
      const at = children.indexOf(node);
      if (at >= 0) children.splice(at, 1);
    },
    ownerDocument: { createElementNS: (_ns, name) => element(name) },
  };
}

// Attribute values also escape the quote that delimits them; text does not,
// where a quote is just a character.
const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (value: string) => escapeText(value).replace(/"/g, '&quot;');

/**
 * The descendants of `root` as SVG markup, depth-first in document order.
 * The root itself is never emitted: `draw` fills an `<svg>` the caller
 * already has, so the markup is its children and the caller keeps the
 * wrapper — which is also what makes this comparable, element for element,
 * with what a browser produces.
 *
 * Attributes are sorted by name, matching the golden serializer, so output
 * does not depend on the order a DOM implementation reports them in.
 */
export function markup(root: Readable): string {
  let out = '';
  for (const child of Array.from(root.children)) {
    const tag = child.tagName.toLowerCase();
    // Both of these are `string | null` in the DOM's own types and neither
    // can be null here: the name came from the element's own attribute list,
    // and `textContent` is null only for nodes that are not elements. The
    // assertions say so rather than adding a fallback for a state that cannot
    // arise, which would be an untestable branch either way.
    const attrs = Array.from(child.attributes, (a) => a.name)
      .sort()
      .map((n) => ` ${n}="${escapeAttr(child.getAttribute(n) as string)}"`)
      .join('');
    const inner = markup(child) || escapeText(child.textContent as string);
    out += inner ? `<${tag}${attrs}>${inner}</${tag}>` : `<${tag}${attrs}/>`;
  }
  return out;
}
