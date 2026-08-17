# @pensketch/animation

> CSS that draws a pensketch diagram in the order a hand would have drawn it.
> Nothing of it runs while the drawing is drawing.

![A diagram drawn by pensketch](https://raw.githubusercontent.com/alpha-nu/pensketch/main/docs/assets/hero-light.png)

## Install

```sh
npm install @pensketch/animation @pensketch/core
```

`@pensketch/core` is a peer dependency, floored at the minor that ships
`order`. That floor is not decoration: a range open across all of `0.x` would
admit a core that stamps no index at all, and this package cannot detect that
at runtime — the diagram would simply render finished and still, with nothing
to say why.

It is a peer of nothing else. `@pensketch/react` does not depend on this
package at all — it takes the function itself through a prop — so a consumer
who wants motion installs it and everyone else carries none of it.
`@pensketch/mcp` does depend on it, as an ordinary dependency: it is a server
you spawn rather than code that ships inside a page.

## Quickstart

```js
import { draw } from '@pensketch/core';
import { animate } from '@pensketch/animation';

const svg = document.querySelector('svg');
draw(svg, diagram, { order: true });
animate(svg, { duration: 3000 });
```

Two calls, and the split between them is the whole design. `order: true` is the
renderer's part: it stamps every element with `--ps-i`, how far through the
drawing it is, as a fraction in `[0, 1)`. That number is the one thing only
`draw` can know — the order a hand would lay a picture down in is the order it
just drew in, and it is not the order the document ends up in. A page holding a
finished `<svg>` sees a list of anonymous `<path>` elements with every connector
before the boxes it connects.

This package is the other part: it decides how long that takes and what it
looks like, and it decides nothing else.

**Call `animate` after `draw`, never before.** `draw` removes every child of the
element it fills, so a `<style>` put there first goes with them and the diagram
simply appears. For the same reason a redraw takes the stylesheet with it and
has to be animated again — which is what makes a stepping diagram draw itself
on every step rather than once.

## `AnimateOptions`

| Option | Type | Default | Meaning |
|---|---|---|---|
| `duration` | `number` | `2000` | How long the whole drawing takes, first stroke to last, in ms. |
| `stroke` | `number` | `500` | How long any one element takes to appear, in ms. |
| `easing` | `string` | `ease-out` | The easing every element is given, as a CSS `<easing-function>`. |

Anything left out keeps the stylesheet's own default, so the defaults have
exactly one home. The rules themselves are a constant — identical bytes for
every diagram — and what differs between two of them rides on custom properties
set on each `<svg>`, so two diagrams on one page cannot reach each other's
timing.

`animate` adds nothing to your element but the `<style>` and those properties:
no class, no id. The element is yours. What comes back is self-contained — it
draws itself inline in a page, embedded as `<img src>`, and opened as a file,
with nothing else loaded.

## In React

The bindings take the function itself:

```tsx
import { animate } from '@pensketch/animation';

<PenSketch diagram={FLOW} viewBox="0 0 700 150" animate={animate} />
```

It is applied inside the same effect that draws, after `draw` has filled the
element. See [`@pensketch/react`](https://www.npmjs.com/package/@pensketch/react)
for why it is held in a ref and what that means for passing options.

## Without a DOM

For a caller holding markup rather than an element — a build step, a server,
`renderToString`:

```js
import { renderToString } from '@pensketch/core/server';
import { animateMarkup } from '@pensketch/animation';

const inner = animateMarkup(renderToString(diagram, { order: true }), {
  duration: 3000,
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">${inner}</svg>`;
```

It takes and returns the **contents** of an `<svg>`, which is what
`renderToString` hands back and what the caller wraps themselves. Nothing here
looks for an `<svg>` tag: passing one whole would put the `<style>` outside it,
where its scope is the document rather than the drawing.

The rules are also exported on their own, as `rules`, for a caller assembling
the `<style>` element themselves.

## How it degrades, and it is one way

The rules are wrapped in an implicit `@scope` block, which binds to the
stylesheet's own parent — the drawing it was put in. A `<style>` inside an
inline `<svg>` is otherwise document-wide.

There are three ways the motion can fail to run, and all three land in the same
place on purpose:

- an engine that does not understand `@scope` drops the block whole;
- an element carrying no `--ps-i` — an older core, a `pen` drawing, a caller who
  did not pass `order` — makes the `animation` shorthand invalid at
  computed-value time, so `animation-name` computes to `none`;
- `prefers-reduced-motion: reduce` switches it off outright, and that one
  declaration is the whole of the accommodation.

In each case the diagram renders **finished and still** — pixel-identical to
the same diagram with no stylesheet at all, the pen's two-pass weighting and
every dash pattern intact. Never blank, never half-inked. That holds because
every property that hides a stroke lives inside a keyframe, and for no other
reason.

## Two kinds of stroke

A solid stroke is revealed by dashing it with a single dash exactly as long as
itself and sliding the offset home. `pathLength="1"`, which the renderer stamps
for exactly this, is what makes "as long as itself" the literal number 1 — so
one set of keyframes draws a 400 px connector and a 12 px arrowhead barb at the
same rate instead of the barb flashing past in three percent of the time.

A **dashed** stroke is not revealed that way. Its dashes are the drawing, and
`pathLength` rescales every distance along a path, `stroke-dasharray` among
them, so a `2 7` pattern measured against a total length of one renders as a
solid line. The renderer withholds `pathLength` from a dashed path and this
package fades it in on `stroke-opacity` instead — never `opacity`, which would
beat the pen's own `opacity` attribute and flatten the lighter of its two
passes, the thing that reads as pressure.

## Repository

Full documentation, the drawing model, theming and runnable examples live at
https://github.com/alpha-nu/pensketch — including
[examples/animation/](https://github.com/alpha-nu/pensketch/tree/main/examples/animation),
five panels of one explanation, each drawing itself.
