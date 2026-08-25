# Tasks: a-diagram-takes-depth

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

Decisions this change rides on were taken 2026-08-23/24 and are recorded in
proposal.md; the reference-renderer decision (design.md D5) supersedes an
earlier answer given on a wrong framing. Nothing below edits
`reference/renderer.html`, and any task that would is a defect in this file.

## 1. Prototype and price

- [x] 1.1 The silhouette extrusion in `pen`: `depth` on `rect`, `pill`,
      `diamond`; one algorithm, faces by the outward-normal test, one offset
      chain plus two connectors, shading quads through `hatch`'s clip arm.
      `DEPTH` and `DEPTH_RISE` land in `constants.ts`

      **Landed.** One `extrude(outline, opts)` over each shape's ideal
      outline; all three wind clockwise on screen, so the outward normal of
      a segment `(dx, dy)` is `(dy, -dx)`. The facing run is wrap-aware
      (a wide diamond wraps its seam and a test pins it). Both strict
      inequalities are mutation-killed: shading by the zero-height box,
      facing by a diamond at exactly h = 0.75 w, added on a binding
      navigator finding after the `>` -> `>=` mutant survived the first
      test set
- [x] 1.2 Prove the off-path is free: with no `depth` anywhere, the rendered
      bytes of every existing test fixture and both parity goldens are
      identical to `main`, and the depth branch provably consumes zero rng
      draws. This is the gate the whole change stands on; it fails, nothing
      else lands

      **Proven, four ways.** All four parity goldens pass untouched and
      regenerate byte-identically (`npm run goldens`, `git diff` clean) -
      the goldens encode the exact seeded sequence, so one stray draw fails
      them structurally. The 451 pre-change tests pass unchanged, many
      pinning exact jittered points. A dedicated test renders each shape
      with `{}`, `0`, `-3`, `NaN` and `Infinity` and asserts the whole
      svg's bytes, probe stroke included, equal the optionless call. And
      the gutted-guard mutant (extrude unconditionally) fails the suite at
      exit 1. The guard sits before any rng, stroke or hatch call, read
      independently by the navigator
- [x] 1.3 Measure `npm run size` on all four budget entries against design.md
      D7, and record the numbers in D7 — measured, not estimated. If any
      entry exceeds its budget, stop: the raise is **OWNER**, taken in
      advance, per the size requirement

      **Measured and moved — and resequenced.** The size requirement says a
      budget moves in advance of the work, in one step, never at a failing
      gate; a raise sized to 1.1 alone would have needed a second one after
      group 2. So the whole core-side surface was built as a rehearsal on
      top of 1.1, priced (D7 has the table), reverted, and the unpushed
      history rewritten so the budget commit lands before the code that
      needs it: `./server` to 4992, `./check` to 3648, root unmoved. The
      raise was taken under the owner's session delegation of 2026-08-25.
      In this change's history 1.3 therefore precedes 1.1, which is what
      the animation change's group 1 did and for the same reason
- [x] 1.4 Calibrate the default against both ends (design.md D8): render an
      extruded diagram at hero scale (1200 × 600, 60-90 px nodes) and at small
      scale (a 700 × 150 fixture, 40 px nodes), eye-check both, and record
      whether `DEPTH = 12` holds or the default moves. **OWNER** confirms the
      look before the constant freezes

      **Rendered at both ends plus two proportional probes; 12 holds, for
      the shape it was calibrated on.** The box slab reads at both scales.
      The pill needs depth near a third of its height to read as a coin
      and turns to a double outline at the default; the diamond reads as a
      folded corner at every probed depth. D8 records the per-shape
      findings, the guidance routed to 5.1, and the two refinements
      considered and not taken. The look call was made under the owner's
      session delegation in place of the OWNER gate this task named

Gate: `npm test`, `npm run size`, both parity goldens byte-identical.

## 2. The renderer

- [x] 2.1 `draw` plumbing: the options pair, the per-node pair, the `hop`
      resolution idiom, faces drawn front → faces → face shading →
      front `hatch: true` → label within the node phase (no wash: that is
      the group treatment). Groups never
      extrude (T-49): the pair on a group is ignored by `draw`, refused by
      the schema, and a test pins the flat group frame under a diagram-wide
      `extrude: true`

      **Landed in 4c304a6.** The hop idiom verbatim, the depth key absent
      from a flat call, GroupNode never learning the pair so tsc and the
      strict schema refuse it, hand order emergent from the pen and pinned.
      Three resolution mutants die on exactly the predicted tests. The tick
      itself landed a commit late - the navigator's 2.2 nit - and the
      convention stands: tick and evidence ride the task's own commit

- [x] 2.2 Anchors: `t` and `r` to the silhouette midpoints when extruded,
      `anchor` reporting the same points, edges attaching there. Tests pin
      the two moved anchors and the two unmoved ones at a known `d`

      **Landed.** `anchor(node, side, depth = 0)`, moved branch = flat
      anchor plus the full vector on `t`/`r`; `depthOf` narrows groups to
      flat and threads every edge branch at both endpoints, loops riding
      the moved mid through `loopPoints`. Note arrows keep their literal
      points - the author's line to move, pinned by a test. The checker's
      `edgePath` deliberately stays flat until 3.1. Two mutants die on
      exactly the predicted kill sets. For 2.3: `depth: Infinity` today
      moves the anchor while the pen draws flat - the non-finite throw
      closes that incoherence, cover it with a test
- [ ] 2.3 Validation (T-54's reading): the options `depth` validates
      whenever `options.extrude` is true, and every extruded node's resolved
      depth validates — the inherit corner included, where a node's
      `extrude: true` reaches an invalid options `depth`. An unread depth is
      ignored. Tests for all three, and for the override cutting both ways
- [ ] 2.4 Types exported by name, JSDoc on the new fields written so the
      schema generates right, `npm run schema` clean. `GroupNode` omits the
      pair (T-49) so the strict schema refuses it on a group, and the
      MODIFIED closed-surface requirement (T-42) is what legislates
      `ShapeOptions`

- [ ] 2.5 Probe renders (T-53), eye-checked and recorded in D8: `hatch: true`
      beside depth — front hatch pen-coloured inset, face hatch muted
      outside, phase offset `(w + 0.75d + 8) mod 11` so some widths align
      the two families — an accent node's pen-coloured faces over muted
      shading, and a dotted raw shape's dotted faces. Guidance lands with
      5.1

Gate: full suite, goldens untouched, `openspec validate --strict`.

## 3. The checker

- [ ] 3.1 The swept box under every box-measuring rule, the moved anchors
      under every edge-walking rule, options and node fields resolved by the
      renderer's idiom
- [ ] 3.2 Tests: the face-past-the-viewBox case as the D6-recorded hero-5
      geometry — a box ending 10 px inside a 1200-wide viewBox at `d = 12`,
      face reaching 2 px past it (T-47; the hero file itself is untracked
      and since corrected, so the numbers here are the citable source) —
      sweep-only overlap, moved-anchor edge walk, the label-room rules
      pinned to the front box (T-56), and a flat run asserted byte-identical
      to today's findings

Gate: full suite; `./check` budget from 1.3 still holds.

## 4. The tool boundary

- [ ] 4.1 The three tools accept the pair; `check_diagram` accepts what it
      refuses for `hops`, with the contrast stated in its description
- [ ] 4.2 Schema and resources regenerate (`npm run schema`,
      `npm run resources`); the declared-shape test extends to the new
      arguments
- [ ] 4.3 Strict-boundary tests: unknown keys still named, the pair accepted
      on all three tools, parity between `render_diagram` and `render_png`
      for the same pair

Gate: full suite, generated files fresh in CI's sense.

## 5. Write it down

- [ ] 5.1 The field tables and pen tables in both READMEs, `docs/agents.md`
      (type block, constants table, and one worked slab example),
      `CONTRIBUTING.md` if any gate changed, and the JSDoc on `DEPTH` and
      `ShapeOptions.depth` re-read against shipped behaviour (T-46 made the
      constants comment the fifth hand-written place this list once
      missed). Per-shape guidance written to the evidence: a box extrudes
      at any scale, a pill wants depth near a third of its height, a
      diamond prefers flat (T-48), and a pill under ~12 px in both
      dimensions has no outline to extrude (T-55)
- [ ] 5.2 `openspec validate --strict` clean; self-review of the full diff;
      every finding fixed before hand-off

## 6. Release

- [ ] 6.1 **OWNER**: core minor (0.7.0) via the release flow; `@pensketch/mcp`
      raises its core peer floor to the minor that ships the pair; react and
      animation floors move only if a release actually exposes depth through
      them, which this change does not require
- [ ] 6.2 **OWNER**: publish order per the standing release order; tags land
      via `publish.yml`, never by hand
