import { draw } from '@pensketch/core';
import { renderToString } from '@pensketch/core/server';
import { describe, expect, it } from 'vitest';
import { animate, animateMarkup } from '../src/animate';
import { rules } from '../src/rules';
import { FLOW, NOTE } from './fixtures';
import { attrsOf, drawn, stylesIn } from './helpers';

const NS = 'http://www.w3.org/2000/svg';

describe('the stylesheet goes into the drawing', () => {
  it('is the first child, in the SVG namespace, and the only one of it', () => {
    const svg = drawn(FLOW);
    const drawnChildren = svg.children.length;
    animate(svg);
    const style = stylesIn(svg);
    expect(style).toHaveLength(1);
    expect(svg.firstChild).toBe(style[0]);
    expect(style[0]?.namespaceURI).toBe(NS);
    expect(style[0]?.textContent).toBe(rules);
    // The drawing is untouched: this adds, it does not replace.
    expect(svg.children.length).toBe(drawnChildren + 1);
  });

  // The consequence the doc comment exists to state. `draw` removes every
  // child of the element it fills, and the stylesheet is one of them.
  it('is gone when `draw` runs again, and has to be put back', () => {
    const svg = drawn(FLOW);
    animate(svg);
    draw(svg, NOTE, { order: true });
    expect(stylesIn(svg)).toHaveLength(0);
    animate(svg);
    expect(stylesIn(svg)).toHaveLength(1);
  });
});

describe('the timing rides on the root', () => {
  it('sets the custom properties a caller asked for', () => {
    const svg = drawn(FLOW);
    animate(svg, { duration: 3000, stroke: 250, easing: 'ease-in-out' });
    expect(svg.style.getPropertyValue('--ps-dur')).toBe('3000ms');
    expect(svg.style.getPropertyValue('--ps-stroke')).toBe('250ms');
    expect(svg.style.getPropertyValue('--ps-ease')).toBe('ease-in-out');
  });

  // The defaults live in the stylesheet's own `var()` fallbacks and have one
  // home, so an unasked-for property is not written at all.
  it('sets nothing when nothing is asked for', () => {
    const svg = drawn(FLOW);
    animate(svg);
    expect(svg.getAttribute('style')).toBeNull();
  });

  it('adds no class and no id to the element it was handed', () => {
    const svg = drawn(FLOW);
    svg.setAttribute('viewBox', '0 0 700 200');
    const before = attrsOf(svg);
    animate(svg, { duration: 3000 });
    expect(svg.getAttribute('class')).toBeNull();
    expect(svg.getAttribute('id')).toBeNull();
    expect(attrsOf(svg).filter((one) => !one.startsWith('style='))).toEqual(
      before,
    );
  });

  // The rules are a constant, so what two diagrams on one page differ in is
  // only what their own roots carry - and neither can reach the other's.
  it('gives two diagrams byte-identical rules and their own timing', () => {
    const one = drawn(FLOW);
    const two = drawn(NOTE);
    animate(one, { duration: 2000 });
    animate(two, { duration: 5000 });
    expect(stylesIn(one)[0]?.textContent).toBe(stylesIn(two)[0]?.textContent);
    expect(stylesIn(one)[0]?.textContent).toBe(rules);
    expect(one.style.getPropertyValue('--ps-dur')).toBe('2000ms');
    expect(two.style.getPropertyValue('--ps-dur')).toBe('5000ms');
  });
});

describe('the string-side helper', () => {
  // `renderToString` returns the contents of an `<svg>` and the caller supplies
  // the wrapper, so there is no tag here to inject into and nothing looks for
  // one.
  const inner = renderToString(FLOW, { order: true });

  it('takes markup with no `<svg>` tag in it', () => {
    expect(inner).not.toContain('<svg');
    const out = animateMarkup(inner);
    expect(out).toBe(`<style>${rules}</style>${inner}`);
  });

  // The wrapper is the caller's and this never sees it, so the timing goes
  // into a scoped block that reaches the same element `animate` would have set
  // it on. The rules that follow are the constant, unchanged.
  it('carries the timing in a scope of its own, ahead of the constant', () => {
    const out = animateMarkup(inner, { duration: 3000, easing: 'linear' });
    expect(out).toBe(
      `<style>@scope{:scope{--ps-dur:3000ms;--ps-ease:linear}}${rules}</style>${inner}`,
    );
  });

  // Reachable on its own, for a caller who would rather place the `<style>`
  // themselves.
  it('exposes the same rules the element-side helper inserts', () => {
    const svg = drawn(FLOW);
    animate(svg);
    expect(stylesIn(svg)[0]?.textContent).toBe(rules);
    expect(animateMarkup('')).toContain(rules);
  });

  // This one writes a caller's string into a `<style>` itself, and `<style>` is
  // raw text: nothing in it is markup and no entity is decoded, so the single
  // way out is the closing tag's own `</style`. Left unescaped this produced a
  // live `<img onerror>` in the returned string, which is the whole of the
  // hazard - a library caller templating timing from input is exactly the
  // "assembling markup" caller the doc comment addresses.
  //
  // All three options, not just `easing`: `duration` and `stroke` are numbers
  // in TypeScript, which says nothing about what arrives at runtime.
  describe('refuses `<` and `}` in every option, so nothing leaves the block', () => {
    const EXIT = '}}</style><img src=x onerror=alert(1)><style>';

    it.each([
      ['easing', { easing: `ease-out${EXIT}` }],
      ['duration', { duration: `1${EXIT}` as unknown as number }],
      ['stroke', { stroke: `1${EXIT}` as unknown as number }],
    ])('%s cannot close the block', (_name, options) => {
      const out = animateMarkup(inner, options);
      const opened = out.slice(out.indexOf('<style>') + '<style>'.length);
      // One `<style>` and one `</style>`, both this function's own, and no `<`
      // anywhere between them.
      expect(opened.indexOf('</style>')).toBe(opened.lastIndexOf('</style>'));
      expect(opened.slice(0, opened.indexOf('</style>'))).not.toContain('<');
      expect(out).not.toContain('<img');
      expect(out).toContain('\\00003c');
    });

    // The escape is the CSS one for U+003C rather than an HTML entity, because
    // an entity inside raw text is six literal characters and not a `<`. Six
    // hex digits so the character after it can never be read as a seventh.
    it('writes the CSS escape, six digits wide', () => {
      expect(animateMarkup('', { easing: '<' })).toContain(
        '--ps-ease:\\00003c}',
      );
    });

    // The second exit, which stays inside CSS and so is not closed by refusing
    // `<`. The value lands in `@scope{:scope{--ps-ease:HERE}}`, so a `}` closes
    // both braces and what follows is a rule at the top level of a stylesheet
    // that is document-scoped - this one hides every image on the page. It
    // arrives through the same caller as the markup exit, which is why both are
    // closed and not only the one that materialises an element.
    it.each([
      ['easing', { easing: 'ease}}img{display:none' }],
      ['duration', { duration: '1ms}}img{display:none' as unknown as number }],
      ['stroke', { stroke: '1ms}}img{display:none' as unknown as number }],
    ])('%s cannot reach the top level of the stylesheet', (_name, options) => {
      const out = animateMarkup(inner, options);
      const opened = out.slice(out.indexOf('<style>') + '<style>'.length);
      const block = opened.slice(0, opened.indexOf('</style>'));

      // The payload survives as text, and that is the point rather than a
      // shortfall: escaped, it is part of a custom property's value. What has
      // to hold is that it stays there. Every `}` a caller wrote is escaped, so
      // the first literal `}}` in the block is the one this function itself
      // wrote to close `@scope{:scope{` - and nothing of the caller's is after
      // it.
      expect(block).toContain('\\00007d');
      const topLevel = block.slice(block.indexOf('}}') + 2);
      expect(topLevel).not.toContain('img{display:none');
    });

    // A value with nothing to escape is untouched, so the fix costs the honest
    // caller nothing.
    it('leaves an ordinary easing exactly as written', () => {
      expect(
        animateMarkup('', { easing: 'cubic-bezier(.4,0,.2,1)' }),
      ).toContain('--ps-ease:cubic-bezier(.4,0,.2,1)}');
    });
  });
});
