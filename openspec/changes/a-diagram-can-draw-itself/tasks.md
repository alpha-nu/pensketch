# Tasks: a-diagram-can-draw-itself

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

Group boundaries carry a `/swat` round. Group 1 is a budget move and nothing
else, because a budget SHALL be raised in advance of the work that needs the
room and never at a failing gate.

## 1. The budgets, before any code

- [x] 1.1 Move `@pensketch/core/server` from **4300 to 4480**, in its own
      commit, with the arithmetic: the prototype measured **4374** against the
      0.5.0 tree, plus the conventional 100 B of gzip headroom is 4474, taken
      up to the next multiple of 64.

      `./server` is the entry that binds because it bundles its own copy of
      `draw`. The root entry lands at 4373 against 5120 and does not move;
      `./check` lands at 3394 against 3520, which is toolchain noise rather
      than this change — `check.ts` imports constants, sample and types, never
      `draw`.

      **Built and measured, against those estimates**: `./server` 4378 rather
      than 4374, the root entry 4380 rather than 4373, `./check` 3391 rather
      than 3394. The two that moved up did so because the fraction is truncated
      on an integer numerator rather than rounded — `toFixed` rounds, and from
      2000 elements up it wrote `1.000`, outside the `[0, 1)` the option
      promises. 102 B free against 4480

- [x] 1.2 Give `@pensketch/animation` a budget of **704 B** min+gzip. The
      prototype measured **546**; plus 100 is 646, taken up to the next
      multiple of 64.

      A budget set from a prototype rather than from the finished package, so
      it is a claim about how big this should be and not a record of how big it
      turned out. If the finished package exceeds 704 the number is re-decided
      deliberately, with the reason written where it is declared — not raised
      at the gate that caught it.

      **The finished package measures 614**, 68 B above the prototype — and the
      number *was* re-decided, to **768**, which is what this clause asks for.
      614 fits 704 and nothing failed; what failed was the arithmetic, which
      left 90 B where this repository's standard is 100. A margin smaller than
      the 2 B of gzip noise an entry has already been measured moving on
      identical code is not a margin. 614 plus 100 is 714, taken up to 768.

      The budget's *number* landed in group 1; its line in `tools/check-size.mjs`
      landed with the package, because that gate reads a built file from disk
      and fails when there is none, so declaring it earlier would have held CI
      red across every commit in between

- [x] 1.3 Three files name a budget literally and all of them move together:
      `tools/check-size.mjs`, `CONTRIBUTING.md`, and this change's
      `repo-tooling` delta. `openspec/specs/` is written at archive time

- [x] 1.4 **T-07**: add `@pensketch/animation` to `tools/check-exports.mjs`,
      which lists four entries today and gates every published one in CI. A new
      package that never joins it ships with its exports map and its dts
      rollup unverified — including the string-side rules export 3.8 requires,
      which nothing else would load

## 2. `order` in the renderer

- [x] 2.1 `DrawOptions` accepts `order?: boolean`, default `false`. With it
      unset the output SHALL be byte-identical: no `--ps-i`, no `pathLength`, so
      parity with the read-only `reference/renderer.html` holds and every
      golden stands unregenerated

- [x] 2.2 Record where each phase of `draw` ends — after the groups, after the
      edges, after the non-group nodes — and stamp from those three numbers.
      Nothing is reordered in the document; only the number differs from
      document order

- [x] 2.3 Hand order is: group frames, then node shapes, then connectors and
      their arrowheads, then braces, notes and `raw`, then **every piece of
      text**. Within a phase the pen's own order stands, which is already hand
      order — a connector is emitted before its barbs, a shape before its hatch

- [x] 2.4 `--ps-i` is a 0..1 fraction to three decimals, written into the inline
      `style` **ahead of** whatever style the element already carries, so a
      `<text>` keeps its fill and font-size

- [x] 2.5 `pathLength="1"` on every path that carries **no**
      `stroke-dasharray`, and on no other element. A dashed stroke's dashes are
      the drawing, and `pathLength` rescales them into a solid line — measured
      at 90 inked px of 400 plain, 400 of 400 with it

- [x] 2.6 Tests: hand order puts every shape before the first connector and all
      text last; no dashed path carries `pathLength` and every undashed one
      does; `order: false` output is byte-identical to the golden; a bare `pen`
      is uninstrumented

- [x] 2.7 Mutation-check: remove the dashed guard and confirm the dotted
      assertion fails; break the phase ranking and confirm the order assertion
      fails. On the prototype these failed at `1px | 1px` and 9 of 45 pending
      respectively — a test that stays green with the primitive gone is not
      evidence, and on this repository one has done exactly that

## 3. `@pensketch/animation`

- [x] 3.1 Scaffold the package on the same shape as `@pensketch/react`: dual
      format, types, `sideEffects: false`, `@pensketch/core` as a peer for the
      reason the react bindings already give — two renderers resolved silently
      is worse than an install-time failure.

      **T-05**: the range is floored at the core minor that ships `order`, not
      opened across `0.x`. An open range admits core 0.5.0, which stamps no
      `--ps-i`, and that install is the version skew nothing here can detect at
      runtime. The repo-tooling internal-range rule permits a compound peer a
      release leaves alone.

      **Shipped `>=0.5.0 <1.0.0`, and the floor is deferred to the release
      commit** — measured, not conceded: 0.5.0 is the newest core the registry
      has, so `>=0.6.0 <1.0.0` fails a cold `npm install` with ETARGET and
      writes no lockfile at all, leaving `npm ci` nothing to run from;
      `--legacy-peer-deps` writes one that `npm ci` then rejects for the same
      reason. What makes the floor writable is core carrying 0.6.0 in the same
      tree, where npm satisfies the peer from the workspace link and never asks
      the registry — so the raise and the release that makes it installable are
      one commit. `packages/animation/test/manifest.test.ts` asserts that
      pairing and goes red in exactly that commit, verified in both directions.
      Changesets will not do it: a floor a minor below the new version still
      satisfies it

- [x] 3.2 `animate(svg, options?)` injects a `<style>` as the svg's **first**
      child and sets the timing custom properties on the root. It runs after
      `draw`, which empties the element and would otherwise take the `<style>`
      with it — stated in the doc comment, because the ordering is not
      guessable

- [x] 3.3 The rules are a **constant**, never generated per diagram, so two
      diagrams on one page carry byte-identical blocks and cannot fight. What
      differs between them rides on custom properties on each root — verified
      on the prototype at `--ps-dur: 2s` and `5s` side by side

- [x] 3.4 Scope with implicit `@scope`. A `<style>` in an inline `<svg>` is
      document-wide otherwise. Nothing is stamped on the caller's element.

      The measurement that stood here — "a second unrelated SVG on the page had
      its paths dashed and offset" — was taken **before 3.7 moved the starting
      state inside the keyframes**, and 3.7 falsified it. An unrelated SVG
      carries no `--ps-i`, so the shorthand is invalid at computed-value time and
      the rules are inert on it: measured with `@scope` stripped, a foreign SVG
      kept its `4px, 6px` dashes, its `0.6/0.55` opacities and `animation:
      none`. The neighbour that *can* fail is **another drawing `draw`
      stamped** — a second diagram rendered with `order` and left unanimated —
      where all 24 of 24 elements began running the reveal. A prototype's
      measurement outlives the prototype; this one did, and the test that
      would have passed either way is why it was caught

- [x] 3.5 The delay rides **inside** the `animation` shorthand, where the first
      `<time>` is the duration and the second the delay. A delay in a separate
      lower-specificity rule is reset to zero by the shorthand and the whole
      drawing lands at once — this cost a red test on the prototype and is the
      reason the clause exists

- [x] 3.6 A dashed path is revealed on `stroke-opacity`, which is a separate
      channel from the `opacity` attribute the pen weights its two passes with,
      so both the dots and the pressure survive

- [x] 3.7 **T-03**: no property that hides a stroke is set outside the
      keyframes. The starting state goes in the `from` block with `both` for
      the fill mode, so an element with no animation running is one the
      stylesheet has not touched.

      This replaces the per-channel reduced-motion reset that stood here, which
      **T-04** struck as redundant: with nothing set outside the keyframes there
      is nothing to reset, and `animation: none` alone yields the pen's own
      values. Measured — against a control of 401 inked px, a missing `--ps-i`
      renders **0** with the starting state outside the keyframes (a blank
      frame, the outcome the `@scope` clause calls unacceptable) and **401**
      with it inside. The variant is also *smaller*: 238 B gzip against 241

- [x] 3.8 **T-06**: the reduced-motion block is at least as specific as the
      rules it switches off. A lower-specificity `animation: none` loses to the
      selector that set the shorthand and the drawing keeps running under
      `reduce` — measured mid-flight at a `stroke-dashoffset` of 0.345386. Same
      trap as 3.5, in the other direction

- [x] 3.9 A string-side helper for markup rather than a live element.
      `renderToString` returns the **contents** of an `<svg>` and the caller
      supplies the wrapper, so the helper SHALL NOT assume there is an `<svg>`
      tag to inject into — expose the rules so a caller holding only children
      can place them

- [x] 3.10 Browser tests, at least the ten the prototype passed: mid-draw state;
      a second diagram on the page untouched; dashes intact; two-pass opacity
      intact; every shape before the first connector; text last; reduced motion
      finished at once with dots and pressure intact

- [x] 3.11 Mutation-check: unwrap `@scope` and confirm the neighbouring-diagram
      test fails. The neighbour has to be a second **stamped** diagram — see
      3.4, where the leak an unrelated SVG would have shown no longer exists.

      **Unwrap** means the at-rule *and* the `:scope>` qualifier on all three
      selectors. Deleting the at-rule alone leaves the check green and looking
      like decoration: with no scoping root `:scope` resolves to the document
      root, so `:scope>path` matches nothing and the rules apply to nobody.
      Measured — that mutation kills checks 5, 6 and 8 and leaves 2 passing.
      The document-wide form is the one that puts 24 of 24 elements of the
      unanimated diagram into the reveal

## 4. The two consumers

- [x] 4.1 `render_diagram` accepts `animate`, returning one self-contained
      `<svg>`. Its parameter description is what an agent reads before any
      resource, so it says what comes back and that it needs nothing else

- [x] 4.2 `render_png` SHALL NOT accept `animate`. A raster cannot animate, and
      the tool boundary refuses what it cannot carry rather than accepting a
      field it will ignore

- [x] 4.3 `@pensketch/mcp` takes `@pensketch/animation` as a dependency — it is
      spawned rather than bundled and carries no byte budget, so the cost is
      the tarball figure already reported at build time

- [x] 4.4 `PenSketch` accepts `animate` — **a function, not a flag** — applied
      inside the drawing effect after `draw` fills the element, and drawing with
      `order` whenever it is present. The effect stays synchronous.

      **T-10**: the StrictMode assertion needs a mutation that fails it, as 2.7
      and 3.11 have. Accumulation is unreachable while `draw` clears children,
      so the mutation is calling the function twice in one effect — and the
      reachable bug is the opposite one: applying it in an effect declared
      *before* the drawing effect leaves **zero** stylesheets, because effects
      run in declaration order and `draw` clears what the earlier one inserted

- [x] 4.5 **Decided — `@pensketch/react` declares nothing.** Not a dependency,
      not a peer, not an optional peer. The prop takes the function and the
      consumer imports it, so the manifest keeps exactly the two peers it has
      and `packages/react/test/manifest.test.ts` stands unedited.

      **T-08**: the "or is a regular dependency" this task used to offer was
      already forbidden by this change's own `repo-tooling` delta and by a
      passing test — an option the same change excludes is not a decision to
      leave open.

      Settled by a SWAT round after four shapes were measured. A **required
      peer** taxes every consumer 546 B — more than `@pensketch/react` weighs —
      for a prop most never set, and no gate here can see it: a peer is external
      to the entry `npm run size` measures, which reports 526 B declared against
      819 B inlined and passes both. An **optional peer with a static import**
      is a required peer wearing the wrong label; measured in two bundlers, a
      named import of an absent optional peer fails the consumer's build and a
      namespace import throws at load, and no gate here can catch it either,
      because a workspace symlink resolves it in every one of them. A **dynamic
      import** works but makes the effect asynchronous, which is what makes
      cleanup necessary and costs the requirement that says it is not. A
      **subpath entry** was measured too: it forces `splitting: false` into the
      react config and inlines a second complete copy of `PenSketch`, 444 B
      gzip, for anyone importing both.

      The core peer's argument does not carry over, and saying why is the
      deliverable here: core is a peer because the bindings *call* it and two
      copies would render one seed two ways. The motion arrives from a caller
      who already imported it, and its rules are a constant, so two copies
      cannot disagree.

- [x] 4.6 **T-09**: `animate` is held in a ref and kept out of the drawing
      effect's dependency array, and the consequence is documented — changing
      the function's identity does not re-animate.

      A function prop is compared by identity and the natural way to pass
      options is an inline arrow, which is fresh on every render. In the
      dependency array that restarts the drawing from blank each time the
      parent re-renders — and `examples/react/src/App.tsx` re-renders on a
      1400 ms interval, so the repository's own example would show it. This is
      the third instance of a hazard the component documents twice already; the
      first two redraw to a pixel-identical picture and this one is visible,
      which is why it is closed rather than documented again

- [x] 4.7 **T-13**: do **not** add a gate asserting the built entry imports
      only what the manifest declares. It was measured that an undeclared import
      is silently inlined and every existing gate passes, which is a real hole —
      but under 4.5 the react package imports nothing to forget, so the gate
      would cost a tool, a CI step and a maintenance surface against an input
      that cannot arrive. Recorded here so the reasoning is reversible: if any
      package here ever takes a static import of an optional peer, build it

## 5. What people read

- [x] 5.1 `examples/animation` — which exists in the working tree, untracked,
      carrying the hand-rolled prep — is committed, loses that prep, calls
      `animate` instead, and joins `tools/shipped-diagrams.mjs` so
      `npm run diagrams` checks its five panels. Its two deliberate defects go
      with the prep.

      It must be `git add`ed before any gate can see it, and the folder count
      in the `documentation-and-examples` requirement is what catches an example
      that is added without being wired in.

      **Done.** The page now makes two calls per panel — `draw(..., { order:
      true })` then `animate(svg, { duration: 1600 })` — and stamps nothing: no
      `pathLength`, no `--ps-i`, no `--t`, no `--pdur`, and no `@keyframes` of its
      own anywhere in the file. `npm run diagrams` reports **15 diagrams, 0
      errors, 0 warnings**, five of them these panels.

      Three things came with the removal that were not on the list. The
      per-element delay used to be gated on a `.go` class, so removing the
      hand-rolled rules removed what held a panel back until it was scrolled
      to — the package's rules run the moment its `<style>` lands. The page
      therefore draws every panel at load (which is what makes the figures
      under each one measured rather than written down, and what
      `shipped-diagrams.mjs` collects) and calls `animate` on arrival, with
      `visibility` the only thing `.go` still controls. Second, the JSON data
      carried 19 literal non-ASCII glyphs in label strings — `CO₂`, `NADP⁺`,
      `e⁻` — against CONTRIBUTING's rule that a string reaching rendered
      output uses `\uXXXX`; all 19 are escaped. Third, `shipped-diagrams.mjs`
      needed a slightly wider stand-in: an `animate` that does nothing, an
      element that has no children, and a `querySelectorAll` that finds none,
      so the chrome a page hangs off what it drew is skipped rather than
      faked

- [x] 5.2 `examples/react` demonstrates the prop, and is the second of the two
      surfaces the feature has. It declares `@pensketch/animation` among its own
      dependencies — as it already declares the core — imports `animate`, and
      passes it, because a caller importing the function is the whole of what
      the bindings ask and an example that skipped it would not be showing the
      API.

      It carries this rather than a seventh folder because it is already the
      only place the React-specific failures can show themselves: `main.tsx`
      wraps the app in StrictMode so every effect runs twice, and `App.tsx`
      steps the diagram on a 1400 ms interval, so the component re-renders
      without being touched. A doubled stylesheet, a missing one, and a drawing
      that restarts on every render are all visible there and in no quieter
      example — and a folder built to demonstrate the feature rather than to be
      a picture is what the requirement refuses.

      Pass `animate` as a stable module-scope reference, not an inline arrow.
      The example is where a reader copies from, and an inline arrow is the
      identity trap 4.6 exists to close, written into the thing people copy.

      **Done.** `@pensketch/animation` is a `file:` dependency beside the core,
      `App.tsx` imports `animate`, and what the prop receives is `drawItself`, a
      module-scope constant. It is a wrapper rather than `animate` bare because
      the package's default duration is 2000 ms against a 1400 ms step: every
      frame would be interrupted part-drawn. `STEP_MS - 400` leaves the drawing
      400 ms to be looked at finished before the next stage arrives

- [x] 5.3 **Screenshot-verify both examples after the prop lands.** The
      requirement asks for it after any API change, and it is not a formality
      here: **no workflow builds the examples at all**, so nothing else would
      notice that `examples/react` had gained a dependency it cannot resolve, or
      that `<PenSketch animate>` drew nothing. Both examples are opened and
      looked at, and what was seen is written into the task.

      **Both opened in local Google Chrome through `playwright-core`**, the
      same channel `tools/check-animation.mjs` drives, at 1280x900 and
      1100x1000; the repository served over HTTP for the page and `npm run dev`
      for the app. Screenshots taken mid-draw and finished, and looked at.

      `examples/animation`: **five** panels, each animating. Mid-draw counts,
      of the elements each `<svg>` holds: overview 1/96 drawn with 95 in
      flight, zoom 1/75 with 74, light 1/167 with 166, calvin 1/113 with 112,
      loop 1/37 with 36 — and every one of them at drawn == total with zero
      animations running two seconds later. Exactly one `<style>` per drawing,
      never two. In the shot of panel 3 caught early the group frame is on the
      page and nothing else is, which is the hand order rather than document
      order. The loop panel's two dotted connectors carry no `pathLength`
      against 26 of 26 solid paths that do, and they render as dots in the
      finished shot — the second defect, gone and photographed. *Draw it again*
      leaves one stylesheet and 36 animations running, so the redraw
      re-animates rather than doubling. Under `prefers-reduced-motion: reduce`
      the panel is visible, complete at 96/96, with no animation on it. The
      figures the page prints are measured: 80/64/146/98/28 paths, and a footer
      tally of 5 panels, 416 paths, 208 strokes, 184 KB.

      `examples/react`: the diagram animates on **every** step. Sampled every
      100 ms for six seconds while it walked its five stages, the count of
      stylesheets inside the `<svg>` was **1 at every sample** — not two under
      StrictMode, and never none — and the count of finished elements reached
      **0** in the middle of the run, which is a drawing that had restarted
      from blank. One step caught in the act: 0 of 91 drawn with 91 in flight,
      then 91 of 91 with none running 1.1 s later. The seed control does the
      same on demand (0 -> 91). Stopped, the picture stands finished and still.
      The `useSketch` caption is untouched throughout, at its own four
      elements. No page error and no console error in either, at any point —
      the one 404 in each run is `/favicon.ico`, which neither page declares

- [x] 5.4 Whether any of its five panels is **served** as an MCP resource is a
      separate decision and the measurement says no: they cover nothing the
      five already served do not, and miss braces, hatch, notes, note arrows,
      self-loops, diamonds, loop tuning and `size`. Default is that the folder
      ships and no new `pensketch://example/` key is added.

      **Held.** `KEYS` in `tools/generate-resources.mjs` is untouched and the
      generator still writes five examples; the panels are loaded, checked, and
      served to nobody

- [x] 5.5 `docs/agents.md` — it is `pensketch://spec`, generated into the MCP
      source and CI-asserted, so this is where an agent learns the feature
      exists. One section: the boolean, what comes back, and the `@scope`
      degradation stated plainly.

      **Done**, as *Making a diagram draw itself*. The option list for `draw`
      above it was also incomplete — it enumerated `seed`, `hops`, `theme` and
      `label` and had never mentioned `order`, which is the one an agent has to
      pass for any of this to work. `npm run resources` regenerated and the
      tree is otherwise clean

- [x] 5.6 `README.md` where it lists what the packages do, and the new
      package's own README, which stands alone on npm.

      **Done.** The root README gains an install paragraph for the package, a
      *Making a diagram draw itself* section, and the animation folder in the
      examples table — where it also corrected "the two HTML pages", which had
      been four before this change made it five. `packages/animation/README.md`
      did not exist; `npm publish --dry-run` now shows it in the tarball at
      6.6 kB, beside `dist` and `LICENSE`. Its snippets are the package's own
      `@example` blocks from `src/animate.ts` and the React one from
      `packages/react/README.md`, copied rather than composed, because
      Appendix A predates all three of them

- [ ] 5.7 **OWNER**: a changeset. Core **minor** — a new option, and output
      that changes when it is set. `@pensketch/mcp` **minor** — a new tool
      parameter. `@pensketch/react` **minor** — a new prop.
      `@pensketch/animation` at its first published version. It states the
      `@scope` degradation, and that nothing drawn moves when `order` is unset

- [ ] 5.8 **OWNER**: `@pensketch/animation`'s **first publish will fail
      `ENEEDAUTH`**, and the failure will read like a broken secret.
      `publish.yml` carries no `NPM_TOKEN` on purpose — each package has a
      trusted publisher naming this repository and that file — and its own
      comment records that the relationship *"could only be created once the
      packages existed: `npm trust` refuses a name the registry has never
      seen"*. A fourth package has never been seen. So 0.1.0 goes out with a
      token, exactly as core's did, and the trusted publisher is created
      afterwards; nothing after that needs one.

      Found in review rather than at the release, which is the only reason it
      is written here: the workflow's comment says an `ENEEDAUTH` there logs
      nothing above verbose and looks like a credential fault, so the hour lost
      to it would have been spent on the wrong thing.

      **And the failure does not stop the others.** `changeset publish` maps
      every unpublished package through one `Promise.all` — verified in the
      installed source, and there is no topological sort anywhere in
      `@changesets`. So the three packages that *do* have a trusted publisher go
      out in the same run, and `@pensketch/mcp` lands declaring a dependency on
      an `@pensketch/animation` that is not on the registry. `npx @pensketch/mcp`
      is the install path every agent user takes, and it would be broken from
      that moment until animation is published — with Publish being the
      irreversible half.

      So the order is: **publish `@pensketch/animation` by hand from the merged
      commit, with a token, and create its trusted publisher — before
      dispatching Publish.** `getUnpublishedPackages` then skips it and the
      other three go out with provenance as usual
