import { describe, expect, it } from 'vitest';
import { draw } from '../src/draw';
import { element, markup } from '../src/markup';
import * as subpath from '../src/server';
import { renderToString } from '../src/server';
import type { Diagram } from '../src/types';
import { SAMPLER } from './fixtures';
import { makeSvg } from './helpers';

const FLOW: Diagram = {
  nodes: [
    {
      id: 'in',
      shape: 'pill',
      x: 40,
      y: 50,
      w: 160,
      h: 50,
      lines: ['request'],
    },
    {
      id: 'gate',
      shape: 'diamond',
      x: 260,
      y: 35,
      w: 150,
      h: 80,
      lines: ['allowed?'],
    },
  ],
  edges: [{ from: ['in', 'r'], to: ['gate', 'l'] }],
};

describe('renderToString', () => {
  it('exports exactly one runtime name', () => {
    expect(Object.keys(subpath)).toEqual(['renderToString']);
  });

  // The claim that matters: this is the same renderer, not a second one. Two
  // independent DOM implementations - jsdom's and the shim's - walked by one
  // serializer, so a difference can only come from the tree.
  it('renders what draw renders, element for element', () => {
    const svg = makeSvg();
    draw(svg, SAMPLER, { seed: 7 });
    expect(renderToString(SAMPLER, { seed: 7 })).toBe(markup(svg));
  });

  it('is deterministic across calls, like everything else here', () => {
    expect(renderToString(FLOW, { seed: 7 })).toBe(
      renderToString(FLOW, { seed: 7 }),
    );
    expect(renderToString(FLOW, { seed: 7 })).not.toBe(
      renderToString(FLOW, { seed: 8 }),
    );
  });

  it('needs no document, and never reaches for one', () => {
    expect(renderToString(FLOW)).toContain('<path');
    // Nothing about a global document is mocked away here: if the shim ever
    // stopped covering a member, this file would already have failed under
    // jsdom. What this pins is that the source names no global.
    expect(subpath.renderToString.toString()).not.toContain('document');
  });

  // `label` puts role and aria-label on the element `draw` is handed. There
  // is no such element here, so the option is accepted and changes nothing -
  // stated in the JSDoc and pinned so it cannot start mattering by accident.
  it('ignores the accessible label, which belongs on the wrapper', () => {
    expect(renderToString(FLOW, { seed: 7, label: 'Request flow' })).toBe(
      renderToString(FLOW, { seed: 7 }),
    );
  });
});

describe('markup', () => {
  // Written by hand rather than captured from the code, so it pins the format
  // itself: sorted attributes, a self-closed empty element, and text as the
  // content of its own tag.
  it('emits sorted attributes and closes empty elements', () => {
    const root = element('svg');
    const path = element('path');
    path.setAttribute('stroke', 'red');
    path.setAttribute('d', 'M0 0');
    path.setAttribute('fill', 'none');
    root.appendChild(path);

    expect(markup(root)).toBe('<path d="M0 0" fill="none" stroke="red"/>');
  });

  it('puts text inside its element', () => {
    const root = element('svg');
    const text = element('text');
    text.setAttribute('x', '10');
    text.textContent = 'hello';
    root.appendChild(text);

    expect(markup(root)).toBe('<text x="10">hello</text>');
  });

  it('nests children in document order', () => {
    const root = element('svg');
    const outer = element('g');
    const first = element('path');
    const second = element('rect');
    outer.appendChild(first);
    outer.appendChild(second);
    root.appendChild(outer);

    expect(markup(root)).toBe('<g><path/><rect/></g>');
  });

  // A label is the caller's text and can contain anything. Unescaped, an
  // ampersand alone makes the document unparseable.
  it('escapes what would otherwise break the document', () => {
    const root = element('svg');
    const text = element('text');
    text.setAttribute('style', 'font-family:"a & b"');
    text.textContent = 'fish & <chips>';
    root.appendChild(text);

    expect(markup(root)).toBe(
      '<text style="font-family:&quot;a &amp; b&quot;">fish &amp; &lt;chips&gt;</text>',
    );
  });
});

describe('the shim', () => {
  it('reports the members draw reads', () => {
    const root = element('svg');
    expect(root.firstChild).toBeNull();
    expect(root.getAttribute('missing')).toBeNull();

    const child = element('path');
    root.appendChild(child);
    expect(root.firstChild).toBe(child);
    expect(Array.from(root.attributes)).toEqual([]);
  });

  // `draw` empties its target before drawing, so a shim that could not remove
  // a child would break the moment one were reused.
  it('empties the way draw empties, one first child at a time', () => {
    const root = element('svg');
    const a = element('path');
    const b = element('path');
    root.appendChild(a);
    root.appendChild(b);

    while (root.firstChild) root.removeChild(root.firstChild);
    expect(root.children).toEqual([]);
    expect(markup(root)).toBe('');
  });

  it('ignores a node it does not have', () => {
    const root = element('svg');
    const orphan = element('path');
    root.removeChild(orphan);
    expect(root.children).toEqual([]);
  });

  it('creates elements through the document it carries, as pen does', () => {
    const made = element('svg').ownerDocument.createElementNS('urn:x', 'rect');
    expect(made.tagName).toBe('rect');
  });
});
