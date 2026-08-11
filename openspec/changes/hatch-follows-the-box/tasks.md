# Tasks: hatch-follows-the-box

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

This change ships no renderer code. It states behaviour that already exists,
tests the two shapes nothing tests, and puts the measured cost of the
alternative on the record. `npm run size` must not move; if it does, something
was implemented that this change did not ask for.

Sequenced after the release carrying `arc-connectors`, `brace-annotations` and
`strict-tool-input` is cut. Nothing here is urgent enough to hold a release
that is already staged, and the `./server` figure in design.md D2 is measured
against the tree that release ships — a decision taken against it should be
taken against the same tree.

## 1. Write it down

- [ ] 1.1 The delta's ADDED requirement and its three scenarios, and the
      MODIFIED "Hand-sketch primitive fidelity" restated with "clipped to the
      rectangle it is given" in place of "clipped"
- [ ] 1.2 `docs/agents.md`: an entry in the numbered trap list, which is where
      a caller who cannot see the result meets the things that catch them out
      and which has no hatch entry. The type block at `:109` and the worked
      example at `:241` already describe the box — this is the one place that
      does not. Describe rather than prescribe: `examples/custom-pen/` hatches
      pills on purpose and is served as `pensketch://example/lifecycle`.
      Regenerate `packages/mcp/src/resources.generated.ts`, which embeds this
      file verbatim
- [ ] 1.3 The two tests that do not exist: a hatched **pill**'s ink outside
      the inscribed ellipse, and a hatched **diamond**'s ink in all four
      corner regions outside the outline. A box is already covered twice —
      `pen.test.ts:557` pins the scanline count and both clipped endpoints,
      `draw.test.ts:1051` pins the ink inside the inset box. Pin the wart
      deliberately, so a later change to the clip fails a test that names what
      it is changing rather than silently improving something no gate sees
- [ ] 1.4 Rename `draw.test.ts:1051`'s title, `hatches in pen, inset from the
      outline`. It is the exact phrasing this change exists to correct, in the
      test that pins the behaviour

Gate: `npm run size` unchanged on all four entries, `npm test`, `npm run
resources` clean, and `openspec validate --strict`.

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
- [ ] 2.2 **OWNER**: whether `examples/custom-pen/`'s hatched pills stay. The
      question changes shape once 2.1 ships: the 15.5 px overshoot that made it
      worth asking is the thing group 3 removes, so the answer may simply
      become "they are fine now". Re-read the render before deciding

## 3. Ship it

Written down here because the context that measured this will be compacted
before it is built. **The prototype is not lost and does not need
rediscovering: design.md D4 is the artifact**, reapplied to a clean tree and
remeasured before it was committed — core 3748, `./check` 3006, `./server`
3769, 346 tests green. Start by pasting it in, not by rederiving it.

### 3.1 The budget, first and alone

- [ ] 3.1 Raise `./server` in `tools/check-size.mjs` **in its own commit,
      before a byte of the feature is written**, carrying the arithmetic — the
      requirement `brace-annotations` added to `repo-tooling` and the shape
      both of its own raises took. 3648 today with 129 B free against a
      measured +250, so the new number is about 3790. Confirm the measurement
      still holds against the released tree first: D2 measured it at 0.1.1 and
      the entry is 0.2.0 now

### 3.2 Better than the prototype

Each of these is a decision with a measurement attached, not a foregone
improvement. Price every one against the budget raised in 3.1 and drop what
does not earn its bytes — the entry has ~140 B of new headroom, not a blank
cheque.

- [ ] 3.2 **The inset is wrong for a non-box, and the prototype inherits it.**
      `draw` insets the *box* by `HATCH_INSET` and the outline is then
      inscribed in that, which is not a uniform inset of the drawn shape. On a
      150 × 76 diamond the true perpendicular inset comes to 3.2 px, not 4.
      Either accept it and say so, or trim each clipped span along its own
      direction, which is nearly free. Measure both against a render
- [ ] 3.3 **A tangent span draws a dot.** Where a scanline grazes a pill the
      two crossings are ~0 apart and `stroke` still emits two paths. Skip a
      span below some length, and pick that length against something already
      in the system rather than by taste — `ARC_MIN_CHORD` was chosen that way
- [ ] 3.4 **A concave outline.** The even-odd pairing already handles one;
      nothing proves it. A test with a self-intersecting or concave point list
      is the cheapest robustness there is, and costs no bytes
- [ ] 3.5 **`raw` still cannot hatch inside what it drew.** The listing's
      sixth argument takes a shape *name*, so an arbitrary point list has no
      way in. A `Pen` member that takes points is the natural fix and is a
      change to a closed public surface — `api.test.ts` holds `Pen` to an exact
      member list, and the requirement says exactly which names it has. Decide
      deliberately; it may be worth its own change

### 3.3 What must not move

- [ ] 3.6 **The `box` arm is untouched, and the goldens prove it.** The
      reference emits a degenerate zero-length stroke at its first scanline and
      a correct clip emits nothing there — 14 strokes against 13. Any version
      that routes a box through the scanline fails parity, structurally. Assert
      no golden moves
- [ ] 3.7 **Rewrite the delta.** `specs/core-renderer/spec.md` currently
      *documents* the wart: "ink SHALL therefore fall outside it", with
      scenarios pinning a pill and a diamond shaded past their outlines. Those
      become the opposite. What survives unchanged is the box-parity clause,
      which is permanent. Rename the change to match what it now does —
      `hatch-follows-the-box` describes the bug, not the fix
- [ ] 3.8 **Re-aim group 1.** 1.3 says to pin the wart deliberately; it now
      pins the fix. 1.2's `docs/agents.md` entry describes a trap that will no
      longer exist, and the `hatch` JSDoc, the README field table and
      `examples/react/src/incident.ts` all describe box-following behaviour
      that is about to stop being true — `incident.ts` codes around it with
      `shape === 'box' && i < stage`, which becomes an unnecessary guard
