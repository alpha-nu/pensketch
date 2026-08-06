import { describe, expect, it } from 'vitest';
import { serialize } from './serialize.mjs';

const NS = 'http://www.w3.org/2000/svg';

// Attributes are set in the order given, which the fragment below keeps
// deliberately out of alphabetical order.
function el(name: string, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, value);
  return node;
}

// The goldens and the assertions compared against them both flow through the
// serializer, so a bug in it - a dropped attribute, a lost line - would be
// invisible to every parity test. These assert the output exactly.
describe('serialize', () => {
  it('emits one line per descendant with attributes sorted by name', () => {
    const root = el('svg', { viewBox: '0 0 10 10', id: 'root' });
    const group = el('g', {
      'stroke-linecap': 'round',
      opacity: '0.5',
      stroke: 'var(--ink)',
    });
    const path = el('path', {
      'stroke-width': '1.6',
      d: 'M0 0 L1 1',
      'stroke-dasharray': '2 7',
      fill: 'none',
    });
    const inner = el('g', { transform: 'translate(1 2)' });
    const text = el('text', {
      y: '2',
      'dominant-baseline': 'middle',
      x: '1',
    });
    text.textContent = 'two words';
    const title = el('title');
    title.textContent = 'not a text element';
    const rect = el('rect', { rx: '6', fill: 'var(--wash)' });

    root.append(group, title, rect);
    group.append(path, inner);
    inner.append(text);

    expect(serialize(root)).toBe(
      [
        // Sorted by name, so `stroke` precedes `stroke-linecap`; sorting the
        // formatted strings would have reversed the two.
        'g opacity="0.5" stroke="var(--ink)" stroke-linecap="round"',
        // The subtree under `g` is emitted before its next sibling, and a
        // value containing a space survives verbatim.
        'path d="M0 0 L1 1" fill="none" stroke-dasharray="2 7" stroke-width="1.6"',
        'g transform="translate(1 2)"',
        'text dominant-baseline="middle" x="1" y="2" two words',
        // Text content belongs to `<text>` alone, and an element with no
        // attributes is its tag name and nothing else.
        'title',
        'rect fill="var(--wash)" rx="6"',
      ].join('\n'),
    );
  });

  it('emits nothing for an element without children', () => {
    expect(serialize(el('svg', { id: 'empty' }))).toBe('');
  });
});
