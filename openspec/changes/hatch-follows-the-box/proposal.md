# Proposal: hatch-follows-the-box

> `hatch` shades the node's *box*. On a box that is the shape. On a pill it
> overshoots the ellipse by up to 15 px — a third of the height — on the two
> pills this repository ships. On a diamond it fills all four corners the
> shape has not got.

## Why

**The prose says it; nothing normative does.** The release being cut corrects
the `hatch` JSDoc, the README field table and `docs/agents.md` to describe the
box rather than "the interior", and `examples/react/src/incident.ts` codes
around it (`shape === 'box' && i < stage`). So a reader is told. But
`openspec/specs/core-renderer/spec.md:58` still says only "11 px-spaced
clipped hatching", which does not say clipped to what — and a sentence in a
README is not what this repository holds itself to. Four documents describing
a behaviour no requirement states is exactly the drift this project polices.

**Only the box is tested.** `pen.test.ts:557` pins the scanline count and both
clipped endpoints of every hatch line, and `draw.test.ts:1051` pins a hatched
box's ink inside its inset box. Both are boxes; the parity goldens hatch only
boxes; `check` has no rule comparing ink to an outline. Nothing anywhere would
notice a pill or a diamond changing, in either direction.

**The pill is worse than it looks, and it ships.** `examples/custom-pen/`
hatches `delivered` and `cancelled` as its terminal states, and that diagram is
served to agents as `pensketch://example/lifecycle`. Measured on the shapes as
drawn: 82 of 340 sampled ink points lie outside the 150 × 50 ellipse, the worst
15.5 px past it — 31% of the shape's height. That is not the rounding-error
overshoot the word "tolerable" suggests, and the owner's decision about that
example should be taken against the number.

**The alternative was unmeasured.** It is now: about 25 lines of scanline
clip, working on both shapes, costing **+250 B min+gzip on
`@pensketch/core/server`, which has 129 B free**. design.md D2 has the
variants, the numbers, and the reason a contour algorithm can never replace
the box path outright.

## What changes

Nothing in the renderer, and no byte moves. This change:

- states the clip in a requirement, per shape, so it cannot drift silently;
- adds the two tests that do not exist — a hatched pill and a hatched diamond,
  pinning where the ink goes *outside* the outline, so that a later change to
  the clip fails a test naming what it changed;
- gives `docs/agents.md`'s numbered trap list an entry, since it is the
  document for callers who cannot see the result and this is a defect only
  looking finds;
- records the measured cost of the contour hatch and the budget it exceeds.

**Left open, deliberately.** Whether to ship the contour hatch, and whether to
raise `./server` to hold it, is the owner's call. So is what
`examples/custom-pen/` does about its hatched pills now that the overshoot has
a number on it. design.md D3 lays out three ways forward and picks none.

## Impact

- **Affected specs**: `core-renderer`
- **Affected code**: `packages/core/test/{pen,draw}.test.ts`, `docs/agents.md`
  — which `tools/generate-resources.mjs` embeds verbatim as the MCP `SPEC`
  resource, so `packages/mcp/src/resources.generated.ts` regenerates with it.
  No renderer change, no size change, no golden moves.
