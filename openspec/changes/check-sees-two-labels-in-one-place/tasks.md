# Tasks: check-sees-two-labels-in-one-place

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

## 1. The decision, then the budget

- [ ] 1.1 Build both shapes and measure each on `./check`: a new `text-collision`
      rule id, and a widening of `label-collision` to cover the text-versus-text
      axis. The first was measured at **+171 B**; the second is unmeasured.
      Report both with the wording each produces, because the message is what a
      caller acts on and the two read differently — a `label-collision` message
      names "the label on edge 3", which is wrong for a pair of node labels
- [ ] 1.2 **OWNER**: choose. A separate id can be switched off on its own and
      says plainly what it found; reusing `label-collision` is fewer bytes and
      one less rule in the list a reader has to hold
- [ ] 1.3 Move the budget the chosen shape needs, in its own commit, with the
      arithmetic: measured plus the 100 B of gzip headroom the other entries
      are given. `./check` stands at **3297 against 3392**. `repo-tooling` and
      `CONTRIBUTING.md` both name the figure literally, so all three files that
      own it move together

## 2. The rule

- [ ] 2.1 Box every piece of text the drawing lays down, using the same
      `labelBox` the existing rules use so one estimate governs all of them: a
      group's title at `TITLE_DX`/`TITLE_DY` from its corner at `TITLE_SIZE`, a
      shape's label centred in its box at its own `size`, edge labels at
      `EDGE_SIZE`, brace labels at `SIZE`, notes at `NOTE_SIZE`
- [ ] 2.2 Report a pair whose boxes intersect. Reuse `intersects` rather than
      writing a second box test — `node-overlap` already depends on it, so a
      change to one is a change to both and that is the point
- [ ] 2.3 The finding SHALL carry `estimated: true`. Nothing here measures
      text, and a finding resting on the width estimate says so — the same
      contract `text-overflow` and `label-collision` already keep
- [ ] 2.4 Existing `label-collision` behaviour SHALL NOT change. Its tests pass
      unedited, or the change is wrong
- [ ] 2.5 Tests: a label over a group title fires and is the case this change
      exists for; a label over a node's label fires; two edge labels on one
      another fire; a label merely *near* another does not; a diagram with one
      label and no other text is quiet
- [ ] 2.6 Mutation-check: gut the pairwise comparison and confirm the group-title
      assertion fails. A test that stays green with the primitive removed is not
      evidence, and on this repository one has done exactly that

## 3. Against what exists

- [ ] 3.1 Run over all ten shipped diagrams. The prototype reported zero; if the
      finished rule reports anything, settle it by looking at the render rather
      than by loosening the test
- [ ] 3.2 `docs/agents.md`: the new rule in the rules table, and **remove** the
      sentence in "What it does not know about" that says a label lying across a
      group border is not reported — it will no longer be true. `README.md`
      where it lists what `check` catches

## 4. Left for the owner

- [ ] 4.1 **OWNER**: a changeset. `@pensketch/core/check` reports a finding it
      did not before, so a **minor** on the same reasoning as the shared-trunk
      rule: rendered output does not move, but a green pipeline can turn red on
      unchanged input, and a caret range on 0.x stops at the minor. It says
      which diagrams start reporting — none of the ten shipped
