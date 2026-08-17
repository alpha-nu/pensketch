# @pensketch/react

> Hand-sketched SVG diagrams from plain data, for React. Tiny, seeded, and
> nothing in your tree but pensketch itself.

![A diagram drawn by pensketch](https://raw.githubusercontent.com/alpha-nu/pensketch/main/docs/assets/hero-light.png)

## Install

```sh
npm install @pensketch/react @pensketch/core
```

Both `react` (`^18 || ^19`) and `@pensketch/core` are peer dependencies: the
bindings draw with whichever copies your app already has, and never bring
their own. That matters for core in particular - two copies in one tree would
be two renderers, and the same diagram at the same seed would come out
differently through this component than through a direct `draw()` call.

There are two peers and not three. `@pensketch/animation` is not among them,
nor a dependency, nor an optional peer: the `animate` prop takes the function
itself, so a consumer who wants motion installs the package and passes it, and
everyone else carries nothing. Core's argument does not carry over. Core is a
peer because these bindings *call* it on every draw, and two resolved copies
would render one seed two ways; the motion arrives from a caller who has
already imported it, and its rules are a constant, so two copies of it cannot
disagree. What a peer would buy is one import line the consumer no longer
writes, against every consumer of these bindings carrying an animation package
they may never use.

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
| `animate` | `(svg: SVGSVGElement) => void` | - | Makes the diagram draw itself. Pass `animate` from `@pensketch/animation`; the drawing is stamped with the renderer's `order` whenever this is present, and the function is applied to the element after `draw` has filled it. Held in a ref, so changing its identity does not re-animate - see below. |
| `diagram` | `Diagram` | required | The picture as data. Compared by identity, never by value: keep it at module scope or memoize it, or every render redraws. |
| `seed` | `number` | `1` | Seeds the drawing's PRNG. Same seed, same wobble - a seed picks a drawing rather than adding noise. |
| `theme` | `Partial<Theme>` | `defaultTheme` | The color roles to override, shallow-merged over the defaults. Compared by identity like `diagram`. |
| `viewBox` | `string` | required | pensketch places shapes in the diagram's own coordinate space; the viewBox is what maps that space onto the element. |
| ...rest | `<svg>` props | - | Everything else is spread onto the element, so `className`, `style`, `aria-label` and the rest behave as they would on a hand-written `<svg>`. Children are not accepted - the diagram owns them. |

The component forwards its ref to the underlying `SVGSVGElement`.

Colors are emitted as `var(--ps-*, fallback)` references, so a page can restyle
a diagram that is already on screen - dark mode included - just by redefining
the variables. See `@pensketch/core` for the full list.

### Making it draw itself

```tsx
import { animate } from '@pensketch/animation';

<PenSketch diagram={FLOW} viewBox="0 0 700 150" animate={animate} />
```

The function is applied inside the same effect that draws, after `draw` has
filled the element - which is also what makes a redraw re-animate, since `draw`
empties the element and the old stylesheet goes with the old children.

It is held in a ref and kept out of that effect's dependencies, so **changing
its identity does not re-animate**. That is what makes the natural spelling of
options safe: `animate={svg => animate(svg, { duration: 3000 })}` is a fresh
function on every render, and a prop compared by identity would clear the
element and start the drawing over each time the parent re-rendered. A redraw
`diagram`, `seed` or `theme` does cause applies whatever function is current by
then.

The function runs inside a synchronous effect and is expected to be
synchronous. On an engine that does not understand `@scope` the diagram renders
finished and static rather than blank.

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
