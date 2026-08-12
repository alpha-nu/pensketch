# Proposal: connectors-hop-at-a-crossing

> A connector that crosses another can be drawn hopping over it — a small arc
> where the two meet — so that a reader can tell which line is which. Opt-in per
> edge, or diagram-wide with a per-edge opt-out.

## Why

**Two connectors crossing read as four connectors meeting.** At a plain
intersection nothing says which line is continuous, so a reader following one
of them has to guess at the junction and re-find it on the far side. The hop is
the convention that answers it, and it is old: schematics, transit maps and
piping diagrams all draw one line bridging the other rather than trusting the
reader to disambiguate a plus sign.

**The renderer already deviates from the ideal path, and says nothing by doing
it.** Every stroke is jittered by up to `AMP / 2` at each end of each piece.
A hop is the same kind of deviation — the line still goes where the caller
said — except that it is deterministic and carries a meaning. It is a fact
about how a line is *drawn*, not about where it goes, which is what keeps it
out of routing.

**Detection costs nothing at the scale this library is for.** Measured against
a real render of `examples/showcase/`:

| segments | pairs | detect | as % of one render |
|---|---|---|---|
| 38 (the showcase) | 703 | 0.0017 ms | 0.10% |
| 100 | 4 950 | 0.0217 ms | 1.26% |
| 250 | 31 125 | 0.2774 ms | 16.11% |
| 500 | 124 750 | 1.2811 ms | 74.40% |

`renderToString` of that diagram is 1.722 ms. A naive `O(S²)` double loop stays
under 2% of a render out to a hundred segments and only reaches parity near
five hundred — around 250 hand-placed edges. This library measures no text and
routes nothing, so every label is placed by hand; a diagram at that scale is
not one anybody authors. **No spatial index and no sweep line**: they would be
a guard against a diagram that does not exist.

## What changes

- **`hop?: boolean` on `DiagramEdge`.** The edge carrying it is drawn over
  whatever it crosses.
- **`hops?: boolean` on `DrawOptions`.** A diagram-wide default, resolved as
  `edge.hop ?? options.hops ?? false`. Default `false`, so no shipped diagram
  moves and no golden shifts until one asks for it.
- **`hop: false` is a real opt-out**, not merely the absence of `hop: true`.
  Without it a diagram-wide switch is all-or-nothing, and the one crossing an
  author wants left alone forces the whole option off.
- **Where both edges of a crossing resolve to hopping, the later index in
  `edges` goes over.** Stateless, deterministic, and stated in one sentence.
  An author flips it by reordering the array or by naming `hop: false` on one
  of the pair — no geometry is consulted to decide whose relationship is
  subordinate.
- **`hop` is a boolean and the geometry lives in `constants`** (`HOP_OUT`,
  `HOP_SPAN`), the way `LOOP_OUT` and `LOOP_SPAN` already do. A numeric `hop`
  would need a non-finite case, which would reopen the closed list in
  *Invalid diagram data fails fast and specific*; a boolean cannot be `NaN`.
- **Only edge-against-edge.** Not an edge against a node's outline, a brace, or
  a note's pointer. Those are separate relationships and none of them is what a
  hop means. This is asymmetric with `bow`, which a note pointer does accept:
  a pointer reaches for a thing, where a hop settles which of two connectors is
  continuous.
- **`render_diagram` and `render_png` accept `hops` beside `seed`**, so the
  diagram-wide switch is reachable by an agent and not only by a hand-written
  page. `check_diagram` does not accept it and refuses it by name — `check`
  walks the un-hopped path, so the argument would change no finding, and
  accepting it to ignore it is the silent fallback this project refuses
  everywhere else.
- **Only a transversal crossing**, tested as a strict interior intersection —
  both parameters in `(0, 1)`. Two edges leaving one anchor therefore grow no
  divots, which matters: `showcase` has a three-way fan out of `pen` at
  (440, 498) that a looser test would decorate with three bumps.
- **`check` is untouched.** With detection in the renderer nothing needs a
  crossing report, and `core/check` has 64 bytes of headroom. The consequence —
  that `edgePath` keeps returning the un-hopped path, so `out-of-bounds` cannot
  see a bump leave the frame — is stated in the requirement rather than left to
  be discovered.

## Impact

- **Affected specs**: `core-renderer` (added), `mcp-server` (added),
  `repo-tooling` (the budget numbers are named literally in the requirement and
  one of them moves).
- **Affected code**: `packages/core/src/{types,constants,draw,sample}.ts`,
  the generated `schema.json` and `resources.generated.ts`, `docs/agents.md`,
  `README.md`.
- **Byte budgets.** `core/server` has **99 B** of headroom at 3773/3872 and it
  carries `draw`, so it moves first, in its own commit, with the arithmetic
  from a measured prototype — never corrected after the fact. `core` has
  1370 B at 3750/5120 and may not need to move at all; that is a measurement,
  not a prediction.
- **No existing golden shifts**, because the default is `false`. Applying the
  feature to `showcase` shifts that one deliberately.
- **What this does not fix.** Measured on the current `showcase`: one
  transversal crossing, at (700, 372), and **262 px of collinear overlap** —
  `page→root` and `react→root` sharing 76 px into `root`, and the three edges
  out of `mcp` stacked on `x = 700` for 58–70 px. A hop is skipped on collinear
  pairs by construction, so turning this on draws exactly **one** divot and
  leaves every overlap as it is. Separating those trunks is a change to the
  picture, not to the renderer, and is not in this proposal.
