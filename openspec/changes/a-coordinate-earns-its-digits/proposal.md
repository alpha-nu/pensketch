# Proposal: a-coordinate-earns-its-digits

> Every number the renderer writes into markup carries at most two decimal
> places. The geometry is computed at full precision as it always was; only
> the written digits shrink. A typical render loses about 40% of its bytes,
> and nothing a reader can see moves.

## Why

**Most of every rendered byte is phantom precision.** The pen writes raw
IEEE-754 doubles into path data: a typical emitted point is
`L227.9066265118929 75.51747463485226`, sixteen significant digits for hand
jitter whose amplitude is 2.6 px. Measured on a representative figure
(6 nodes, 7 edges, 1 note, 947 B of diagram JSON), the render is 28,277 B at
full precision and 16,740 B rounded to two decimals — **41% smaller**. The
goldens corroborate: 38,450 B and 37,743 B, most of it digits past any
physical meaning. For the MCP server's callers, whose whole cost model is
tokens, that is roughly 4,000 output tokens returned to them on every render
and every retry round (docs/pensketch-feedback.md raised it; it was declined
in 992c0b7 as a silent byte change, which this change now makes deliberately
and in the open).

**Float noise already leaks into published bytes.** The second pass writes
`stroke-width="1.2000000000000002"` — a pinned test expectation at
`packages/core/test/pen.test.ts:96`. The wart and the waste have one cause:
numbers are serialized wherever they happen to be written, with no rule
about what a written number owes the file.

## What changes

- **The reference, first.** Goldens are generated from
  `reference/renderer.html` and from nothing else, so the rounding rule
  lands there before the port can follow: its `el` and `pass` functions
  (its only two serialization sites) round every written number to two
  decimals. CONTRIBUTING's read-only rule bars editing the reference *to
  settle a disagreement*; this is the other case the same section
  legislates — an intended visual change, carried with a regenerated
  golden, a before/after pair, and a minor changeset.
- **The port, in the same commit.** `pen.ts` has the same two funnels —
  `pass()` builds every `d` string, `el()` stringifies every attribute —
  and takes the same round, so the parity gate never opens between commits.
  Both goldens regenerate from the reference and the parity tests hold at
  the new bytes.
- **A witness.** A test scans a rendered fixture's full serialization and
  fails on any number with three or more decimals, and pins
  `stroke-width="1.2"` where the float noise used to be. Both proven by
  mutation: dropping the round at either funnel goes red.
- **The record.** The depth-cost figures were measured on full-precision
  markup and go stale in four places at once (`docs/agents.md`, both
  READMEs, the `depth` JSDoc in `types.ts`); the recorded probe recipe
  re-runs and all four move together. Committed rendered assets — the hero
  PNGs, both README GIFs, the showcase figures — re-render from the new
  bytes.
- **Release.** Core takes a minor (byte-moving, per CONTRIBUTING's
  patch/minor split) and mcp is named minor beside it — an internal
  dependency patch would under-declare a package whose rendered output
  changes (the T-104 precedent). The changeset folds into the already
  pending 0.9.0/0.11.0 release.

## What does not change

- **The determinism contract, in kind.** Same diagram, same seed, same
  engine, same bytes — restated over the rounded serialization. Rounding is
  deterministic; the claim re-anchors on the new bytes once and holds as
  before. The owner accepted the one-time byte churn on 2026-09-13.
- **The geometry.** Anchors, the checker's findings, hop windows, `--ps-i`
  ranks: all computed from the diagram data at full precision, exactly as
  today. The round is the last act before writing, never an input to
  anything. `check`'s findings are byte-identical to today's on every
  fixture.
- **The seeded sequence.** No rng draw is added, removed, or reordered. The
  same jitter is computed; fewer of its digits are written.
- **The animation stylesheet.** It carries no coordinates. `--ps-len` is
  measured from the written digits and may shift by a hundredth on a
  boundary, which is inside the resolution its own format already declares.
- **The API.** No new export, no new option, no knob. The rule is
  mandatory, by owner decision — a precision *parameter* was considered and
  rejected as a knob nobody should have to turn.

## Decisions taken (owner, 2026-09-13)

1. Rounding is mandatory in core, not opt-in — no `precision` parameter.
2. The determinism claim carries forward on the rounded bytes; the one-time
   break with previously published bytes is accepted ("we're still early
   stages of the package").
3. Two decimal places is the agent's call to argue at both bounds, taken in
   design.md D1.
