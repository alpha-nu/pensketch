# Tasks: connectors-hop-at-a-crossing

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

The default is `false` at both levels, so no shipped diagram moves until group
4 deliberately moves one. Any golden shifting before then is a defect, not a
consequence.

## 1. The budget, before the code that needs it

- [x] 1.1 Prototype the detection pass and the splice far enough to measure
      what they cost min+gzip on `./core` (1370 B of headroom, 3750/5120) and
      on `./server` (**99 B**, 3773/3872, and it carries `draw`). Record both
      figures in the commit message — a prototype that is reverted without its
      measurement written down turns a fact into a claim nobody can check

      Measured, built rather than estimated, and reverted:
      `./core` 3750 → **4122** (+372), `./server` 3773 → **4134** (+361),
      `./check` 3008 → **3006** (−2, gzip noise on code it never reaches),
      `./react` unchanged. Proved live before the numbers were trusted: hops
      changed the rendered output, and `hop: false` on one edge of a crossing
      moved the arc onto the other rather than removing it
- [x] 1.2 Move whichever budgets the measurement says must move, in their own
      commit, with the arithmetic stated: measured figure plus the gzip
      headroom the existing entries are given. `repo-tooling` names 5120, 3072,
      3872 and 2048 literally, so its requirement is restated with the new
      number in the same commit. A budget corrected after the fact records only
      that something grew

      Only `./server` moves: 4134 + 100 = 4234, taken up to **4240**. `./core`
      lands at 4122 against 5120 and needs nothing. `CONTRIBUTING.md` quotes
      the figure too, so it moves in the same commit

## 2. The data model and the geometry

- [ ] 2.1 Calibrate `HOP_OUT` and `HOP_SPAN` **against both bounds** before
      either is written down: too small and it is lost in `AMP` (2.6, so ±1.3 px
      of wander on a band of two-pass ink at `WIDTH` 1.6); too large and it
      swallows a chord of `SEG_LEN` 26 or reads as a bulge. Measured on a
      render, at more than one line angle, on a solid edge and a dotted one.
      The figures go in the commit message
- [ ] 2.2 `hop?: boolean` on `DiagramEdge` and `hops?: boolean` on
      `DrawOptions`, resolved `edge.hop ?? options.hops ?? false` — `??` and not
      `||`, so `hop: false` is an opt-out and not an absence
- [ ] 2.3 Detection in `draw`: a plain `O(S²)` double loop over every edge
      path's segments, strict interior intersection (`u` and `v` both in
      `(0, 1)`), parallel pairs skipped. No spatial index and no sweep line —
      measured at 0.0017 ms on this repository's largest diagram, 0.10% of the
      render it already pays for
- [ ] 2.4 Where both edges of a crossing resolve to hopping, the later index in
      `edges` goes over
- [ ] 2.5 The splice: walk `HOP_SPAN / 2` either side of the crossing and
      replace the points between with `bowPoints(p0, p1, HOP_OUT)`, positive to
      the right of travel — the sign convention `bow` and `depth` already carry
- [ ] 2.6 A hop whose span reaches within `HEAD_LEN` (10) of the final point is
      dropped, so `arrow()` never takes its head angle from spliced points. The
      field applies to the edge and does not apply at that spot, so it is
      ignored rather than refused
- [ ] 2.7 Tests: the fan-out at one anchor grows no divots; a collinear pair
      grows none; `hop: false` beats `hops: true`; the later index wins a
      contested crossing; a hop under an arrowhead is dropped; and the default
      renders byte-identical to before this change. The last one is the golden
      the rest of the change rests on
- [ ] 2.8 Mutation-check the detection test: gut the strict-interior condition
      and confirm the fan-out test fails. A test that stays green with the
      primitive removed is not evidence

## 3. The surface a caller and an agent see

- [ ] 3.1 `packages/core/schema/diagram.schema.json` and
      `packages/mcp/src/resources.generated.ts` regenerate from the JSDoc, so
      the JSDoc is the thing that gets written carefully
- [ ] 3.2 `docs/agents.md`: the edge field table, the constants table
      (`HOP_OUT`, `HOP_SPAN`), and whichever worked example is closest
- [ ] 3.3 `README.md`: the edge field row, the draw-options row, and the size
      claim if 1.2 moved it
- [ ] 3.4 `render_diagram` and `render_png` accept `hops` beside `seed`, so an
      agent can ask for the diagram-wide default without setting `hop` on every
      edge it writes. An argument beside the diagram, not a key inside it, so
      the strict top-level-key rule is untouched
- [ ] 3.5 `check_diagram` does **not** accept it, and its existing strict-key
      handling refuses it by name. `check` walks the un-hopped path, so the
      argument would change no finding — accepting and ignoring it is the
      silent fallback this project refuses everywhere else

## 4. Applying it

- [ ] 4.1 `examples/showcase/index.html` opts in. Measured, this draws exactly
      **one** divot — `check→rules` × `server→markup` at (700, 372) — and the
      showcase golden shifts once, deliberately
- [ ] 4.2 Look at the render. The one crossing is in open space between two
      groups, which is the easiest case a hop will ever get; if it does not
      read there it will not read anywhere

## 5. Left for the owner

- [ ] 5.1 **OWNER**: 3.4, the MCP surface question
- [ ] 5.2 **OWNER**: a changeset. `@pensketch/core` gains two optional fields —
      additive and user-visible, so a **minor**. `@pensketch/mcp` follows only
      if 3.4 says the tools grow an argument
- [ ] 5.3 **OWNER**: the 262 px of collinear overlap in `showcase` is not
      touched by this change and is what makes that picture hard to read.
      Separating the trunks is an edit to the diagram; widening `edge-overlap`
      to catch partial overlap is a change to a checker with 64 B of headroom.
      Both are real and neither is scoped here
