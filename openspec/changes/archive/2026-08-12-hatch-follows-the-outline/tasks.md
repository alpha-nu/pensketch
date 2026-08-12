# Tasks: hatch-follows-the-outline

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

This change began as one that documented a limitation and became one that
removes it, at task 2.1. Group 1 is written as it now stands; what it said
before is in the change's history, and design.md D5 records which decisions
were taken here rather than inherited from the prototype.

Sequenced after the release carrying `arc-connectors`, `brace-annotations` and
`strict-tool-input` was cut, so that the figures in design.md D2 and the tree
they were measured against are the same one. They were re-measured against the
released tree before the budget moved, and matched to the byte.

## 1. Write it down

- [x] 1.1 The delta's ADDED requirement and its five scenarios, and the
      MODIFIED "Hand-sketch primitive fidelity" restated with the hatching
      clause naming what it is cut to. A second delta for `repo-tooling`,
      which states the `./server` budget normatively
- [x] 1.2 The shipped documents that described the box behaviour: the `hatch`
      JSDoc on `ShapeNode` — which generates into
      `packages/core/schema/diagram.schema.json` — the `Pen.hatch` JSDoc, the
      README field table and pen table, `packages/core/README.md`'s pen table,
      and `docs/agents.md` at its type block, its constants table and its
      worked example. `tools/generate-resources.mjs` embeds that file verbatim
      as the MCP `SPEC` resource, so `resources.generated.ts` regenerates with
      it.

      No entry in the numbered trap list, and that is the point: the trap was
      going to be "shading escapes a pill and a diamond", and it no longer
      exists. A trap list that documents fixed behaviour is worse than one that
      is short
- [x] 1.3 The tests for the two shapes nothing tested — a hatched **pill**
      inside its ellipse, and a hatched **diamond** inside its four sides with
      each corner of its box bare. A box is already covered twice, and stays
      so. Both new tests were run against the old renderer and both fail
- [x] 1.4 `draw.test.ts`'s hatch test split in two, the box one renamed
      `hatches a box in pen, inset from its outline`. The old title said
      "inset from the outline" of a test that was inset from the box, which is
      the exact confusion this change exists to end

Gate: `npm run size` within budget on all four entries, `npm test`, `npm run
schema` and `npm run resources` clean, and `openspec validate --strict`.

## 2. The decision this change exists to inform

- [x] 2.1 **OWNER**: contour hatch, or not. design.md D2 measures the only
      shippable variant at **+250 B on `./server`**, which has **129 B free**
      — so it needs the budget raised by ~140 B before a byte is written,
      which is this project's rule. D3 lays out three ways forward and picks
      none

      **Decided: ship it** (D3 option 2), and make it more robust than the
      prototype on the way. That turns this change from one that documents a
      limitation into one that removes it, which is what group 3 is and what
      the note under group 1 is about
- [x] 2.2 ~~**OWNER**: whether `examples/custom-pen/`'s hatched pills stay.~~
      Closed without a decision, because there is no longer one to take. It
      was asked because that example is served to agents as
      `pensketch://example/lifecycle` while its two terminal states shed ink up
      to 15.5 px outside their outlines — 82 of 340 sampled points on
      `delivered`, 86 of 360 on `cancelled`. Group 3 takes both to **zero**,
      with 3.41 px of clearance, and the render was re-read to confirm it. A
      question whose whole premise has been removed is answered, not pending

## 3. Ship it

Written down here because the context that measured this was compacted before
it was built. **The prototype is not lost and does not need rediscovering:
design.md D4 is the artifact**, reapplied to a clean tree and remeasured before
it was committed — core 3748, `./check` 3006, `./server` 3769, 346 tests green.
Start by pasting it in, not by rederiving it.

### 3.1 The budget, first and alone

- [x] 3.1 Raise `./server` in `tools/check-size.mjs` **in its own commit,
      before a byte of the feature is written**, carrying the arithmetic — the
      requirement `brace-annotations` added to `repo-tooling` and the shape
      both of its own raises took

      Done at 3648 → **3872**. The measurement was re-confirmed against the
      released 0.2.0 tree first — core 3497, `./check` 3006, `./server` 3519,
      the same three numbers D2 recorded at 0.1.1 — and then taken from the
      built feature rather than from the prototype: 3773, plus the 100 B of
      gzip headroom `brace-annotations` argued for. `repo-tooling` states the
      figure normatively and moved in the same commit

### 3.2 Better than the prototype

Each of these is a decision with a measurement attached, not a foregone
improvement. Price every one against the budget raised in 3.1 and drop what
does not earn its bytes — the entry has ~140 B of new headroom, not a blank
cheque.

- [x] 3.2 **The inset is wrong for a non-box, and the prototype inherits it.**
      Worse than this item assumed: not 3.2 px on the shipped 150 × 76 diamond
      but **1.81**, and **0.00** at 278 × 30 — hatch ink lying on the outline.
      Fixed by scaling the clip about the centre, which for a diamond is exact
      and is one `hypot`. Swept over 5566 sizes the closest ink comes to a
      diamond's outline goes 0.00 → **3.21 px**, against the 3.40 a box holds.
      The pill is left inscribed in the inset box deliberately: worst case
      1.85 px, median 3.31, and an ellipse offset by a constant is not an
      ellipse. D5 has both tables
- [x] 3.3 **A tangent span draws a dot.** Declined, and the sweep is why. The
      `box` arm — untouched, and the reference's own behaviour — draws a span
      under 3 px at **every one of those 5566 sizes**, its first scanline being
      degenerate by construction. A guard would defend the two new shapes
      against something the shipped one has always done and nobody has
      reported
- [x] 3.4 **A concave outline.** Covered, and it turned out to be more than a
      free test: the prototype's crossing rule is wrong at a vertex a line only
      touches, and a notched clip is what shows it. `pen.test.ts` now holds the
      concave fill, the vertex case, closed-and-open equivalence, an edge lying
      along the hatch, and an empty clip
- [x] 3.5 **`raw` still cannot hatch inside what it drew.** Solved without
      touching the closed surface: the sixth argument takes the *points*, not a
      shape name. No new `Pen` member, so `api.test.ts`'s exact member list and
      the requirement that names it both stand, and `draw` computes the points
      anyway. Verified by rendering a ten-point concave star through `raw`

### 3.3 What must not move

- [x] 3.6 **The `box` arm is untouched, and the goldens prove it.** It returns
      before the scanline, `npm run goldens` leaves the tree clean, and all
      four parity fixtures pass
- [x] 3.7 **Rewrite the delta**, which specified the wart, and **rename the
      change**: `hatch-follows-the-box` named the bug
- [x] 3.8 **Re-aim group 1**, which is now written against the fix rather than
      the wart, along with the `hatch` JSDoc, the README tables, `docs/agents.md`
      and `examples/react/src/incident.ts` — whose `shape === 'box'` guard
      existed only to keep the diamond out of this and is gone

### 3.4 Left for the owner

- [x] 3.9 **OWNER**: release. A changeset is in the tree marking
      `@pensketch/core` and `@pensketch/mcp` **minor** — rendered output moves
      for a hatched pill or diamond, and that is the fix rather than a side
      effect. Archiving this change follows the release, as it did for the
      three before it

      Done: `@pensketch/core` and `@pensketch/mcp` are **0.3.0** on the
      registry, tagged, via `Version Packages (#4)`. `@pensketch/react` stays
      at 0.1.0, its peer range on core admitting the bump
