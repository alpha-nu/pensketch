# Tasks: a-diagram-takes-depth

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent - publishing and
tagging are the whole of that list. Items marked **OWNER CALL** are decided by
the owner and then done by the agent; labelling those OWNER too, as this file
did until 3.4 and 3.5 were fixed, reads as work the agent may not touch when
what was meant is a choice the agent may not make.

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

- [x] 3.4 **T-100, OWNER CALL**: local `npm run lint` exits 1 from untracked
      `content/` and `.claude/` alone, so the signal is permanently red and
      the shipped code's cleanliness is invisible in it. That noise has
      already masked one committed failure and, this session, a format
      violation hidden behind biome's 20-diagnostic display cap. Either add
      both directories to `biome.json`'s ignores or add a scoped script

      **Both ignored, and the task's own premise was half wrong.** It said
      the two directories were "already declared to git": `.claude/` is, in
      the committed `.gitignore`, but `content/` is excluded only in the
      owner's local `.git/info/exclude`, which no clone carries. So the
      `!content` entry is inert everywhere but this tree, and `.gitignore`
      was deliberately left alone - naming a working directory there would
      silently refuse a future `git add content/`, a footgun traded for
      tidiness.

      Verified by subtraction rather than by a green run: biome checked 126
      files before and 108 after, and 18 is exactly the count of
      biome-eligible files under the two directories, so nothing shipped
      left the gate. Then mutated - an unformatted line in
      `packages/core/src/geometry.ts` and another in `tools/check-size.mjs`
      each take it to exit 1. Two probes that did **not** fire are worth
      writing down, because both are biome's own defaults and neither
      changed here: whitespace in an `.html` file is not caught (the HTML
      formatter is experimental and off, though the a11y and embedded-CSS
      lints do run), and `.md` is not read at all. `CONTRIBUTING.md`'s
      "across the repository" was true when written and is not now, so it
      now says what it covers

- [x] 3.5 **T-79, OWNER CALL**: `intersects` and `contains` carry an unstated
      non-negative precondition, so `node-overlap` and `group-escape` are
      wrong for a mirrored node *flat* - verified, and older than this
      change. T-78 normalised the sweep and deliberately did not reach
      into them. Fix them here, or record the precondition where it lives
      and open a follow-up. Half-fixing silently is the one option ruled
      out

      **Owner decided 2026-08-25: fix them here. It was three rules, not
      two.** `text-overflow` reads `n.w` as written for the room a label
      has, so a negative width makes the room negative and every label on a
      mirrored node "overflows". Measured on one rectangle written two
      ways: `node-overlap` 1 finding upright and 0 mirrored,
      `group-escape` 1 and 0, `text-overflow` 0 and 1. Fixing the two the
      task names and leaving the third is the half-fix it rules out, so it
      is in.

      One module-private `norm` in `geometry.ts`, read by `intersects`,
      `contains` and `swept`'s `d > 0` arm, so "a box is the rectangle it
      covers" is stated once and no caller has a precondition to remember;
      `swept`'s documented `d <= 0` identity return is untouched and its
      old tests still pin it. +42 B on `./check`, 3866 of 3968.

      **The driver refused the brief and was right.** It specified
      `Math.abs(n.w)` for the room on both arms; the group arm is
      `Math.max(0, n.w)`, because `draw` - and `reference/renderer.html`,
      which is normative - writes a group's title at the *literal*
      `n.x + TITLE_DX`, so a mirrored group's title really is laid outside
      its own frame. `abs` would hand it 178 px it cannot reach and
      silence a true finding. `Math.max(0, n.w)` is
      `Math.max(n.x, n.x + n.w) - n.x`: the distance from where the pen
      writes to the covered right edge, identical to the old expression
      wherever `w` is positive. The lesson generalises - when a fix
      normalises geometry, check whether the renderer normalises too, or
      the checker stops measuring the thing it is about.

      **The navigator blocked on the spec, not the code, and was right.**
      This delta claimed "when extrusion is off ... findings SHALL be
      identical to today's, byte for byte", with a scenario to match. This
      task falsifies both on purpose: a flat mirrored node's findings
      change. The requirement's point was that depth costs nothing where
      it is unused, so it now says that, and the guarantee it was
      confused with - a box is the rectangle it covers - is legislated
      where it belongs, in the geometry rules, with the group-title room
      rule beside it so a later refactor to `abs` fails the spec and not
      just a test.

      Six mutants, all killed: `norm` dropped from `intersects` (6 tests),
      from `contains` (4), `room` reverted to `n.w` (5), `norm` gutted to
      `return b` (16, including the T-78 `swept` tests, which proves
      folding `swept` into it kept its old coverage), `Math.min(b.x, b.w)`
      (37), and the brief's own `Math.abs` on the group arm (2, after a
      second witness was added for it - it killed only one). 548 -> 566
      tests

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

- [x] 5.1 The field tables and pen tables in both READMEs, `docs/agents.md`

      **Swept in three parallel passes over disjoint files - the sources, the
      two READMEs, `docs/agents.md` plus the tool descriptions - against one
      fact sheet measured on the tree rather than copied out of this file.
      That mattered: two of the numbers this task recorded were wrong.** The
      cost is about **80 B per px** and not 82, fitted over depths 100 to
      1000; and the fixed face cost is **4,126 B**, measured as the markup's
      growth over flat as the depth approaches nought. `check` passes
      `depth: 20000` in 0.43 ms where drawing it emits 6,386 paths, 1.6 MB of
      markup and 34 MB of heap. `constants` exports 42, not 40; the checker
      has 10 rules; the showcase says "ten rules" and its PNGs were
      re-rendered.

      **The 109 px figure was true and its use was misleading.** T-88's
      number reproduces, but two 100 x 100 diamonds already report
      `node-overlap` **flat** with 69 px of clear air between their outlines -
      the slack any shape that does not fill its box has always had. Depth
      adds the sweep resolved along the diagonal the two approach on,
      `(d + 0.75d) / sqrt(2)`, measured constant at **1.237 d** across depths
      12, 20, 40 and 80, so the pair is reported at 119 px at `depth: 40`.
      Citing 109 beside "over-reports by roughly `d`" invited a reader to
      charge 70 px of pre-existing geometry to the feature. All three files
      now separate the two and state which distance is meant.

      **The drivers corrected the brief twice, and the review a third time.**
      The brief said `draw` validates each node's *resolved* depth; it
      validates the **magnitude**, and the difference is real - a 10 x 8 pill
      carries no face, so resolution answers nought, yet `depth: 0` on it
      still throws. Both deltas said "resolved depth", which under
      `depthOf`'s own documented meaning demands a finding for every
      face-less shape whose depth is good and forbids one for the shape whose
      depth is bad: wrong in both directions at once. The code and its tests
      were right throughout. The brief also handed out 38 ms as `draw`'s
      cost when it is `renderToString`'s - jsdom takes 22 times that - so the
      JSDoc carries no timing at all and the READMEs name the path.

      **The review found four more, none of which the gates could.** The
      phrase survived in `docs/agents.md`, 33 lines from a paragraph saying
      the opposite, in the file served verbatim as `pensketch://spec`. The
      `depth` tool description never said a bad value throws, kept the
      sentence the JSDoc had just replaced, and hedged where D8 measured.
      `packages/mcp/README.md` claimed seven resources against eight and four
      example diagrams against five - the "nine rules" defect again, in the
      document whose whole job is telling an agent what it can fetch. And a
      sentence added here was simply false: `node-overlap` is an error, so
      the sweep does not "err toward warning".

      **Three counts are now pinned instead of proof-read.** The showcase's
      "ten rules" and "ten primitives" are held to `RuleId`'s members and
      `Pen`'s; the package README's resource and example counts are held to
      what the server registers. `FACE_MIN`, the one number a tool
      description duplicates from a formula core declines to write down, is
      held to the renderer from both sides - the size it promises must
      extrude and a hundredth under it must not - and both rounding mutants
      die. That is what "nine rules" lacked for a whole change
      (T-70)
- [x] 5.2 `openspec validate --strict` clean; self-review of the full diff;
      every finding fixed before hand-off

      **All 14 gates green from a cold tree in dependency order, 579 tests,
      `0 errors, 0 warnings across 15 diagrams`.** Build before typecheck:
      a cold `npm run typecheck` exits 2 without the workspace declaration
      files, which is an ordering trap and not a type error. The review's
      four blocking findings are fixed except the one that is not a fix -
      that nothing shipped extrudes is a decision, carried to the owner as
      5.4 rather than settled here

- [x] 5.3 **T-57, and it applies to every change from here**: a delta's
      header blockquote is a note to the reviewer of that change, not spec
      text, and `openspec archive` copies it into the base spec wherever it
      happens to land — the animation change's budget note spent a week
      inside the "Scoped packages" requirement, which is not about budgets.
      Strip this change's four headers at archive. Done once already for
      the stranded one, and its single load-bearing sentence promoted into
      the requirement body it was always about rather than deleted with it.

      Stripped at archive, 2026-08-26 — and the count in the line above had
      gone stale the way this change keeps proving counts do: five headers,
      not four, because the documentation-and-examples delta arrived with
      5.4 after this task counted. Each header read before deletion:
      nothing load-bearing lost — three are pointers into design.md, the
      repo-tooling narrative closes by naming D7 and `check-size.mjs` as
      where its content lives, and the documentation-and-examples header's
      one durable act (the stranded blockquote's promotion) was performed
      in the requirement body when it was written. `--strict` green with
      the headers gone.

- [x] 5.4 **Owner decided 2026-08-26: ship an extruded example.** The gap the
      review found stands: nothing this repository ships extrudes, so
      `openspec/specs/documentation-and-examples/spec.md`'s closed enumeration
      of what `showcase/` demonstrates has silently gone incomplete, this
      change carries no delta for that capability, and task 4.0's two
      envelopes are exercised by no page that passes `options`.

      **The pick is `examples/vanilla/` - the CI pipeline.** Measured against
      every shipped diagram: extruded diagram-wide at `DEPTH`, the showcase
      and the five react states check clean, vanilla raises one finding,
      the ATM three, the hero two, and `custom-pen` six, which is what a
      diagram of six pills predicts. Vanilla wins on what the picture means
      rather than on the count: its stages are groups and stay flat by the
      API's own rule, its jobs are boxes and become slabs, and its gate is a
      diamond that stays flat on D8's guidance. The hybrid is semantic and
      almost entirely free - a region is not an object, and the renderer
      already refuses to extrude one. It is also the first example in the
      README's table and the one a newcomer opens first.

      Three edits, all measured: `extrude: true` in the draw options,
      `extrude: false` on the gate diamond, `depth: 16` on the `push` pill
      (its height is 48 and D8 wants about a third), and the `smoke passed`
      label from `lx: 652` to `662`, because `t` moves under extrusion where
      `b` does not, so the edge tilts right under its own label. At those
      values `check` reports **nothing** in either register, and both were
      eye-checked side by side.

      It also buys the coverage: vanilla goes through `npm run diagrams` and
      is served as `pensketch://example/pipeline`, so `resources.ts`'s
      three-field description is exercised by a page that really carries
      `options`. `render-assets.mjs`, the other envelope, is exercised by 5.5.

      Owed with it: a `documentation-and-examples` delta. Two requirements
      need it. The `showcase/` enumeration should say which examples carry
      depth and why the breadth diagram is not the one that does. And the
      hero requirement fires on "a connector or annotation shape" added to
      the data model, which depth is not - it is a node treatment - so the
      sentence that means "a reader who meets the project there SHALL meet
      what it can draw" currently lets a whole feature past. Widen it

      **Landed, and the delta was owed more than the two lines expected.**
      Both enumerations are widened to name a *treatment* beside a shape, the
      folder that carries extrusion is named with the argument for it, and
      the general hazard is written into the requirement body: a requirement
      that lists what a document or a diagram contains goes false the moment
      either grows, and `--strict` cannot see it. Neither modified
      requirement lost a scenario - 2 and 9 restated, one added - checked by
      diffing the scenario titles against the base rather than by counting.
      A stranded blockquote at the end of "Runnable examples" went with it:
      a previous change's note to its own reviewer, sitting under a
      requirement it is not about, its one durable sentence promoted into the
      body. That is T-57's defect found a second time, and it is in the base
      spec rather than in this change's deltas.

      **`pipeline` is the first shipped page whose served envelope carries
      `options`** - `{"extrude":true}` beside its diagram and viewBox - so
      4.0's resource work is exercised by something at last rather than by
      the no-options case alone.

      **And the scenario needed a witness.** `check-diagrams.mjs` does measure
      a page with the page's own options, so an extruded example is checked
      extruded. But a page that quietly went flat passed every gate: the
      diagrams check, the suite and a regenerated tree, because flat is a
      valid drawing too. Measured, not assumed - the mutant was run. One test
      now asserts a served example's options extrude, and it dies on that
      mutant. Without it the requirement's new scenario was a wish
- [x] 5.5 **The README shows both features, owner-requested 2026-08-26.**
      Three pictures and the prose around them.

      **The architecture diagram becomes a hybrid flat/extruded surface, with
      animation.** Repurposed rather than replaced: it already draws 13 boxes,
      4 groups, a diamond and 2 pills, and it already checks clean extruded
      diagram-wide at `DEPTH` with no surgery at all - measured, 0 findings.
      What the hybrid has to earn is meaning: the mix must say something
      about the architecture rather than decorate it, so the split needs
      deciding before it is drawn. The obvious reading is that the packages
      and entry points are objects and the layers behind them are context,
      which is the same argument that keeps a group flat.

      **The hero gains extruded elements.** `tools/hero-diagram.mjs`, 2 boxes,
      a diamond, a group and a pill. Extruded whole at `DEPTH` it raises two
      `label-collision` findings, so this one needs real placement work rather
      than a switch.

      **The README prose then has to carry both features**, and today it
      mentions animation only in the examples table.

      Three things to settle before any of it is drawn:

      1. **Settled by the owner 2026-08-26: an animated GIF, never a video.**
         The reason it was a question at all is worth keeping: `README.md` is
         rendered on GitHub *and shipped to npm*, `docs/assets/*.png` are
         static, and `tools/record.mjs` makes **MP4**, which GitHub plays and
         npm does not - so a video is invisible to half the audience where a
         GIF is an image everywhere. What remains is engineering, not choice:
         `record.mjs` needs a GIF path beside its MP4 one, and **weight is
         the constraint to price first**, since `showcase-light.png` is
         already 548 kB as a single still. Expect to trade frame rate, palette
         and dimensions against it, and to record the numbers, since nothing
         gates the size of a README asset today.
      2. **Whether the showcase's hybrid is a second register or a third.**
         The owner has previously said they have mixed feelings about mixed
         depth diagrams, in the context of the ontologies figures. This asks
         for exactly that mix, deliberately - which is fine, and worth saying
         out loud so the earlier judgement is overridden on purpose rather
         than forgotten.
      3. **Where this work lives.** It is documentation and art, not API, and
         it touches `documentation-and-examples` alone. The recommendation is
         that 5.5 becomes **its own OpenSpec change**, so that group 6's
         release is not held behind README images: 5.4 closes the spec gap
         this change opened, and the release can ship on it. If the owner
         would rather it rode here, it stays as 5.5 and group 6 waits

      **Landed in three commits, riding here on the owner's "carry on" -
      settle-point 3 answered by proceeding, 2 by the ask itself** (the
      hybrid deliberately overrides the earlier "mixed feelings", with the
      mix carrying meaning rather than decoration).

      **5.5a, the hero** (e7f6254): pill at 17, diamond opted out, one label
      moved 12 px for the moved `t` anchor. The plumbing was the real find:
      the hero's options were declared twice - hardcoded where the PNG is
      drawn, `{}` where the checker reads it - 4.0's envelope defect in the
      one shipped diagram that is not a page. `HERO_OPTIONS` now lives beside
      the diagram and both consumers read it.

      **5.5b, the showcase hybrid** (b9d4482): the notation key gains
      "depth - published", and the split is semantic - the three packages
      and core's four entries stand up, the page, the internals and the
      checker's diamond lie flat. Per-node `extrude: true`, the raising
      direction of the override, where vanilla shows the flattening one.

      **5.5c, the GIF.** `record.mjs` gains the file-carried `options` (the
      envelope defect's third appearance: its draw call hardcoded seed,
      label, order, so a recording of an extruded page would have been flat)
      and a GIF encode chosen by the `--out` extension - palettegen from the
      frames' own colors, `-loop 0`, the H.264 evenness rule exempted since
      it is that codec's alone. Priced before chosen: 2x costs 1.22 MB a
      theme against 1.5x's 0.94, and 2010 px covers a retina reader at
      README width; 15 fps gives a 500 ms stroke seven frames; 6 s of
      drawing because twenty nodes at 4 read as a race. Both themes encode
      deterministically - recorded twice, hashed identical. The README's
      architecture section now embeds the GIFs, carries the depth prose, and
      the showcase stills are deleted with their render-assets target: a
      still of a drawing whose point is the drawing would be the poster
      frame standing in for the film.

      **One measurement worth keeping**: the animation's element order is not
      the z-order, and an eye-check nearly misread it as a defect. Read off
      the `--ps-i` stamps: groups 0.00-0.07, shapes 0.07-0.58, edges
      0.69-0.88, all text 0.91-0.96. The stylesheet re-times the drawing as
      a hand would work - boxes first, connect them after, label last

- [x] 5.6 **Owner eye-check of the shipped hero, 2026-08-26: two defects, one
      cause.** The pill's extruded band lost its hatch mid-face, and every
      box was missing the upper-right depth edge. Both trace to D2
      generalizing the approved prototype away: `content/ontologies/hero`'s
      box drew **three** verticals - connector, corner rib, connector - and
      hatched the right *face*, where the spec said "one offset chain plus
      two connectors" and hatched the descending *sub-chain*. Core
      implemented its spec faithfully; the spec had no notion of a corner
      interior to the facing run, so no rib could be drawn there and the
      hatch could not split there.

      The fix is the fact the pen already has: a box and a diamond hand
      `extrude` their real corners, a pill hands a sampled arc. `extrude`
      takes `faceted` - a rib at every interior vertex, shading decided per
      face, a face shaded when any of it descends. A pill is one face,
      hatched whole. A turn-angle threshold was considered and measured
      out: `ARC_MIN_CHORD` floors a 40 px pill's sampling at ~36° chord
      turns, coarser than a wide diamond's corner, so no angle separates
      them - the caller states the fact instead.

      Box: lit top, hatched right, one rib - the prototype exactly.
      Diamond: gains a crease at its fold. Pill: the coin's rim shades
      whole. +57 B core, +59 server, measured. Four mutants killed: the rib
      loop deleted (5 tests), `faceted` ignored (4), faces always
      per-segment (1 - the pill's whole-band hatch), the shading criterion
      inverted (8). Flat goldens byte-identical; hero PNGs and both GIFs
      re-rendered; the mechanism sentence corrected in the delta, both
      READMEs, `docs/agents.md` and two JSDoc sites

- [x] 5.7 **Owner eye-check, second round: the pill's back edge was not
      parallel to its front.** Not the owner's eyes. `pill` deforms each
      outline point's radii by up to half `PILL_JX` before stroking - the
      hand-drawn look - while the band was offset from the bare ideal, so
      its back edge was parallel to a curve nobody drew and diverged from
      the drawn front by up to ~3 px on a 21 px band. A box hides the same
      mismatch behind its corners; a continuous band cannot.

      The band now rides the drawn deviations: `pill` captures them - the
      same two `j` draws per point in the same order, so a flat pill's
      bytes do not move and the goldens stay untouched - and hands
      `extrude` a deform that recovers each ideal sample's angle and
      interpolates the captured deviation there, which also carries a pill
      big enough for `arcPoints` to sample finer than `PILL_STEPS`. The
      ideal still decides facing, winding and the face bound; the ink
      rides the drawing.

      The test replays the drawing's own numbers: a pill's first 54 draws
      are its 27 radius pairs, so a second pen at the same seed hands the
      test the exact deviations, and the chain is pinned to the ridden
      positions at the old tight tolerances. Two mutants die: the deform
      dropped, and its interpolation frozen at the first sample. +153 B on
      core, +145 on server - the budgets left at 1 B and 8 B, re-decided
      in their own commit

- [x] 5.8 **Owner, third round: the band's wobble, and the diamond raised.**
      The 5.7 ride was real and, at the hero's seed, invisible - the owner
      said "looks the same" and the before/after crops agreed. What the eye
      was catching was the second cause: the band stroked at the default
      amplitude 2.6 against a front deliberately calmed to `PILL_AMP` 1.4,
      so the back edge wobbled at nearly twice the front's hand. The band
      now strokes at the outline's own amplitude, the test's tolerances
      tighten from `AMP` to `PILL_AMP` - which is what kills the mutant
      that falls back to the default - and the showcase GIF re-encoded
      byte-identical, since no showcase node extrudes a pill.

      And the hero's diamond extrudes, on the owner's instruction - the
      opt-out removed, the fold reading deliberately with 5.6's crease at
      its top vertex, the `miss` label up 3 px for the moved `r` anchor.
      Zero findings flat and extruded. D8's "prefer it flat" stands as the
      default guidance; the hero now demonstrates the fold used on purpose,
      which is the difference between a default and a rule

- [x] 5.9 **Owner, fourth round, 2026-08-26: "revert to the plain old flat
      hero."** The reversal of 5.5a, and of that alone: the picture data is
      back at its pre-5.5a form, and the re-rendered PNGs hash byte-identical
      to the pre-5.5a committed assets - light
      `86b8bd95b446e123881415aa5c696f8879a23df8`, dark
      `bcb4c1afbf49f234e6e2106d433b9171b86a7df4` - which is the whole
      verification. `HERO_OPTIONS` stays exported at `{}`, because the
      envelope fix outlives the option it carried. The judgement is recorded
      in the documentation-and-examples delta's hero requirement; the
      5.6-5.8 renderer fixes are untouched by this reversal, and the
      treatment stays on show in `vanilla/` and the showcase

- [x] 5.10 **Owner, fifth round, 2026-08-26: "make it all extruded."** The
      showcase's hybrid is gone: seven per-node `extrude: true` collapse
      into one `extrude: true` in the draw options, and the two 220x46
      pills take `depth: 15` - a third of their height, the coin ratio,
      said once at `page` with `rng` named there. The notation key loses
      its `depth` line, because a register applied to everything
      distinguishes nothing; the register is stated once beside the key
      instead, the groups' refusal to extrude keeping the bands as regions.

      The page legislates its own geometry, and the moved `t` and `r`
      anchors falsified comments both ways. Rewritten to the new measured
      truth: the hop crossing (page's drop leans, react crosses it at
      (186, 196)); the fan's symmetry claim (-248, +15, +272 across and
      49, 47, 49 down - near-symmetric, said so); the crossing under the
      server-to-markup hop, now (705, 372); and the mcp fork's twenty px
      of shared trunk, gone with the moved anchor - the pair diverges at
      the anchor itself, the render still reads it as a fork, and the
      overlap number is dropped rather than re-measured. Re-drawn to keep
      the drawn intent: the three orthogonal runs' final vias shift right
      by the extrusion's x (440 to 452, 995 to 1007, 960 to 972), so a
      drop stays a drop; and the first note's arrowTo rises 266 to 257,
      six px above schema's slab back edge, the courtesy the flat top got.
      Verified surviving: the 52px row offset, "10px off geom", the
      y=190/y=200 spacing, the note's 20/30 corner clearances, and both
      braces clear the slabs: negative depth juts their ink toward the
      labels, away from the drawing, so the square bracket's nearest ink
      (its arms' open ends at x 1130) clears schema's slab at 1082 by 48,
      and the curly brace's spine at 1150 clears the checker slabs at
      1102 by the same 48, its tip at 1176 by 74 - read off bracePoints,
      not off an assumed sign.

      `npm run diagrams`: 0 errors, 0 warnings, showcase "no findings" -
      no label needed nudging. The delta's "showcase SHALL NOT carry it"
      is re-decided and recorded: `vanilla/` still introduces and teaches
      the register per node, the showcase applies it with one switch,
      owner-dated. The recording label and the README paragraph lose the
      split claim. Both GIFs re-recorded: light 980,133 bytes, dark
      1,017,258 - the all-extruded ink costs 33,612 and
      51,535 bytes over the hybrid's 946,521 and 965,723. Light frames
      read at 1.3 s, 4 s and the hold, the dark hold read in review:
      every box and the diamond carry slabs, both pills read as coins,
      the bands stay flat, the note pointer stops in clear water above
      schema's slab, and no label sits on ink

- [x] 5.11 **SWAT at the groups 4-5 boundary, 2026-08-26: one combined
      review over both groups - Sage, Wise and Adversarial, Truthful
      binding - findings T-102..T-113.** Three blockers: T-102, the
      mirrored-anchor call, and T-103/T-104, both remediated in this round.

      T-103: the depth-cost prose predated 5.6's corner rib and per-face
      hatch and no longer reproduced. Re-measured on the docs' own probe -
      one 150 x 46 box at seed 7, `renderToString` from dist, growth over
      the flat render, least squares over depths 100 to 1000 - the slope is
      **83.8 B per px** (was "about 80"), the fixed face cost as the d->0
      growth over flat is **4,558 B** (was 4,126), and one box at
      `depth: 1000` renders **90,303 B** = 90 kB (was 86). At
      `depth: 20000` the render is 6,388 paths and 1,690,153 B. Of the
      review's REJECTED claims, two matter to the record: group 5 added
      zero bytes to check - the growth the review first read as group 5's
      was 3.5's and the N-fixes' - and at 20000 both figures went stale,
      1.6 MB to 1.7 and 6,386 paths to 6,388. The units are decimal, the
      navigator proving it from the old build's own arithmetic (86,286 B
      was the "86 kB"), so the next re-measure need not re-litigate the
      convention. Every stale figure moved -
      docs/agents.md, both READMEs, the `depth` JSDoc - and the probe
      recipe stands beside the numbers, seed included, so the next
      re-measure can re-run it. `npm run resources` re-embedded the
      corrected spec; `npm run size` unmoved at 5313/3874/5306, JSDoc
      being free.

      T-104: the changeset, `.changeset/a-diagram-takes-depth.md`, naming
      core AND mcp at minor explicitly - `updateInternalDependencies:
      "patch"` would under-declare mcp on a core-only entry - with the
      parity guarantee stated. And 6.1's "peer floor" corrected to
      "dependency floor": the core range lives under `dependencies` in
      mcp's manifest, not in any peer field.

      Three OWNER CALLS left open, exactly as calls. T-102: mirrored
      extruded anchors land off the ink, and the delta's own "anchor
      follows the ink" passage argues for the fix Truthful priced by
      patching and rebuilding - +22 B core, +25 B check, +22 B server,
      all three green under it - against
      confining the promise to upright spellings. T-107: check stands at
      94 B free with conflicting margin precedents, and the T-102 fix
      would take it to 69. T-111: whether the three tools declare
      readOnlyHint/openWorldHint annotations - new public surface, so not
      assumed.

      The nits landed in this round: the two "nothing shipped extrudes"
      comments rewritten to the served truth (T-105), the README rows
      naming what vanilla and the showcase extrude (T-106), the depth
      description owning the boundary's refusal of a non-finite number
      with a protocol test pinning it (T-108), the printed GIF advice
      single-quoting its filtergraph so it pastes into zsh and bash
      (T-109), and the `-loop 0` comment saying the flag pins the muxer's
      default rather than causes the looping (T-110). Recorded rather
      than built: T-112 as a follow-up - resources.test.ts reaches the
      SDK-private `_registeredResources`, so migrate it to resources/list
      over the InMemoryTransport pair - and T-113's no-guard disposition
      on record.mjs options passthrough: a page's `options.theme` would
      fight `--theme` in silence and recorder-owned seed/label win by
      spread order, priced at nothing because no shipped file does it.

- [x] 5.12 **Owner on T-102, 2026-08-26: "FIX immediately."** The defect:
      `anchor` moved the sides *named* `t` and `r` by the extrusion vector,
      and on a mirrored spelling those names face screen-bottom and
      screen-left - sides the raised run never touches - so the moved point
      landed 9-15 px inside the slab, off any drawn ink, against the
      delta's own "lands on the silhouette's ink for every shape". The
      mechanism: the moved side is chosen off the screen geometry of the
      covered rectangle - with `w < 0` the side named `l` faces
      screen-right and moves while `r` does not, with `h < 0` named `b`
      moves and `t` does not - one ternary per axis at the single `anchor`
      site `draw` and `check` both resolve through, the upright path
      byte-identical by construction and the goldens unmoved to prove it.
      Measured against Truthful's +22/+25/+22 pricing: +18 B core (5331),
      +18 B check (3892), +16 B server (5322), all three green, check's
      free margin at 76 rather than the priced 69. Two tests, both proven
      on the broken code by stashing the fix: the symmetry witness -
      every mirrored spelling's anchor equals its upright spelling's,
      exact, no tolerance - failed on `r` at [212, 134] against [200, 143],
      and the ink witness - all four sides' anchors within 2 px of the
      nearest drawn segment, the bound measured at 1.62 px max over six
      renders with the broken mirrored `t` at 8.98 - failed with it.
      The ink witness earned its shape the hard way: the first draft
      asserted only the fix's own moved sides and passed against the
      broken code - a flat-resolving render sits on ink trivially - so
      the test now holds every side to the delta's sentence and guards
      that the slab actually drew, which is what made the stash proof
      mean something. Reworded to the screen-side truth stated in the named-side
      vocabulary: the core-renderer delta's anchor requirement, the
      diagram-checker delta's moved-anchors clause, design.md D3, the
      `anchor` JSDoc, README.md's anchor table note, docs/agents.md's
      "Anchors move" (resources regenerated), and the README comparison
      row 5313 -> 5331. The "edge meets the slab" scenario reads true
      under the fix and stands unchanged.

- [x] 5.13 **T-107, owner-ruled 2026-08-26: remove the conflicts.** The
      budget ledger had grown two margin readings: the 3520 passage rules
      that only a margin under measured toolchain noise (2 B) is no margin
      and that 100 B is not owed to a standing entry, while three later
      passages cited that same ruling as a 100 B floor - the root 5248
      raise claimed the file "already ruled a 20 B margin none" (it ruled
      an estimate unusable, not a margin none), the server 5312 raise
      called 99 B free "none" on the strength of a sentence that says the
      opposite, and the animation 768 raise called 90 B free "below the
      toolchain noise", which is false by a factor of forty-five. The
      owner removed the conflict rather than raising the budget: one rule
      now stands at the head of the list - re-decide when a number's
      stated basis goes false, at a green gate, at measured need plus the
      conventional 100 up to the next multiple of 64; judge a standing
      margin against measured noise - and the three false citations are
      corrected in place with a note that each raise also had the true
      reason, so no number moves. Under that rule `./check` at 3892 of
      3968 (76 B free after T-102, basis unfalsified) stands recorded in
      its own entry rather than raised.

- [x] 5.14 **T-111, owner-ruled 2026-08-26: proceed with the readOnlyHint.**
      All three tools now declare `annotations: { readOnlyHint: true }` -
      they compute from their arguments and touch nothing, and the hint's
      absence reads as false, so a host that honours it was asking for
      approval the tools never needed. `openWorldHint` was offered in the
      same finding and not taken; the owner named the one hint, so the one
      hint ships. The tools/list test now asserts the hint on every listed
      tool off the wire, and the pin was proven the stash way: annotations
      stashed out of the source, the assertion fails on `undefined`, popped
      and green at 583. Declared per tool rather than hoisted, because the
      next tool added should have to say what it touches.

## 6. Release

- [ ] 6.1 **OWNER**: core minor (0.7.0) via the release flow; `@pensketch/mcp`
      raises its core dependency floor to the minor that ships the pair;
      react and animation floors move only if a release actually exposes
      depth through them, which this change does not require
- [ ] 6.2 **OWNER**: publish order per the standing release order; tags land
      via `publish.yml`, never by hand
