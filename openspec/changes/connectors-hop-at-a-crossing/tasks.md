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

- [x] 2.1 Calibrate `HOP_OUT` and `HOP_SPAN` **against both bounds** before
      either is written down

      **The calibration replaced the mechanism.** A bump on the line going over
      cannot be drawn by this pen, and no size rescues it: seven shapes went to
      a render before a break in the line underneath was chosen. One constant
      survives, `HOP_GAP` = 10, bounded at both ends on a render - 8 is
      swallowed by the 4.2 px ink band the crossing line lays down, 16 stops
      reading as one interrupted line. proposal, design D4/D5/D9 and the
      core-renderer requirement were rewritten before the code landed
- [x] 2.2 `hop?: boolean` on `DiagramEdge` and `hops?: boolean` on
      `DrawOptions`, resolved `edge.hop ?? options.hops ?? false` — `??` and not
      `||`, so `hop: false` is an opt-out and not an absence
- [x] 2.3 Detection in `draw`: a plain `O(S²)` double loop over every edge
      path's segments, strict interior intersection (`u` and `v` both in
      `(0, 1)`), parallel pairs skipped. No spatial index and no sweep line —
      measured at 0.0017 ms on this repository's largest diagram, 0.10% of the
      render it already pays for
- [x] 2.4 Where both edges of a crossing resolve to hopping, the later index in
      `edges` goes over
- [x] 2.5 The cut, on the path underneath: walk `HOP_GAP / 2` either side of
      the crossing and end one run there, starting the next on the far side.
      Two crossings closer together than `HOP_GAP` leave one break rather than
      two overlapping into a longer one, which a high-water mark settles
- [x] 2.6 A break falling within `HEAD_LEN` (10) of the final point is dropped,
      so no arrowhead is eaten and `arrow()` never takes its angle from a run
      that stops short of the head. The field applies to the edge and does not
      apply at that spot, so it is ignored rather than refused
- [x] 2.7 Tests: a fan-out at one anchor is left whole; a collinear pair is;
      an edge that ends on another does not break it; `hop: false` beats
      `hops: true`; a break under an arrowhead is dropped, with a control at the
      same crossing moved clear so the assertion cannot pass for any reason at
      all; and the default renders byte-identical to before this change

      One fixture had `hop: true` baked into it, so both sides of its
      comparison already carried the break and it passed while measuring
      nothing. The control is what found it
- [x] 2.8 Mutation-check the detection test: gut the strict-interior condition
      and confirm the fan-out test fails. A test that stays green with the
      primitive removed is not evidence

      **It stayed green, so the test was not evidence.** A crossing at a shared
      start has a negative `t0`, which the high-water guard drops whatever the
      interior test said - the fan-out never consults strictness. The case that
      does is an edge which *ends on* another: interior to the run being cut, an
      endpoint of the run crossing it. Relaxing `>=` to `>` breaks a line that
      merely arrives at another, and that assertion is what the mutation now
      fails on: 46 paths against 44

## 3. The surface a caller and an agent see

- [x] 3.1 `packages/core/schema/diagram.schema.json` and
      `packages/mcp/src/resources.generated.ts` regenerate from the JSDoc, so
      the JSDoc is the thing that gets written carefully
- [x] 3.2 `docs/agents.md`: the edge field table, `hops` beside `seed` in the
      draw options, the constants table (`HOP_GAP`), and whichever worked
      example is closest
- [x] 3.3 `README.md`: the edge field row, the draw-options row, and the size
      claim if 1.2 moved it
- [x] 3.4 `render_diagram` and `render_png` accept `hops` beside `seed`, so an
      agent can ask for the diagram-wide default without setting `hop` on every
      edge it writes. An argument beside the diagram, not a key inside it, so
      the strict top-level-key rule is untouched
- [x] 3.5 `check_diagram` does **not** accept it, and its existing strict-key
      handling refuses it by name. `check` walks the unbroken path, so the
      argument would change no finding — accepting and ignoring it is the
      silent fallback this project refuses everywhere else

      Both halves have a test that crosses the transport, which is the only
      place a declared schema is consulted. Worth writing down, because the
      asymmetry looks like an oversight and is not: `check_diagram` accepts
      `hop` on an edge and does nothing with it, while refusing `hops`. A
      diagram is one object handed to several tools, so refusing a *member*
      field because this tool does not act on it would stop a caller using one
      diagram with both. An argument is chosen per call, so declaring it only
      where it means something costs nothing

## 4. Applying it

- [x] 4.1 `examples/showcase/index.html` opts in, as a field on the edge rather
      than a draw option: the MCP serves that file as *diagram data*, so an
      option would give an agent a picture that renders differently from the
      page

      **The routing was reworked in the same breath, and had to be.** Turning
      the feature on drew one break, in a diagram whose three most confusing
      places it could not touch — 262 px of line drawn *along* other line, which
      a break is skipped on by construction. Fixed under a rule already in this
      spec, *an anchor is free*: `mcp` reaches three things and now leaves by
      three different sides, `react` arrives at core's left rather than
      descending the column `page` occupies. Not one connection changed, only
      which side each line leaves and lands on. Measured 262 px → **0**, and the
      two crossings that remain are both marked
- [x] 4.2 Look at the render. The one crossing is in open space between two
      groups, which is the easiest case a break will ever get; if it does not
      read there it will not read anywhere

      Rendered through real Chrome at the page's own font, full frame and at
      10×. Both crossings read: the line underneath stops, the one over runs
      through. `npm run diagrams` clean — and it was clean before the rework
      too, which is the point: none of what was wrong is a rule

## 5. Left for the owner

- [ ] 5.1 **OWNER**: 3.4, the MCP surface question
- [x] 5.2 A changeset. `@pensketch/core` gains two optional fields —
      additive and user-visible, so a **minor**. `@pensketch/mcp` follows only
      if 3.4 says the tools grow an argument
- [ ] 5.3 **OWNER**: widening `edge-overlap` to report *partial* overlap. Its
      test is that every sampled point of each path lies near the other, which a
      pair sharing a trunk and then diverging never satisfies — so it was silent
      on all 262 px in `showcase`, and the gate reporting zero warnings on that
      file was not reassurance. The routing fix landed in 4.1; teaching the
      checker to catch the next one is a change to an entry with 64 B of
      headroom, and is not scoped here
