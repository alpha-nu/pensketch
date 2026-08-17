import { render } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { PenSketch } from '../src/index';
import { FLOW, NOTE, VIEW_BOX } from './fixtures';
import { childrenOf, drawn, stylesheet, svgIn } from './helpers';

describe('<PenSketch> drawing', () => {
  it('draws the diagram into the svg on mount', () => {
    const { container } = render(
      <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />,
    );
    const svg = svgIn(container);

    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg.innerHTML).toBe(drawn(FLOW, { seed: 7 }));
  });

  it('seeds with 1 when no seed is given', () => {
    const { container } = render(
      <PenSketch diagram={FLOW} viewBox={VIEW_BOX} />,
    );
    const svg = svgIn(container);

    expect(svg.innerHTML).toBe(drawn(FLOW, { seed: 1 }));
    expect(svg.innerHTML).not.toBe(drawn(FLOW, { seed: 2 }));
  });

  it('redraws into the same element when the seed changes', () => {
    const { container, rerender } = render(
      <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />,
    );
    const svg = svgIn(container);
    const sevens = svg.innerHTML;

    rerender(<PenSketch diagram={FLOW} seed={8} viewBox={VIEW_BOX} />);

    expect(svgIn(container)).toBe(svg);
    expect(svg.innerHTML).toBe(drawn(FLOW, { seed: 8 }));
    expect(svg.innerHTML).not.toBe(sevens);
  });

  it('redraws when the diagram changes', () => {
    const { container, rerender } = render(
      <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />,
    );

    rerender(<PenSketch diagram={NOTE} seed={7} viewBox={VIEW_BOX} />);

    expect(svgIn(container).innerHTML).toBe(drawn(NOTE, { seed: 7 }));
  });

  // The redraw is a replacement, not an overlay: what the previous diagram
  // left has to be gone, which is what makes a StrictMode double effect
  // indistinguishable from a single one.
  it('leaves nothing of the previous diagram behind', () => {
    const { container, rerender } = render(
      <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />,
    );

    rerender(<PenSketch diagram={NOTE} seed={7} viewBox={VIEW_BOX} />);

    const texts = Array.from(
      svgIn(container).querySelectorAll('text'),
      (text) => text.textContent,
    );
    expect(texts).toEqual(['a note']);
  });

  it('does not rebuild the children when every identity is stable', () => {
    const theme = { ink: 'hotpink' };
    const { container, rerender } = render(
      <PenSketch
        className="before"
        diagram={FLOW}
        seed={7}
        theme={theme}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);
    const children = childrenOf(svg);

    rerender(
      <PenSketch
        className="after"
        diagram={FLOW}
        seed={7}
        theme={theme}
        viewBox={VIEW_BOX}
      />,
    );

    // The re-render did happen; only the drawing was left alone.
    expect(svg.getAttribute('class')).toBe('after');
    expect(childrenOf(svg)).toHaveLength(children.length);
    for (const [i, child] of children.entries())
      expect(svg.children[i]).toBe(child);
  });
});

describe('<PenSketch> theming', () => {
  it('passes a theme override through to the drawing', () => {
    const theme = { ink: 'hotpink' };
    const { container } = render(
      <PenSketch diagram={FLOW} seed={7} theme={theme} viewBox={VIEW_BOX} />,
    );

    expect(svgIn(container).innerHTML).toBe(
      drawn(FLOW, { seed: 7, theme: { ink: 'hotpink' } }),
    );
    expect(svgIn(container).innerHTML).toContain('hotpink');
  });

  it('redraws when the theme changes identity', () => {
    const { container, rerender } = render(
      <PenSketch
        diagram={FLOW}
        seed={7}
        theme={{ ink: 'hotpink' }}
        viewBox={VIEW_BOX}
      />,
    );

    rerender(
      <PenSketch
        diagram={FLOW}
        seed={7}
        theme={{ ink: 'rebeccapurple' }}
        viewBox={VIEW_BOX}
      />,
    );

    expect(svgIn(container).innerHTML).toBe(
      drawn(FLOW, { seed: 7, theme: { ink: 'rebeccapurple' } }),
    );
  });
});

describe('<PenSketch> element', () => {
  it('applies viewBox and spreads the rest of the props', () => {
    const { container } = render(
      <PenSketch
        aria-label="Request flow"
        className="sketch"
        data-testid="flow"
        diagram={FLOW}
        role="img"
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);

    expect(svg.getAttribute('viewBox')).toBe(VIEW_BOX);
    expect(svg.getAttribute('class')).toBe('sketch');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Request flow');
    expect(svg.getAttribute('data-testid')).toBe('flow');
  });

  // The props the component consumes are its own; leaking them onto the
  // element would put `diagram="[object Object]"` in the markup.
  it('keeps its own props off the element', () => {
    const { container } = render(
      <PenSketch
        animate={stylesheet}
        diagram={FLOW}
        seed={7}
        theme={{ ink: 'hotpink' }}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);

    for (const name of ['animate', 'diagram', 'seed', 'theme'])
      expect(svg.getAttribute(name)).toBeNull();
  });

  it('forwards an object ref to the svg', () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(
      <PenSketch diagram={FLOW} ref={ref} seed={7} viewBox={VIEW_BOX} />,
    );

    expect(ref.current).toBe(svgIn(container));
  });

  // Only newer React honours a cleanup returned from a callback ref; older
  // React ignores it and calls the ref with null instead. Either is fine, but
  // wrapping an element must not behave differently from the element itself,
  // so this compares the two rather than pinning one React's semantics.
  it('treats a cleanup-returning callback ref exactly as a bare svg does', () => {
    const record = (seen: string[]) => (node: SVGSVGElement | null) => {
      seen.push(node ? 'attached' : 'null');
      return () => {
        seen.push('cleanup');
      };
    };

    const wrapped: string[] = [];
    const bare: string[] = [];
    const a = render(
      <PenSketch diagram={FLOW} viewBox={VIEW_BOX} ref={record(wrapped)} />,
    );
    const b = render(<svg viewBox={VIEW_BOX} ref={record(bare)} />);

    a.unmount();
    b.unmount();

    expect(wrapped).toEqual(bare);
    expect(wrapped[0]).toBe('attached');
  });

  it('forwards a callback ref, and detaches it on unmount', () => {
    const seen: (SVGSVGElement | null)[] = [];
    const { container, unmount } = render(
      <PenSketch
        diagram={FLOW}
        ref={(node) => {
          seen.push(node);
        }}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(svgIn(container));

    unmount();

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBeNull();
  });
});

describe('<PenSketch> animation', () => {
  it('draws with order, and applies the function to the filled element', () => {
    let atCall = { children: 0, paths: 0 };
    const { container } = render(
      <PenSketch
        animate={(svg) => {
          atCall = {
            children: svg.children.length,
            paths: svg.querySelectorAll('path').length,
          };
        }}
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);

    // Called after `draw` filled the element, not before: the elements the
    // function is there to decorate already exist when it runs.
    expect(atCall.paths).toBeGreaterThan(0);
    expect(atCall.children).toBe(childrenOf(svg).length);
    // And the drawing carries what the motion reads. This function adds
    // nothing, so the markup is exactly `order: true` and nothing else.
    expect(svg.innerHTML).toBe(drawn(FLOW, { seed: 7, order: true }));
    expect(svg.innerHTML).toContain('--ps-i:0.000;');
    expect(svg.innerHTML).toContain('pathLength="1"');
  });

  // The other half of `order`, and the one a golden would catch late: a
  // component that asks for nothing renders the bytes it always rendered.
  it('renders exactly what it always did when no function is given', () => {
    const { container } = render(
      <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />,
    );
    const svg = svgIn(container);

    expect(svg.innerHTML).toBe(drawn(FLOW, { seed: 7 }));
    expect(svg.innerHTML).not.toContain('--ps-i:');
    expect(svg.innerHTML).not.toContain('pathLength');
    expect(svg.querySelector('style')).toBeNull();
  });

  // T-10. Both failures this can have are failures of *where* the function is
  // applied, and one number catches both: applied twice in the one effect the
  // svg holds two stylesheets, and applied from an effect declared above the
  // drawing one it holds none, because effects run in declaration order and
  // `draw` empties the element. Neither is the component counting anything.
  it('holds exactly one stylesheet under StrictMode, the element having been emptied', () => {
    const { container } = render(
      <StrictMode>
        <PenSketch
          animate={stylesheet}
          diagram={FLOW}
          seed={7}
          viewBox={VIEW_BOX}
        />
      </StrictMode>,
    );
    const svg = svgIn(container);

    expect(svg.querySelectorAll('style')).toHaveLength(1);
    // Where the real one puts it, and inside the drawing rather than beside
    // it - an implicit `@scope` binds to the `<style>`'s own parent.
    expect(svg.firstChild).toBe(svg.querySelector('style'));
    // Everything else the effect drew is still what a plain draw draws.
    expect(svg.innerHTML.replace(/^<style>.*?<\/style>/, '')).toBe(
      drawn(FLOW, { seed: 7, order: true }),
    );
  });

  it('holds exactly one stylesheet on a plain mount too', () => {
    const { container } = render(
      <PenSketch
        animate={stylesheet}
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    expect(svgIn(container).querySelectorAll('style')).toHaveLength(1);
  });

  // A redraw takes the stylesheet with the children it replaces, so the new
  // diagram would appear finished if the function were not applied again.
  it('animates the new diagram when the diagram changes', () => {
    const { container, rerender } = render(
      <PenSketch
        animate={stylesheet}
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    rerender(
      <PenSketch
        animate={stylesheet}
        diagram={NOTE}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);

    expect(svg.querySelectorAll('style')).toHaveLength(1);
    expect(svg.firstChild).toBe(svg.querySelector('style'));
    expect(svg.innerHTML).toContain('--ps-i:0.000;');
  });

  // T-09. The natural way to pass options is an inline arrow, which is a
  // fresh identity on every render - and this repository's own React example
  // re-renders on a 1400 ms interval, so a function in the dependency array
  // would clear the element and start the drawing again three times a second.
  it('carries on drawing when a re-render brings a fresh function', () => {
    const { container, rerender } = render(
      <PenSketch
        animate={(svg) => {
          stylesheet(svg);
        }}
        className="before"
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);
    const children = childrenOf(svg);

    rerender(
      <PenSketch
        animate={(svg) => {
          stylesheet(svg);
        }}
        className="after"
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    // The re-render happened, and every node the first drawing made is still
    // the same node: nothing was cleared and nothing was drawn again.
    expect(svg.getAttribute('class')).toBe('after');
    expect(childrenOf(svg)).toHaveLength(children.length);
    for (const [i, child] of children.entries())
      expect(svg.children[i]).toBe(child);
    expect(svg.querySelectorAll('style')).toHaveLength(1);
  });

  // The other half of the identity rule, and the half a reader is promised
  // rather than warned about: a redraw applies whatever function is current by
  // then. It holds only because the effect that latches the function is
  // declared before the effect that draws, so it runs first - and swapping the
  // two is a change that breaks this and nothing else. Both orderings mount,
  // draw, animate once and pass every other test in this file, so without this
  // the promise is published and ungated.
  it('a redraw applies the function the same commit brought, not the last one', () => {
    const applied: string[] = [];
    const naming = (name: string) => (svg: SVGSVGElement) => {
      applied.push(name);
      stylesheet(svg);
    };

    const { rerender } = render(
      <PenSketch
        animate={naming('first')}
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    // Both change in one commit, which is the case the ordering exists for.
    rerender(
      <PenSketch
        animate={naming('second')}
        diagram={NOTE}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    expect(applied).toEqual(['first', 'second']);
  });
});

describe('<PenSketch> under StrictMode', () => {
  it('renders what a plain mount renders', () => {
    const plain = render(
      <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />,
    );
    const expected = svgIn(plain.container).innerHTML;
    plain.unmount();

    const { container } = render(
      <StrictMode>
        <PenSketch diagram={FLOW} seed={7} viewBox={VIEW_BOX} />
      </StrictMode>,
    );

    expect(svgIn(container).innerHTML).toBe(expected);
    expect(svgIn(container).innerHTML).toBe(drawn(FLOW, { seed: 7 }));
  });
});
