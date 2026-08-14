# Tasks: check-sees-two-labels-in-one-place

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

## 1. The decision, then the budget

- [x] 1.1 Build both shapes and measure each on `./check`

      Settled by the owner before the second was built: **a separate
      `text-collision` id**, not a widening of `label-collision`, whose
      messages name "the label on edge 3" and would be wrong for a pair of node
      labels. Measured **+171 B** as first written, then **+93 B** optimised —
      3297 to **3390** — which fits 3392 with two bytes to spare
- [x] 1.2 **OWNER**: choose — answered, separate id
- [x] 1.3 **OWNER**: move the budget to **3520**, in its own commit, with the arithmetic:
      3390 plus the same 100 B of gzip headroom is 3490, taken up to 3520.

      Moved although the rule fits without it, and the reason is recorded
      rather than assumed: this repository has measured `./check` gaining
      **2 B of gzip on identical code** when esbuild renamed locals, so a
      two-byte margin is the noise rather than a margin, and a gate that goes
      red on a toolchain bump is the thing the requirement forbids. If the
      owner would rather keep 3392 and ship at 3390, this task is struck and
      1.1's figure stands as the record of why it was close

      Put to the owner with the measurement that it fits at 3390/3392 and the
      argument that two bytes is inside noise this repository has measured, and
      answered: move it. Done — 3392 to 3520 in the three files that own the
      figure, and in no others
- [x] 1.4 `repo-tooling` and `CONTRIBUTING.md` both name the figure literally,
      so all three files that own it move in the same commit

      `tools/check-size.mjs`, `CONTRIBUTING.md`, and this change's new
      `repo-tooling` delta, whose five scenarios are carried word for word with
      `3392` -> `3520` the only edit. `openspec/specs/` is written at archive
      time, not now

## 2. The rule

- [x] 2.1 Box every piece of text the drawing lays down, using the same
      `labelBox` the existing rules use so one estimate governs all of them: a
      group's title at `TITLE_DX`/`TITLE_DY` from its corner at `TITLE_SIZE`, a
      shape's label centred in its box at its own `size`, edge labels at
      `EDGE_SIZE`, brace labels at `SIZE`, notes at `NOTE_SIZE`
- [x] 2.2 Report a pair whose boxes intersect. Reuse `intersects` rather than
      writing a second box test — `node-overlap` already depends on it, so a
      change to one is a change to both and that is the point
- [x] 2.3 The finding SHALL carry `estimated: true`. Nothing here measures
      text, and a finding resting on the width estimate says so — the same
      contract `text-overflow` and `label-collision` already keep
- [x] 2.4 Existing `label-collision` behaviour SHALL NOT change. Its tests pass
      unedited, or the change is wrong
- [x] 2.5 Tests: a label over a group title fires and is the case this change
      exists for; a label over a node's label fires; two edge labels on one
      another fire; a label merely *near* another does not; a diagram with one
      label and no other text is quiet
- [x] 2.6 Mutation-check: gut the pairwise comparison and confirm the group-title
      assertion fails. A test that stays green with the primitive removed is not
      evidence, and on this repository one has done exactly that

      Three mutations, each reverted. Gutting only the new comparison
      (`if (false && intersects(a, b))`) fails **4 of 375** and every one of
      them is a `text-collision` test — the group title, the node label, the
      two edge labels, and the `estimated` flag. Comparing each text with
      itself (`slice(i)` for `slice(i + 1)`) fails 39. Dropping the `estimated`
      argument fails 1. The first attempt was impure: a regex on
      `if (intersects(a, b))` also hit `node-overlap`, which fails 15 and
      proves nothing about this rule, so it was redone targeted

## 3. Against what exists

- [x] 3.1 Run over all ten shipped diagrams. The prototype reported zero; if the
      finished rule reports anything, settle it by looking at the render rather
      than by loosening the test

      Zero, on the finished rule as on the prototype. `npm run diagrams` is 0
      errors and 0 warnings across all ten
- [x] 3.2 `docs/agents.md`: the new rule in the rules table, and **remove** the
      sentence in "What it does not know about" that says a label lying across a
      group border is not reported — it will no longer be true. `README.md`
      where it lists what `check` catches

## 4. Left for the owner

- [x] 4.1 **OWNER**: a changeset. `@pensketch/core/check` reports a finding it
      did not before, so a **minor** on the same reasoning as the shared-trunk
      rule: rendered output does not move, but a green pipeline can turn red on
      unchanged input, and a caret range on 0.x stops at the minor. It says
      which diagrams start reporting — none of the ten shipped

      Written at the owner's request rather than by them, as 4.1 of the
      shared-trunk change was. Both packages **minor**: core because `check`
      reports what it did not, `@pensketch/mcp` because `check_diagram` returns
      it and the served reference describes it. It answers "which diagrams
      start reporting" with **none of the ten shipped**, names the shape that
      does, and states the limitation that remains — this compares the text a
      group or note carries, not the lines they draw
