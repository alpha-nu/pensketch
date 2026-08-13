# Proposal: connectors-hop-at-a-crossing

> A connector that crosses another can be drawn as the one that goes over: the
> line underneath is broken where they meet, so a reader can tell which is
> which. Opt-in per edge, or diagram-wide with a per-edge opt-out.

## Why

**Two connectors crossing read as four connectors meeting.** At a plain
intersection nothing says which line is continuous, so a reader following one
of them has to guess at the junction and re-find it on the far side. The hop is
the convention that answers it, and it is old: schematics, transit maps and
piping diagrams all draw one line bridging the other rather than trusting the
reader to disambiguate a plus sign.

**The break is a fact about how a line is drawn, not about where it goes.**
Neither path moves; one of them stops for ten pixels and starts again. That is
what keeps this out of routing, which is the thing this renderer does not do.

**The older convention — a bump on the line going over — cannot be drawn by
this pen.** Displacing a line perpendicular to itself moves the apex *along*
whatever it crosses at a right angle, so the bump lands on the line it is meant
to bridge; and `ARC_MIN_CHORD`, which exists so that `pass` cannot jitter a
small arc into noise, flattens it into two chords and makes that apex a vertex.
Rendered at four sizes it reads as a junction. Seven shapes went to a render
before this one was chosen; design.md D4 has the set.

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
- **`hop` is a boolean and the size lives in `constants`** as `HOP_GAP`, 10 px,
  calibrated at both ends on a render: below it the gap is swallowed by the ink
  band the crossing line lays down, above it the two halves stop reading as one
  interrupted line. A numeric `hop` would need a non-finite case, which would
  reopen the closed list in *Invalid diagram data fails fast and specific*; a
  boolean cannot be `NaN`.
- **Only edge-against-edge.** Not an edge against a node's outline, a brace, or
  a note's pointer. Those are separate relationships and none of them is what a
  hop means. This is asymmetric with `bow`, which a note pointer does accept:
  a pointer reaches for a thing, where a hop settles which of two connectors is
  continuous.
- **`render_diagram` and `render_png` accept `hops` beside `seed`**, so the
  diagram-wide switch is reachable by an agent and not only by a hand-written
  page. `check_diagram` does not accept it and refuses it by name — `check`
  walks the unbroken path, so the argument would change no finding, and
  accepting it to ignore it is the silent fallback this project refuses
  everywhere else.
- **Only a transversal crossing**, tested as a strict interior intersection —
  both parameters in `(0, 1)`. So a fan-out is left whole, and so is a line
  another edge merely *arrives at*: arriving is not crossing.
- **`check` is untouched.** With detection in the renderer nothing needs a
  crossing report, and `core/check` has 64 bytes of headroom. The consequence —
  that `edgePath` keeps returning the unbroken path, so `label-collision` can
  measure clearance to ink the renderer cut away — is stated in the requirement
  rather than left to be discovered.

## Impact

- **Affected specs**: `core-renderer` (added), `mcp-server` (added),
  `repo-tooling` (the budget numbers are named literally in the requirement and
  one of them moves).
- **Affected code**: `packages/core/src/{types,constants,draw,sample}.ts`,
  the generated `schema.json` and `resources.generated.ts`, `docs/agents.md`,
  `README.md`.
- **Byte budgets.** `core/server` moved first, in its own commit, twice: to
  4240 against a measured prototype of the bow, and to **4300** once calibration
  replaced the bow with the break, which costs more rather than less — 4196
  against 4134. `core` lands at 4179 against 5120 and does not move. +429 B on
  the root entry is about a tenth of it, and every consumer carries it whether
  or not a diagram ever sets `hop`; hopping is a behaviour of `draw` rather
  than an entry point somebody imports, so it cannot be split off.
- **No existing golden shifts**, because the default is `false`, and the
  restructure that collects every path before drawing any of them consumes the
  seeded sequence in the same order. `showcase` shifts deliberately.
- **What this does not fix.** A break marks a crossing, so it does nothing for
  two lines drawn *along* each other. `showcase` had 262 px of that, which was
  its worst reading problem and which turning the feature on could not touch.
  Routing fixed it instead — three anchors on `mcp`, `react` into core's left —
  and that edit ships with this change. Teaching `edge-overlap` to report
  partial overlap, so the next diagram is told rather than looked at, does not.
