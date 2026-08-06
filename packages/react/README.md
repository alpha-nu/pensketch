# @pensketch/react

> Hand-sketched SVG diagrams from plain data. Tiny, seeded, zero dependencies.

![A diagram drawn by pensketch](https://raw.githubusercontent.com/alpha-nu/pensketch/main/docs/assets/hero-light.png)

## Install

```sh
npm install @pensketch/react @pensketch/core
```

`react` is a peer dependency (`^18 || ^19`): the bindings draw with whichever
copy your app already has, and never bring their own. `@pensketch/core` is a
regular dependency, so it arrives either way - install it directly to import
its types, as the quickstart does.

## Quickstart

```tsx
import { PenSketch } from '@pensketch/react';
import type { Diagram } from '@pensketch/core';

const FLOW: Diagram = {
  nodes: [
    { id: 'in',   shape: 'pill',    x: 40,  y: 50, w: 160, h: 50, lines: ['request'] },
    { id: 'gate', shape: 'diamond', x: 260, y: 35, w: 150, h: 80, lines: ['allowed?'] },
    { id: 'work', shape: 'box',     x: 480, y: 50, w: 180, h: 50, lines: ['do the work'], accent: true },
  ],
  edges: [
    { from: ['in', 'r'],   to: ['gate', 'l'] },
    { from: ['gate', 'r'], to: ['work', 'l'], label: 'yes', lx: 445, ly: 60 },
    { from: ['gate', 'b'], to: ['in', 'b'], via: [[335, 135], [120, 135]],
      dotted: true, label: 'no', lx: 225, ly: 122 },
  ],
};

export function Flow() {
  return <PenSketch diagram={FLOW} seed={7} viewBox="0 0 700 150" aria-label="Request flow" />;
}
```

`<PenSketch>` renders an empty `<svg>` and fills it in an effect, so the server
sends the element and the client draws into it after hydration - no mismatch,
and no DOM touched while rendering. The drawing is cleared before each redraw,
which is also why StrictMode's double effect leaves exactly what a single one
leaves.

## `PenSketchProps`

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `diagram` | `Diagram` | required | The picture as data. Compared by identity, never by value: keep it at module scope or memoize it, or every render redraws. |
| `seed` | `number` | `1` | Seeds the drawing's PRNG. Same seed, same wobble - a seed picks a drawing rather than adding noise. |
| `theme` | `Partial<Theme>` | `defaultTheme` | The color roles to override, shallow-merged over the defaults. Compared by identity like `diagram`. |
| `viewBox` | `string` | required | pensketch places shapes in the diagram's own coordinate space; the viewBox is what maps that space onto the element. |
| ...rest | `<svg>` props | - | Everything else is spread onto the element, so `className`, `style`, `aria-label` and the rest behave as they would on a hand-written `<svg>`. Children are not accepted - the diagram owns them. |

The component forwards its ref to the underlying `SVGSVGElement`.

Colors are emitted as `var(--ps-*, fallback)` references, so a page can restyle
a diagram that is already on screen - dark mode included - just by redefining
the variables. See `@pensketch/core` for the full list.

## `useSketch`

```ts
function useSketch(
  sketch: (pen: Pen) => void,
  options?: PenOptions,
): RefObject<SVGSVGElement | null>;
```

The escape hatch: a ref to put on an `<svg>` of your own, and a callback handed
the same `Pen` the diagram renderer draws with. Reach for it when a picture is
not a diagram. The element is cleared before each run, and the callback runs
again whenever it, `options.seed` or `options.theme` changes identity.

```tsx
import { useSketch } from '@pensketch/react';
import type { Pen } from '@pensketch/core';

// Module scope: a callback that keeps its identity does not redraw.
function sketch(p: Pen) {
  p.rect(20, 20, 200, 90);
  p.label(120, 65, 'hand-drawn box');
  p.arrow([[220, 65], [320, 65]]);
  p.pill(320, 40, 150, 50);
  p.label(395, 65, ['a pill', '(two lines)']);
}

export function Sketch() {
  const ref = useSketch(sketch, { seed: 3 });
  return <svg ref={ref} viewBox="0 0 500 130" role="img" aria-label="A box and a pill" />;
}
```

Every call on the pen consumes numbers from the seeded sequence, so the order
of the calls is part of the output.

## Repository

Full documentation, the drawing model, theming and runnable examples live at
https://github.com/alpha-nu/pensketch.
