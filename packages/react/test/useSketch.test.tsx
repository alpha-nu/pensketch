import type { Pen, PenOptions } from '@pensketch/core';
import { render } from '@testing-library/react';
import { type RefObject, StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { useSketch } from '../src/index';
import { childrenOf, sketched, svgIn } from './helpers';

// Module-level, so their identity is stable across renders: a callback
// declared inside a component is a different callback every render, and every
// render would redraw.
const BOX = (pen: Pen) => {
  pen.rect(20, 20, 200, 90);
  pen.label(120, 65, 'hand-drawn box');
};

const PILL = (pen: Pen) => {
  pen.pill(20, 20, 150, 50);
};

const VIEW_BOX = '0 0 240 130';

function Sketch({
  sketch = BOX,
  options,
}: {
  sketch?: (pen: Pen) => void;
  options?: PenOptions;
}) {
  const ref = useSketch(sketch, options);
  return <svg ref={ref} viewBox={VIEW_BOX} />;
}

describe('useSketch', () => {
  it('hands the callback a pen whose strokes land in the svg', () => {
    const { container } = render(<Sketch />);
    const svg = svgIn(container);

    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg.querySelector('text')?.textContent).toBe('hand-drawn box');
    expect(svg.innerHTML).toBe(sketched(BOX));
  });

  it('returns a ref that reaches the element it drew into', () => {
    let ref: RefObject<SVGSVGElement | null> | undefined;
    function Probe() {
      ref = useSketch(BOX);
      return <svg ref={ref} viewBox={VIEW_BOX} />;
    }

    const { container } = render(<Probe />);

    expect(ref?.current).toBe(svgIn(container));
  });

  it('builds the pen with the given seed and theme', () => {
    const options: PenOptions = { seed: 3, theme: { ink: 'hotpink' } };
    const { container } = render(<Sketch options={options} />);
    const svg = svgIn(container);

    expect(svg.innerHTML).toBe(sketched(BOX, options));
    expect(svg.innerHTML).toContain('hotpink');
    expect(svg.innerHTML).not.toBe(sketched(BOX));
  });

  it('clears and redraws when the callback changes', () => {
    const { container, rerender } = render(<Sketch sketch={BOX} />);
    const svg = svgIn(container);

    rerender(<Sketch sketch={PILL} />);

    expect(svg.innerHTML).toBe(sketched(PILL));
    expect(svg.querySelector('text')).toBeNull();
  });

  it('redraws when the seed changes', () => {
    const { container, rerender } = render(<Sketch options={{ seed: 3 }} />);
    const svg = svgIn(container);

    rerender(<Sketch options={{ seed: 4 }} />);

    expect(svg.innerHTML).toBe(sketched(BOX, { seed: 4 }));
  });

  it('redraws when the theme changes identity', () => {
    const { container, rerender } = render(
      <Sketch options={{ seed: 3, theme: { ink: 'hotpink' } }} />,
    );
    const svg = svgIn(container);

    rerender(<Sketch options={{ seed: 3, theme: { ink: 'rebeccapurple' } }} />);

    expect(svg.innerHTML).toBe(
      sketched(BOX, { seed: 3, theme: { ink: 'rebeccapurple' } }),
    );
    expect(svg.innerHTML).toContain('rebeccapurple');
  });

  // The effect keys on the option values, not on the options object, so the
  // usual inline literal does not redraw on every render.
  it('does not redraw for an equal options object of a new identity', () => {
    const { container, rerender } = render(<Sketch options={{ seed: 3 }} />);
    const svg = svgIn(container);
    const children = childrenOf(svg);

    rerender(<Sketch options={{ seed: 3 }} />);

    expect(childrenOf(svg)).toHaveLength(children.length);
    for (const [i, child] of children.entries())
      expect(svg.children[i]).toBe(child);
  });

  it('draws nothing, and throws nothing, while the ref is unattached', () => {
    function Detached() {
      useSketch(BOX);
      return <div />;
    }

    const { container } = render(<Detached />);

    expect(container.innerHTML).toBe('<div></div>');
  });

  it('renders under StrictMode what a plain mount renders', () => {
    const plain = render(<Sketch />);
    const expected = svgIn(plain.container).innerHTML;
    plain.unmount();

    const { container } = render(
      <StrictMode>
        <Sketch />
      </StrictMode>,
    );

    expect(svgIn(container).innerHTML).toBe(expected);
    expect(svgIn(container).innerHTML).toBe(sketched(BOX));
  });
});
