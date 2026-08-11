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

- [ ] 2.1 **OWNER**: contour hatch, or not. design.md D2 measures the only
      shippable variant at **+250 B on `./server`**, which has **129 B free**
      — so it needs the budget raised by ~140 B before a byte is written,
      which is this project's rule. D3 lays out three ways forward and picks
      none
- [ ] 2.2 **OWNER**: whether `examples/custom-pen/`'s hatched pills stay, now
      that the overshoot has a number on it — 15.5 px on a 50 px-tall shape,
      31% of its height, on a diagram served as `pensketch://example/lifecycle`
