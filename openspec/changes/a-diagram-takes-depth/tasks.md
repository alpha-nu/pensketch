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
- [x] 2.3 Validation (T-54's reading): the options `depth` validates
      whenever `options.extrude` is true, and every extruded node's resolved
      depth validates — the inherit corner included, where a node's
      `extrude: true` reaches an invalid options `depth`. An unread depth is
      ignored. Tests for all three, and for the override cutting both ways

      **Landed.** One rule, read exactly where depth is read: the options
      `depth` whenever the diagram-wide `extrude` is on, and every extruded
      node's resolved depth through `depthOf`'s own read - the inherit
      corner throws naming the node and the options field that carried the
      value. The throw lands before the first wash, so 2.2's incoherence
      dies by construction: a test pins the empty svg where
      `depth: Infinity` once moved anchors over a flat slab, and an unread
      depth renders byte-identical to one never written, NaN included.
      Both guard mutants die on exactly the predicted kill sets; goldens
      untouched. Measured cold, the rule costs real bytes: server 4986 of
      4992, 118 B past D7's 4868 rehearsal column with 6 B of budget left;
      core 4995, itself 113 B past its 4882 column but with 125 B of
      budget free, above the 100 B standard, so core's number stands and
      the re-decision is the server's alone. README row moved to match.
      The armed tripwire fires; the re-decision is recorded in D7 when
      taken, not here
- [x] 2.4 Types exported by name, JSDoc on the new fields written so the
      schema generates right, `npm run schema` clean. `GroupNode` omits the
      pair (T-49) so the strict schema refuses it on a group, and the
      MODIFIED closed-surface requirement (T-42) is what legislates
      `ShapeOptions`

      **Closed out as verification: the substance landed earlier and this
      task confirms it.** `ShapeOptions` exported and in the built dts
      (1.1/T-42); the pair JSDoc'd on `ShapeNode` and `DrawOptions` with
      the schema regenerated and ajv-verified both directions (2.1);
      `GroupNode` clean in source and dts; `npm run schema` idempotent at
      exit 0 on the current tree. Nothing remained to write

- [x] 2.5 Probe renders (T-53), eye-checked and recorded in D8: `hatch: true`
      beside depth — front hatch pen-coloured inset, face hatch muted
      outside, some widths aligning the two families — an accent node's
      pen-coloured faces over muted shading, and a dotted raw shape's
      dotted faces. Guidance lands with 5.1

      **Rendered and judged, then re-judged (T-61).** Accent coherent.
      Dotted extrudes as a ghost slab, dashed outlines with solid
      shading - deliberate, documented, unchanged. The phase leg was
      wrong twice over: the offset formula this task carried had `0.75d`
      in it, and the width it called aligned was 3/11 off, so the first
      render never tested alignment at all. Derived properly the offset
      is `(w - 8) mod 11` for a box and depth cancels; re-rendered at the
      truly aligned 173 beside 170 and 176 at two depths, the fold still
      reads, because the front hatch's 4 px inset dominates phase. Same
      verdict, different evidence, and the evidence is the part that was
      missing. D8 carries the derivation and the numbers

Gate: full suite, goldens untouched, `openspec validate --strict`.

## 3. The checker

Sequenced on the group 2 SWAT's advice: the flat-run gate lands **first**,
before any rule learns to sweep, so that every later commit in this group
is measured against a frozen statement of what the checker said when it
could not see depth at all. That is the 1.2 analogue - the gate the group
stands on rather than a test written after the fact.

- [x] 3.0 The flat-run gate: a diagram built to trip as many rules at once
      as one drawing can, its whole report frozen - rule, severity and
      message, in order.

      **Landed, and it proves less than this task first claimed (T-81).**
      The reference diagrams were tried as the subject and rejected: at
      their real viewBoxes the sampler reports nothing, and a severity
      mutant did not move either snapshot. The fixture that replaced them
      fires seven rules across eight findings and two severity mutants
      break it, so it is a real gate — but it is a **flat non-regression**
      gate and nothing more. Its fixture carries no `extrude` and is
      checked with no pair, so `swept` is only ever called with `d = 0`
      and the `undrawable-depth` block is unreachable; measured, seven of
      seven depth mutants pass it untouched. What it proves is that depth
      changed nothing flat, which is exactly what it was frozen for and
      worth having. "The gate the rest of group 3 stands on" was the
      wrong sentence: group 3 stands on the tests that landed with 3.2
      and 3.3, and two of those had holes the review found

- [x] 3.1 The swept box under every box-measuring rule, the moved anchors
      under every edge-walking rule, options and node fields resolved by the
      renderer's idiom - reading `carriesFace` from `sample.ts` rather than
      restating it (T-60), and `depthOf`'s idiom rather than a second copy.
      Measure `./check` when the first rule lands, not at the gate: 3648 was
      sized over a rehearsal column that excluded this task's label split
      and per-rule anchor walks

      **Landed with 3.2.** The resolution was not mirrored: `extrudes`,
      `magnitude` and `depthOf` were hoisted out of `draw`'s closure to
      module scope taking the pair as an argument, so `check` and
      `edgePath` call the very function `draw` calls, and `carriesFace`
      is read from `sample.ts` untouched. Nothing behavioural is
      duplicated; the only repetition is the two-field type, written as
      `Pick<DrawOptions, 'extrude' | 'depth'>` so a rename breaks both at
      compile time. Sharing cost core 28 B - the extra parameter at nine
      call sites - and that is the honest price of one rule in one place.
      Measured the moment the first rule swept, as the task demanded:
      `./check` was already at 3633 of 3648, which is the tripwire, and
      the budget moves before 3.3 rather than at its gate
- [x] 3.2 Tests: the face-past-the-viewBox case as the D6-recorded hero-5
      geometry — a box ending 10 px inside a 1200-wide viewBox at `d = 12`,
      face reaching 2 px past it (T-47; the hero file itself is untracked
      and since corrected, so the numbers here are the citable source) —
      sweep-only overlap, moved-anchor edge walk, the label-room rules
      pinned to the front box (T-56), and a flat run asserted byte-identical
      to today's findings

      **Landed.** 21 tests. The vertical half of the sweep was pinned only
      by geometry tests at first - the driver found mutants dropping
      `0.75d` from `y` and `h` died in `geometry.test.ts` and nowhere a
      rule could see, so two rule-level tests were added for the top and
      bottom bounds. The 10x8 pill that `carriesFace` resolves flat
      carries a same-geometry box as its control, so it cannot pass for
      the wrong reason. The flat run is item 7 and was not re-tested: 3.0
      froze it before the code could see depth, and its snapshot is
      byte-identical after - a statement made in advance is a better
      witness than a re-run of the changed code

- [x] 3.3 `undrawable-depth` (T-65): reported as an error wherever `draw`
      throws, naming the offender in the words the throw uses and telling a
      node's own depth from an inherited one. Additive `RuleId` member, so
      the union's own test and the severity table move with it

      **Landed. The union had no *runtime* test to move (T-98).** The
      claim first written here — that `RuleId` was pinned nowhere — is
      over-stated: `DEFAULTS: Record<RuleId, Severity>` in production
      code already failed typecheck on a member added without a place,
      and fails first. What was genuinely missing, and what the new test
      adds, is the runtime half: switching every listed id off over a
      diagram firing five rules, which proves each id is one `check`
      honours rather than one the table merely mentions. The words are kept identical to the
      renderer's two ways at once: `ACCEPTS` and `drawable` are one
      binding both files read, and a test renders the diagram under test
      with `draw` and asserts the thrown message equals the finding's, so
      a wording changed on one side alone goes red.

      Two things the work taught. A shared refusal helper was built,
      measured at +29 B on the root entry - a checker rule spent out of
      the renderer's budget - and rejected for the 3 B version. And
      exporting `extrudes` broke `npm run build` while `npm run
      typecheck` stayed green: declaration emit sees a type the
      no-emit pass never does. The suite does not typecheck either;
      both gates earn their place.

      `depthOf` also learned to answer zero for a depth the pen refuses.
      `draw` never reaches that - validation throws first - but `check`
      reports and keeps measuring, and an infinite depth swept an
      infinite box, so a spurious `out-of-bounds` stood beside the real
      finding. Pinned by a test that fails if the guard is reverted

- [ ] 3.4 **T-100, OWNER**: local `npm run lint` exits 1 from untracked
      `content/` and `.claude/` alone, so the signal is permanently red and
      the shipped code's cleanliness is invisible in it. That noise has
      already masked one committed failure and, this session, a format
      violation hidden behind biome's 20-diagnostic display cap. Either add
      both directories to `biome.json`'s ignores — they are already
      declared to git — or add a scoped script. The recommendation is the
      former; the call is the owner's because it touches their working
      directories

- [ ] 3.5 **T-79, OWNER**: `intersects` and `contains` carry an unstated
      non-negative precondition, so `node-overlap` and `group-escape` are
      wrong for a mirrored node *flat* — verified, and older than this
      change. T-78 normalised the sweep and deliberately did not reach
      into them. Fix them here, or record the precondition where it lives
      and open a follow-up. Half-fixing silently is the one option ruled
      out

Gate: full suite; `./check` budget from 1.3 still holds.

## 4. The tool boundary

- [x] 4.0 Two envelopes the pair does not reach yet, found while carrying
      `options` through the shipped-diagram loaders (T-82's neighbours):
      `packages/mcp/src/resources.ts` describes a served example as its
      `diagram` and its `viewBox`, so an `options` key beside them is
      undescribed; and `tools/render-assets.mjs` reads the same loader but
      draws with a hardcoded seed and label, so a showcase that ever
      extrudes would have a flat PNG in the README while `npm run
      diagrams` measured it extruded. Neither is reachable today — nothing
      shipped extrudes — and both become wrong the day 5.1's worked slab
      example lands

      **Landed, and there was a third.** `packages/mcp/test/resources.test.ts`
      checked every served example with `check(diagram, { viewBox })`,
      dropping the envelope's `options` — the same defect one layer down,
      in the test written to guard the layer above. The served-example
      description now names all three fields; `render-assets.mjs` spreads
      the page's whole options (it photographs a drawing, where the
      generator publishes a data model) with seed and label still its
      own, verified byte-identical for every page that passes none

- [x] 4.1 The three tools accept the pair; `check_diagram` accepts what it
      refuses for `hops`, with the contrast stated in its description
- [x] 4.2 Schema and resources regenerate (`npm run schema`,
      `npm run resources`); the declared-shape test extends to the new
      arguments
      **Landed.** The `check_diagram` sentence states the inversion in the
      house voice: it takes extrude and depth where it refuses hops,
      because hops change no finding and depth changes the geometry every
      finding measures. `depth`'s description interpolates
      `constants.DEPTH` rather than typing 12, verified reading "Default
      12" over the wire.

      The declared-shape test the spec calls out held only the diagram's
      keys, so it was extended two ways: every argument a tool declares
      must appear in the sentence it refuses with — the only place a
      caller is told what a tool takes — and the pair must be in the
      published schema's node variants and in all three tools at once, so
      a rename fails on the schema half rather than leaving three tools on
      a dead spelling. The stronger claim, that core growing a
      diagram-wide option fails the tools until they declare it, has
      nothing to bind to: `DrawOptions` never leaves TypeScript.

- [x] 4.3 Strict-boundary tests: unknown keys still named, the pair accepted
      on all three tools, parity between `render_diagram` and `render_png`
      for the same pair

Gate: full suite, generated files fresh in CI's sense.

## 5. Write it down

- [ ] 5.1 The field tables and pen tables in both READMEs, `docs/agents.md`
      (type block, constants table, and one worked slab example),
      `CONTRIBUTING.md` if any gate changed, and **six** JSDoc sites re-read
      against shipped behaviour, not two (T-68 counted them: `constants.DEPTH`,
      `ShapeOptions.depth`, `ShapeNode.depth`, `DrawOptions.depth`,
      `ShapeNode.extrude`, `DrawOptions.extrude` — per-shape guidance and the
      override rule already ship in all six). Two hazards to fix while there:
      `ShapeOptions.depth` promises an undrawable depth "leaves the shape's
      bytes exactly what they were", true of the pen and false of `draw`,
      which now throws first — write the level split down; and
      `ShapeNode.depth` never says an undrawable depth throws at all.

      Per-shape guidance written to the evidence: a box extrudes
      at any scale, a pill wants depth near a third of its height, a
      diamond prefers flat (T-48), and a pill under ~12 px in both
      dimensions has no outline to extrude (T-55) — and note that "12 px"
      is the shorthand, not the rule: measured, a pill carries faces once
      its larger dimension reaches `3 × ARC_MIN_CHORD / π` = 11.4592, which
      is why the first spec draft's "under `ARC_MIN_CHORD` in both
      dimensions" was false across [11.4592, 12). `ShapeNode.extrude` and
      `.depth` must also say that a shape too small to carry a face
      resolves flat, since neither they nor the schema generated from them
      nor the MCP resource mirroring it says so today, and a caller setting
      `extrude: true` on a 10 × 8 pill currently sees nothing happen with
      no documented reason. The checker's rule-and-severity table is
      hand-written in **three** places — `README.md`, `docs/agents.md` and
      `packages/core/README.md` — and none carries `undrawable-depth`;
      `docs/agents.md` is mirrored into the MCP resources, so
      `npm run resources` regenerates with it — and the count is asserted
      as a fact in a **fourth** hand-written place the earlier list missed,
      `examples/showcase/index.html`, which labels a node "nine rules" and
      is mirrored into the MCP resources (T-86). Two sentences are owed
      beside those tables: that `check` validates a depth's *form* and not
      its cost, so a depth it passes in half a millisecond can be one
      `draw` spends 150 ms and 8 MB on (T-84); and that the swept box
      over-reports by roughly `d`, measured at 110 px of clear air between
      two diamonds reported as overlapping at depth 40 (T-88). Plus:
      depth's cost is
      linear at about 82 B per px and is bounded by nothing, which `out`,
      `span` and `bow` each already say of themselves and `depth` does not
      (T-74); and `docs/agents.md` has no depth section at all, so
      `pensketch://spec` describes a renderer that cannot extrude while
      `pensketch://schema` documents the fields (T-72) — 4.2 confirms both
      resources move together.

      Two pre-existing records to correct in passing, both confirmed:
      `draw`'s throws-JSDoc says "Nothing else is validated" while a
      non-finite `bow`, `out` or `span` still dies as a bare TypeError from
      the sampler (T-69 — a named message is a follow-up, not this change),
      and the comment above the edge pass claiming a diagram "throws before
      anything is drawn" is false whenever a group exists, ten children deep
      (T-70)
- [ ] 5.2 `openspec validate --strict` clean; self-review of the full diff;
      every finding fixed before hand-off

- [ ] 5.3 **T-57, and it applies to every change from here**: a delta's
      header blockquote is a note to the reviewer of that change, not spec
      text, and `openspec archive` copies it into the base spec wherever it
      happens to land — the animation change's budget note spent a week
      inside the "Scoped packages" requirement, which is not about budgets.
      Strip this change's four headers at archive. Done once already for
      the stranded one, and its single load-bearing sentence promoted into
      the requirement body it was always about rather than deleted with it

## 6. Release

- [ ] 6.1 **OWNER**: core minor (0.7.0) via the release flow; `@pensketch/mcp`
      raises its core peer floor to the minor that ships the pair; react and
      animation floors move only if a release actually exposes depth through
      them, which this change does not require
- [ ] 6.2 **OWNER**: publish order per the standing release order; tags land
      via `publish.yml`, never by hand
