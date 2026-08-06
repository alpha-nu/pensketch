import type { Pen } from '@pensketch/core';
import { useSketch } from '@pensketch/react';

// Module scope: a callback that keeps its identity does not redraw. Declared
// inside the component it would be a new function on every render, and the
// effect keys on the callback.
function sketch(p: Pen) {
  p.rect(20, 20, 200, 90);
  p.label(120, 65, 'hand-drawn box');
  p.arrow([
    [220, 65],
    [320, 65],
  ]);
  p.pill(320, 40, 150, 50);
  p.label(395, 65, ['a pill', '(two lines)']);
}

export function CustomSketch() {
  const ref = useSketch(sketch, { seed: 3 });
  return (
    <svg
      ref={ref}
      viewBox="0 0 500 130"
      role="img"
      aria-label="A box and a pill"
    />
  );
}
