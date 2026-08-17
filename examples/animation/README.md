# A diagram that draws itself

Photosynthesis in five panels, each one revealed stroke by stroke.

```
npm run build          # from the repository root
npx serve .            # -> http://localhost:3000/examples/animation/
```

Double-clicking will not work, for the reason [examples/vanilla](../vanilla/)
gives: a `file://` document has the opaque origin `"null"`, and ES module
scripts are fetched with CORS.

## What it demonstrates

Nothing here is a picture. Each panel is a plain object — boxes with
coordinates, edges naming the sides they attach to — and `draw` renders it in
the browser. The figures under each panel are measured from what was actually
drawn, so they cannot go stale.

The panels were composed against `@pensketch/mcp`, the same server an agent
calls; `check_diagram` passed all five with no findings, and `npm run diagrams`
holds them to the same rules on every push.

## The animation

Two calls, in this order, and no CSS of this page's own:

```js
draw(svg, panel.diagram, { seed: SEED, label: panel.title, order: true });
animate(svg, { duration: DURATION });
```

`order: true` asks the renderer to stamp every element with `--ps-i`, how far
through the drawing it is. That number is the one thing only `draw` can know:
the order a hand would lay a picture down in is the order it just drew in, and
it is not the order the document ends up in — a page holding a finished `<svg>`
sees a list of anonymous `<path>` elements with every connector before the
boxes it connects.

[`@pensketch/animation`](../../packages/animation/) is the second call. It puts
a `<style>` inside the `<svg>`, scoped to that drawing, and the stagger is a
delay computed from `--ps-i`. A solid stroke is dashed with a single dash exactly
as long as itself and slid home, which `pathLength="1"` makes one keyframe
enough for; a dotted one fades in on `stroke-opacity` instead, because
`pathLength` rescales `stroke-dasharray` along with everything else and the
dots would render as a solid line.

**`animate` goes after `draw`, never before.** `draw` empties the element it
fills, so a stylesheet put there first goes with everything else that was in
it — and for the same reason a redraw takes the last stylesheet with it and has
to be animated again. That is what the *Draw it again* button under each panel
does, and what the page does when a panel scrolls into view.

## What this page does not do

It stamps no `pathLength`, writes no index, and declares no keyframes. An
example that hand-rolled any of that would teach the recipe the package exists
to delete, and would keep working after the package had regressed — which is
the opposite of what a shipped example is for.
