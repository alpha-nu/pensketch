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

- [ ] 1.2 The rule gets a witness. A test scans a rendered fixture's whole
      serialization (path data and every attribute) and fails on any number
      carrying three or more decimals; a second pins `stroke-width="1.2"`
      exactly where `1.2000000000000002` was pinned before. Both proven by
      mutation: the round dropped from `pass()` alone goes red, dropped
      from `el()` alone goes red.

- [ ] 1.3 Price it, measured not estimated. `npm run size` on all entries
      against D7 (expected: root and `./server` move by the helper's cost,
      `./check` and animation do not move at all); the probe figure's
      render re-measured (28,277 B full → ~16.7 kB expected); the goldens'
      shrink recorded. A budget moves only if its tripwire fires, in its
      own commit, under the ledger's standing rule.

Gate: full suite, both parity goldens byte-identical to a fresh
`npm run goldens`, `npm run size` green.

## 2. The record catches up

- [ ] 2.1 The depth-cost probe re-runs (the T-103 recipe recorded in
      `docs/agents.md`, seed included) and all four documents move
      together: `docs/agents.md`, `README.md`, `packages/core/README.md`,
      and the `depth` JSDoc in `packages/core/src/types.ts`.
      `npm run resources` re-embeds the corrected spec. Any other committed
      byte figure found by grep moves in the same commit or is listed here
      as deliberately historical.

- [ ] 2.2 Committed rendered assets re-render from the new bytes: the hero
      PNGs, both README GIFs, the showcase figures. `npm run diagrams` and
      the animation check green; GIF weights recorded (they should shrink
      or hold — the encoder sees near-identical frames).

- [ ] 2.3 The changeset — core and mcp, both minor, the output-moves
      language CONTRIBUTING requires — and `openspec validate --strict`
      clean on this change.

Gate: all gates green from a cold tree in dependency order; /swat at the
boundary; every Truthful finding remediated before hand-off.

## 3. Release

- [ ] 3.1 **OWNER**: push; the Version PR folds this into the pending
      minors (core 0.9.0, mcp 0.11.0 expected); merge, Publish,
      `npm run deploy`.
