import type { Pen } from '@pensketch/core';
import { useSketch } from '@pensketch/react';

const PEN = 'var(--ps-pen, #2B5B8A)';
const MUTED = 'var(--ps-muted, #5A6572)';

// Module scope: a callback that keeps its identity does not redraw. Declared
// inside the component it would be a new function on every render, and the
// effect keys on the callback.
//
// `useSketch` is the other half of the bindings - no diagram in front of it,
// just the pen, for the parts of a page that are drawn rather than described.
function sketch(p: Pen) {
  p.stroke(
    [
      [20, 24],
      [470, 27],
    ],
    { color: PEN, width: 1.2, amplitude: 1.6 },
  );
  p.label(
    20,
    54,
    [
      'the stage changes the data;',
      'the seed picks which drawing of it you get',
    ],
    { size: 13, anchor: 'start', color: MUTED },
  );
}

export function Caption() {
  const ref = useSketch(sketch, { seed: 3 });
  return (
    <svg
      ref={ref}
      viewBox="0 0 500 90"
      role="img"
      aria-label="A hand-drawn caption"
    />
  );
}
