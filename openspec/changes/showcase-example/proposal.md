# Proposal: showcase-example

> A fifth example: pensketch's own architecture, drawn by pensketch, reaching
> for nearly the whole data model in one picture and reaching for `raw` in none
> of it.

## Why

**The four examples each demonstrate one thing well, and nothing demonstrates
the model whole.** `vanilla/` is a pipeline, `custom-pen/` is `pen()` on its
own, `state-machine/` is a branch and a bowed pair, `react/` is a diagram
computed from state. A caller wanting to see what a rich diagram looks like —
groups and all three shapes and every kind of connector and both braces
together — has to read four folders and assemble it themselves.

**Two features have no example that shows what they are for.** `hatch` appears
on pills in `custom-pen/` and on boxes in `react/`, and nowhere on a diamond,
which is the shape the 0.3.0 contour clip exists for. Orthogonal `via` routing
appears once, as a path back to the start, and never as the notation it
actually is.

**The architecture is worth a picture on its own.** Three consumers, one
package with four entry points, a renderer and a checker that stand on the same
geometry — that is the thing this repository has spent four releases arranging,
and it is not written down anywhere as a picture. The `documentation-and-examples`
requirement says an example must be "a picture worth looking at that happens to
use the feature, never a feature demonstration with a diagram wrapped around
it", and this is the strongest answer to that bar the project has: the diagram
is true about the software drawing it.

## What changes

- **`examples/showcase/`**, a vanilla HTML page under the same A4 theming as
  `vanilla/`, drawing this project's logical architecture in layered notation:
  four groups, thirteen components, fifteen connectors, two braces, two notes.
  Connectors leaving one node are drawn alike, and where a straight run clipped
  a corner the fix was a different anchor rather than a `bow` on one line of a
  set — a rule the requirement now carries, since an anchor is free and a `bow`
  is a claim about the relationship.
- **No `raw`.** Everything it draws is expressible as data, which is what lets
  it be served whole as `pensketch://example/showcase` rather than served with
  a hole and a note explaining the hole. `custom-pen/` remains the folder for
  what the data model has no word for.
- **The notation is stated in the file.** `hatch` and `dotted` carry no meaning
  from the renderer, so the page says what they mean here — hatched is "runs
  with no DOM", dotted is "no code crosses this arrow" — rather than teaching a
  convention that does not exist.
- **Wiring**: `tools/shipped-diagrams.mjs` loads it, so `npm run diagrams`
  checks it; `tools/generate-resources.mjs` serves it; the README's example
  table names it; and the three places that pin the resource count move with
  it.

## Impact

- **Affected specs**: `documentation-and-examples`
- **Affected code**: `examples/showcase/index.html` (new),
  `tools/{shipped-diagrams,generate-resources,check-stdio}.mjs`, `README.md`,
  `packages/mcp/test/{protocol,resources}.test.ts`, and
  `packages/mcp/src/resources.generated.ts` by regeneration.
- **No package source changes**, so no byte of any published entry moves and no
  golden shifts. `@pensketch/mcp` serves one more resource, which is a change
  to what it publishes and carries a changeset.
