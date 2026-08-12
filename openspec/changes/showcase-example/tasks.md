# Tasks: showcase-example

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

No package source changes, so no rendered byte of any existing diagram moves
and no golden shifts. What does change is what `@pensketch/mcp` publishes: one
more resource.

## 1. The diagram

- [x] 1.1 `examples/showcase/index.html` — this project's logical architecture
      in layered notation, under the same A4 theming as `vanilla/` and
      importing the built core dist relatively, as that folder does

      Drawn through the MCP server rather than by reading the source: the
      diagram was built against `pensketch://spec`, checked with
      `check_diagram` after every move, and rendered with `render_png` and
      looked at. Six rounds, and `check` was clean from the first — every
      defect that mattered was one no rule can see
- [x] 1.2 Breadth without `raw`: four groups, box, pill and diamond, `accent`,
      `hatch` on two different outlines, straight connectors, orthogonal
      `via`, a self-transition sized for a 220px side, both kinds of brace,
      notes whose pointers bow, and all three label anchors. `raw` would make
      it unservable as data, and `custom-pen/` is the folder for what the data
      model has no word for
- [x] 1.4 **Owner review, applied.** The three connectors leaving `pen` were
      two straight and one bowed — the bow having been the first fix for the
      last of them clipping a corner by a pixel and a half. Three arrows out of
      one node reading as two kinds of relationship is worse than the clip.
      Aiming at the top anchor instead of the left misses the corner outright,
      so all three are straight and the fan is symmetric: -260, 0, +260 across,
      58 down. The requirement gains the general form — an anchor is free and a
      `bow` is a claim — because this will come up again
- [x] 1.3 The page states what its own `hatch` and `dotted` mean. The renderer
      attaches no meaning to either, so a diagram using both without saying so
      teaches a convention that does not exist

## 2. The wiring, so it reaches every gate the others do

- [x] 2.1 `tools/shipped-diagrams.mjs` loads it, so `npm run diagrams` checks
      it — 10 diagrams, 0 errors, 0 warnings
- [x] 2.2 `tools/generate-resources.mjs` serves it as
      `pensketch://example/showcase`, with a title
- [x] 2.3 The three places that pin the resource count or list move with it:
      `packages/mcp/test/protocol.test.ts`, `packages/mcp/test/resources.test.ts`
      — both the surface list and `EXAMPLE_KEYS`, which is the list the comment
      beside it says exists so a served example cannot be covered by nothing —
      and `tools/check-stdio.mjs`
- [x] 2.4 The README's example table names it
- [x] 2.5 The `documentation-and-examples` delta, restated in full with all
      five of its scenarios carried and one added

## 3. Left for the owner

- [ ] 3.1 **OWNER**: look at it. `check` is silent about everything that
      actually went wrong across six rounds — a connector through a group
      title, a red dotted run and a black one sharing a `y` so they read as one
      line changing style, a label sitting on a group border, a loop cramped
      inside a pill's curve. None of those are rules. The render is in the
      conversation that produced it; the page itself is the artefact
- [ ] 3.2 **OWNER**: a changeset. `@pensketch/mcp` serves a resource it did not
      before, which is user-visible and additive — a **minor** under the rule
      that a minor may add API. `@pensketch/core` is untouched
