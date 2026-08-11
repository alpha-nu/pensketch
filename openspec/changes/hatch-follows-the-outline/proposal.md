# Proposal: hatch-follows-the-outline

> `hatch` shaded the node's *box*. On a box that is the shape. On a pill it
> overshot the ellipse by up to 15 px — a third of the height — on the two
> pills this repository ships. On a diamond it filled all four corners the
> shape has not got. It now follows the outline instead.

## Why

**The prose said it; nothing normative did.** The 0.2.0 release corrected the
`hatch` JSDoc, the README field table and `docs/agents.md` to describe the box
rather than "the interior", and `examples/react/src/incident.ts` coded around
it with a `shape === 'box'` guard. So a reader was told. But
`openspec/specs/core-renderer/spec.md:72` said only "11 px-spaced clipped
hatching", which does not say clipped to what — and a sentence in a README is
not what this repository holds itself to. Four documents describing a behaviour
no requirement states is exactly the drift this project polices.

**Only the box was tested.** `pen.test.ts:557` pins the scanline count and both
clipped endpoints of every hatch line, and `draw.test.ts:1051` pins a hatched
box's ink inside its inset box. Both are boxes; the parity goldens hatch only
boxes; `check` has no rule comparing ink to an outline. Nothing anywhere would
have noticed a pill or a diamond changing, in either direction.

**The pill is worse than it looks, and it ships.** `examples/custom-pen/`
hatches `delivered` and `cancelled` as its terminal states, and that diagram is
served to agents as `pensketch://example/lifecycle`. Measured on the shapes as
drawn: 82 of 340 sampled ink points lay outside the 150 × 50 ellipse, the worst
15.5 px past it — 31% of the shape's height. That is not the rounding-error
overshoot the word "tolerable" suggests.

**The alternative was measured before it was chosen.** design.md D2 prototyped
a scanline clip, priced it at +250 B min+gzip on `@pensketch/core/server` —
which had 129 B free — and D4 recorded the prototype itself so the number could
be reproduced rather than believed. The owner took the decision against those
numbers: ship it, and make it more robust than the prototype on the way.

## What changes

- **The renderer.** `hatch` takes an optional clip polygon and cuts each 45°
  line to it by scanline. `draw` passes one for every shape whose outline is
  not its box. The box keeps the closed form the reference uses, so no golden
  moves and parity holds.
- **Three improvements on the prototype**, each measured rather than assumed:
  the crossing rule handles a vertex a line only touches, which the prototype
  got wrong by 20.2 px on a notched clip; the clip stands `HATCH_INSET` inside
  the outline perpendicular to it rather than inscribed in an inset box, which
  takes a diamond's worst clearance from 0.00 px to 3.21; and the clip is
  points rather than a shape name, so `raw` can shade inside what it traced
  without a new `Pen` member.
- **One improvement declined, with the evidence.** No minimum span length:
  sub-3 px spans are not new, the box arm drawing one at every one of 5566
  sizes swept, because the reference's first scanline is degenerate by
  construction.
- **The requirement, per shape**, so it cannot drift silently again, and the
  tests for the two shapes nothing tested — now pinning the fix rather than the
  wart.
- **The budget**, raised first and alone: `@pensketch/core/server` 3648 → 3872.

## Impact

- **Affected specs**: `core-renderer`, `repo-tooling`
- **Affected code**: `packages/core/src/{pen,sample,draw,types}.ts`,
  `packages/core/test/{pen,draw}.test.ts`, `tools/check-size.mjs`, the README
  field and primitive tables, `docs/agents.md` — which
  `tools/generate-resources.mjs` embeds verbatim as the MCP `SPEC` resource —
  and `examples/react/src/incident.ts`, which drops the guard that existed only
  to keep the diamond out of this.
- **Rendered output changes** for a hatched pill or diamond, which is the fix.
  A hatched box is byte-identical, and no golden moved.
