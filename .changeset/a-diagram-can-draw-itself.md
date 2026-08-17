---
'@pensketch/core': minor
'@pensketch/animation': minor
'@pensketch/react': minor
'@pensketch/mcp': minor
---

A diagram can draw itself. `draw` learns one option, and a new package turns
what that option stamps into motion.

```js
import { draw } from '@pensketch/core';
import { animate } from '@pensketch/animation';

draw(svg, diagram, { order: true });
animate(svg, { duration: 3000 });
```

**Nothing you draw today moves.** `order` defaults to false, and with it unset
not one byte of the output differs — the z-order, the seeded sequence and the
elements themselves are what they were, and every golden in this repository
regenerates clean. Minor rather than patch because the option exists and the
output changes when it is set, not because anything changed for a caller who
leaves it alone.

With `order: true` every element carries `--ps-i`: how far through the drawing
it is, as a fraction in `[0, 1)`. The number counts in the order a hand would
draw in — group frames, then node shapes, then connectors, then braces, notes
and `raw`, and then every piece of text whatever phase drew it — which is
**not** the order the document is in. Nothing is reordered to achieve that; the
index is written onto the elements where they already stand. Every path
carrying no `stroke-dasharray` also gains `pathLength="1"`, which normalises it
so one keyframe draws a 400 px connector and a 12 px arrowhead barb at the same
rate. A dashed path is deliberately left alone: `pathLength` rescales every
distance along a path, `stroke-dasharray` among them, so a normalised dotted
line would render solid.

## `@pensketch/animation`, at its first published version

That number read back, and nothing else: one frozen stylesheet, 663 B minified
and gzipped, inserted as the `<svg>`'s own first child. It is CSS — nothing of
it runs while the drawing is drawing. `animate` takes an element;
`animateMarkup` takes the contents `renderToString` hands back. `duration`
(2000 ms), `stroke` (500 ms, any one element) and `easing` (`ease-out`) are the
whole of the surface, and anything left out keeps the stylesheet's own default,
so the defaults have exactly one home. Nothing else is added to your element:
no class, no id.

Call it **after** `draw`, never before. `draw` removes every child of the
element it fills, so a `<style>` put there first goes with them and the diagram
simply appears — and a redraw takes the stylesheet with it and has to be
animated again.

## How it degrades, and it is one way

The rules sit in an implicit `@scope` block, so they reach only the drawing
they were put in. Three separate things switch them off:

- an engine that does not understand `@scope` — Chrome before 118, Safari
  before 17.4, Firefox before 146, and Firefox ESR 140, which understands it
  but ships it disabled by pref — drops the block whole;
- an element carrying no `--ps-i` — an older core, a `pen` drawing, a caller
  who did not pass `order` — makes the `animation` shorthand invalid at
  computed-value time, so `animation-name` computes to `none`;
- `prefers-reduced-motion: reduce` turns it off outright.

All three land in the same place on purpose: the diagram renders **finished and
still**, pixel-identical to the same diagram with no stylesheet at all — never
blank, never half-inked. Measured in Chrome against a control of 401 inked
pixels, every one of those paths renders 401: the drawing the pen laid down,
dashes and all. What makes that true is that no property which hides a stroke
is set outside the keyframes — an earlier design that declared the starting
state statically measured 0 on the same input, a blank frame, and 200 under
version skew, a frozen dotted ghost.

`@pensketch/core` is a peer, floored at the minor that ships `order`. A range
open across all of `0.x` would admit a core that stamps no index, and this
package cannot detect that at runtime — the diagram would render finished and
still, with nothing to say why.

## `@pensketch/react`: one prop

```tsx
import { animate } from '@pensketch/animation';

<PenSketch diagram={FLOW} viewBox="0 0 700 150" animate={animate} />
```

The prop takes the **function**, not a boolean, so this package declares no
dependency on `@pensketch/animation` and names it nowhere — a page that does
not want motion carries none of it. It is held in a ref and read when the
drawing runs, so unlike `diagram`, `seed` and `theme`, changing its identity
does not re-animate: the natural way to pass options is an inline arrow,
`animate={svg => animate(svg, { duration: 3000 })}`, and a prop that redrew on
identity would restart the drawing from blank on every parent render.

## `@pensketch/mcp`: one tool parameter

`render_diagram` gains `animate`, default false. What comes back is a
self-contained `<svg>` that draws itself inline in a page, embedded as an
`<img src>`, or opened as a file, with nothing else fetched and no CSS to
write.

`render_png` does not take it, and the absence is a refusal rather than an
omission: a still frame of an animation is just the finished picture, so a
caller who asks for `animate: true` there is told `render_png has no argument
"animate"` — which is more use than a field accepted and quietly ignored.
