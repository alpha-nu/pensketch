# Tasks: a-coordinate-earns-its-digits

A group is done when the verification commands in `CONTRIBUTING.md` are green
from a cold tree and every finding from a self-review of the diff is fixed.
Items marked **OWNER** are performed by the repo owner. The ceremony is
codex-operandi: driver and independent navigator per task, one commit per
task, /swat at the group boundary, every finding binding.

## 1. The round lands

- [x] 1.1 Both sides of the parity gate in one commit. The reference's `el`
      and `pass` round every written number to two decimals; `pen.ts` takes
      the same round at its `pass()` template and `el()` stringification;
      `npm run goldens` regenerates both goldens from the reference; the
      parity tests hold at the new bytes; the pinned float-noise literal in
      `pen.test.ts` moves to `'1.2'`. One-off proof recorded here: old and
      new golden path data parsed pairwise, maximum per-coordinate
      displacement ≤ 0.005 (the analytic bound), element counts identical.
      Before/after render pair produced for the owner's eye at the group
      boundary. Full suite, typecheck, lint, build — by exit code.

      **Landed, driver and navigator each measuring independently.** The
      round sits at the two funnels and nowhere upstream — `grep round2`
      shows the definition and five call sites, `j()` and all geometry
      full precision. Proof, the navigator's own run: sampler 122
      elements, 1,616 numbers compared pairwise, max displacement
      **0.0049984**; budgets 106 elements, **1,656** numbers (the driver
      first reported 1,664; the navigator's count stands), max
      **0.0049959** — both under the 0.005 analytic bound, and the
      non-numeric residue of every line byte-identical, a digits-only
      diff. Bytes: sampler 38,450 → 22,103 (−42.5%), budgets
      37,743 → 21,185 (−43.9%). Regeneration is a fixed point
      (consecutive `npm run goldens` hash-identical) and the port-side
      round is load-bearing: the mutation dropping it from `el()` alone
      fails parity 4 of 4, restored to a byte-identical diff.

      One tolerance fired and taught the general lesson: read-back
      assertions bounded at exact jitter half-widths now sit 0.005 under
      what the file itself declares, so `pen.test.ts` carries the quantum
      in its `spread`/`damped` helpers (its one strictness assertion gets
      stricter, not weaker), and the same latent bound in
      `draw.test.ts` (both `expectNear` and the loop-anchor literals) and
      `geometry.test.ts` (`BOUND`) was widened in the same commit rather
      than left to fire on the next legitimate byte move. The one writer
      outside both funnels — `label`'s raw `size` in a style string — is
      recorded in design.md D4 as caller data, parity-symmetric, deferred
      until a fractional size exists.

- [x] 1.2 The rule gets a witness. A test scans a rendered fixture's whole
      serialization (path data and every attribute) and fails on any number
      carrying three or more decimals; a second pins `stroke-width="1.2"`
      exactly where `1.2000000000000002` was pinned before. Both proven by
      mutation: the round dropped from `pass()` alone goes red, dropped
      from `el()` alone goes red.

      **Landed as `precision.test.ts`, and the spec learned its own
      carve-out.** The blanket "every attribute value" scenario written at
      proposal time was falsified by the renderer itself: an `order`
      render stamps `--ps-i` at three decimals by design (its thousandths
      are 1,000 distinct stagger steps), so the requirement and the
      witness both carve out the `style` attribute — text composed
      upstream of the funnel — and text content, the caller's words. The
      carve-out is exercised, not decorative: a second test asserts the
      unstripped file does hold a three-decimal `--ps-i`.

      The scan reads the shared serializer over a SAMPLER spread extended
      with a bow (labelled at fractional lx/ly), a self-loop and a brace,
      rendered with `order: true` and `extrude: true`. Green is not
      evidence, so the witness also demands ≥1,000 numbers of one or two
      decimals — measured 2,978 on the clean tree, and collapsing to 383
      with both funnels gutted (the navigator's own run), so the floor is
      a real tripwire. Mutants, both runs reproduced by the navigator:
      `pass()` unrounded = 2,544 offenders, `el()` unrounded = 66 (the
      float-noise class), each caught by the offenders-by-name assertion
      while the sparing test stayed green — the two are not entangled.
      Both wording nits folded (the style text's composer named exactly;
      "every closed shape" narrowed past the never-extruding group).

- [x] 1.3 Price it, measured not estimated. `npm run size` on all entries
      against D7 (expected: root and `./server` move by the helper's cost,
      `./check` and animation do not move at all); the probe figure's
      render re-measured (28,277 B full → ~16.7 kB expected); the goldens'
      shrink recorded. A budget moves only if its tripwire fires, in its
      own commit, under the ledger's standing rule.

      **Priced against a cold build of the pre-change commit** (a
      scratchpad worktree at dc19213, `npm ci`, full build, the same
      `check-size.mjs`), not against numbers remembered from older
      ledgers: core 5570 → 5595 (**+25 B**, 101 free of 5696), server
      5556 → 5584 (**+28 B**, 112 free), `./check` 3898 → 3898
      (**exactly nought** — it serializes nothing, as D7 predicted),
      react and animation unmoved. No budget tripwire fired; the one
      that did fire was designed to: the size gate's README pin went red
      at 5570 vs 5595, and the comparison row moved with the
      measurement. Both "about 5.5 KB" claims still true at 5595.

      What the bytes bought, on the library's own outputs: the probe
      figure (947 B of diagram JSON) renders 28,277 → **16,740 B**
      (−40.8%) plain and 33,267 → **21,730 B** (−34.7%) animated; the
      goldens 38,450 → 22,103 and 37,743 → 21,185 (task 1.1). About 25
      code bytes purchased eleven and a half thousand per typical
      render, every render.

Gate: full suite, both parity goldens byte-identical to a fresh
`npm run goldens`, `npm run size` green.

## 2. The record catches up

- [x] 2.1 The depth-cost probe re-runs (the T-103 recipe recorded in
      `docs/agents.md`, seed included) and all four documents move
      together: `docs/agents.md`, `README.md`, `packages/core/README.md`,
      and the `depth` JSDoc in `packages/core/src/types.ts`.
      `npm run resources` re-embeds the corrected spec. Any other committed
      byte figure found by grep moves in the same commit or is listed here
      as deliberately historical.

      **Re-measured, driver and navigator byte-agreeing, after one piece
      of archaeology the recipe now spares the next reader.** The recorded
      recipe omitted the probe box's position; recovered as 40, 40 by
      reproducing all five old figures byte-exact on a cold build of the
      pre-change commit (slope 83.8164, growth 4,558 at d=1, 90,303 at
      depth 1000, 1,690,153 and 6,388 paths at 20000) — and the position
      is load-bearing, three other positions give three other totals, so
      the recipe in agents.md and the JSDoc now name it. New figures:
      slope **55.7807** ("about 56 B per px"), fixed face growth
      **2,920 B** at d=1 (2,916–2,926 over d ∈ [0.0001, 5]), depth 1000
      **59,628 B** ("60 kB"), depth 20000 **1,182,541 B** ("1.2 MB") over
      an unchanged **6,388** paths — rounding drops digits, never paths.
      Resources regenerated idempotently (hash-stable), schema a no-op.

      One more stale figure the grep caught at review: `tools.ts`'s
      "2.5 KB of correct markup" comment, a measured claim from the
      refusal-gate change, re-measured at 1,559 B and moved to 1.5 KB.

      **Deliberately historical, each with its reason:** the GIF pricing
      in `tools/showcase-recording.mjs` (encoder output, 2.2 records the
      new weights); `openspec/specs/repo-tooling/spec.md`'s KB figures
      (that spec's own dated measurement record); `content/posts/*/
      preview.html` (published posts, records of what shipped);
      everything under `openspec/changes/archive/` and every CHANGELOG,
      by rule. Not stale: the 5,595 B library rows (group 1's own
      measurement), the mcp 1 MB body cap and 30 KB input bound (caps,
      not measurements), `tools.ts:217`'s 122 KB findings figure
      (checker text, upstream of both funnels).

      **Surfaced, not settled here:** `tools/build-showcase.mjs`'s
      `trim()` is now a no-op with a falsified JSDoc — its removal rides
      2.2, whose rebuild is what proves it dead. And the timing and heap
      figures beside the byte figures (0.46 ms, 38 ms, 34 MB) were left:
      they are not byte figures, no method is recorded for them, and the
      driver measured they do not reproduce even on the old build
      (29.8 ms median, 29.2 MB heap delta under a controlled method;
      render time unmoved by the round, heap −14%). Re-measuring them
      with a recorded method is its own decision, carried to the owner.

- [x] 2.2 Committed rendered assets re-render from the new bytes: the hero
      PNGs, both README GIFs, the showcase figures. `npm run diagrams` and
      the animation check green; GIF weights recorded (they should shrink
      or hold — the encoder sees near-identical frames).

      **Landed — and the showcase page turned out to be the proof rather
      than the work.** `trim()` in `build-showcase.mjs` was the round,
      page-local, applied since 15c9bb8 with the exact formula core now
      owns; the generator's output without it is byte-identical to its
      output with it and to the committed page (hash-stable across three
      runs, one on a cold dist), so the function is removed as proven
      dead and `docs/showcase/index.html` does not move at all — the
      page-level workaround simply became the library's law.

      Assets, all deterministic (every regeneration hash-identical on a
      second run, the light GIF reproduced byte-exact by the navigator
      from the recorded header command): hero PNGs 1760×600 unchanged,
      light 134,573 → 134,406 B, dark 135,519 → 135,937 B — sub-pixel
      antialiasing re-deflation, proven by pixel comparison (0.95% of
      pixels touched, peak channel delta 18% of range: no stroke crossed
      a pixel boundary); GIFs 2010×1200, 128 frames unchanged, light
      980,133 → 877,894 B, dark 1,017,258 → 890,210 B. The GIF shrink is
      multi-cause — the old recordings predate the constant-speed
      gesture work — so the weights are recorded without charging the
      whole delta to the round. `npm run diagrams`, the animation check,
      lint and the suite all green by exit code.

- [x] 2.3 The changeset — core and mcp, both minor, the output-moves
      language CONTRIBUTING requires — and `openspec validate --strict`
      clean on this change.

      **Written as `.changeset/a-coordinate-earns-its-digits.md`**, core
      and mcp named minor explicitly (the T-104 reading: mcp's rendered
      output is core's, and a dependency-only patch would claim a
      byte-stability this version does not have), the output-moves
      sentence up front so a snapshot-testing consumer reads why every
      snapshot moved before reading anything else. It folds into the
      pending release beside the three gesture-work changesets.
      `openspec validate a-coordinate-earns-its-digits --strict` exits 0
      on the final tree.

Gate: all gates green from a cold tree in dependency order; /swat at the
boundary; every Truthful finding remediated before hand-off.

## 3. Release

- [ ] 3.1 **OWNER**: push; the Version PR folds this into the pending
      minors (core 0.9.0, mcp 0.11.0 expected); merge, Publish,
      `npm run deploy`.

- [ ] 3.2 **OWNER (T-118a)**: decide whether the timing and heap figures
      still published beside the byte figures — "38 ms", "34 MB of heap",
      "under a millisecond" in `README.md`, `docs/agents.md` and the
      `depth` JSDoc — get re-measured under a recorded method. They are
      not byte figures, no method was ever recorded for them, and a
      controlled counter-measurement (29.8 ms median, 29.2 MB heap
      delta) does not reproduce them even on the pre-change build; they
      err conservative, which is why shipping them another release is
      tolerable and leaving them forever is not.

- [ ] 3.3 **OWNER (T-118b)**: rule on CONTRIBUTING's golden-change letter
      — "Such a commit carries a before/after PNG pair showing the
      shift" — against this change's practice: the pair was produced for
      the owner's eye at the boundary and paired with a measured bound
      (≤ 0.0049984 units of displacement), not committed as ~270 KB of
      binary showing two indistinguishable pictures. bced142 is the
      repository's first intended golden change, so the ruling sets the
      precedent: amend the CONTRIBUTING sentence, or bind the next
      golden change to its letter.
