import { render } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { PenSketch } from '../src/index';
import { FLOW, NOTE, VIEW_BOX } from './fixtures';
import { childrenOf, drawn, svgIn } from './helpers';

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

  // The three props the component consumes are its own; leaking them onto the
  // element would put `diagram="[object Object]"` in the markup.
  it('keeps its own props off the element', () => {
    const { container } = render(
      <PenSketch
        diagram={FLOW}
        seed={7}
        theme={{ ink: 'hotpink' }}
        viewBox={VIEW_BOX}
      />,
    );
    const svg = svgIn(container);

    for (const name of ['diagram', 'seed', 'theme'])
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
