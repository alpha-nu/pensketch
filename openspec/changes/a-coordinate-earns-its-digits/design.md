# Design: a-coordinate-earns-its-digits

## D1 — Two decimals, argued at both bounds

A constant chosen against one failure mode is half chosen, so both ends are
priced.

**The fidelity bound (too few digits).** The quantization error of two
decimals is at most 0.005 viewBox units per coordinate. The smallest
deliberate movement the pen makes is `HEAD_AMP = 1.2` (an arrowhead barb's
jitter); the error is 0.4% of it. At `MAX_SCALE = 4`, the largest raster the
tool boundary will produce, the error is 0.02 device pixels. One decimal
would be 0.05 units — 0.2 device pixels at scale 4, an order of magnitude
closer to visible, and on a dense sampled arc (chords floored at
`ARC_MIN_CHORD = 12`) that is where quantization would first read as
faceting if anywhere.

**The byte bound (too many digits).** Measured on the probe figure:
16,740 B at two decimals against 15,648 B at one. The second decimal costs
7% of the rounded size and buys the order of magnitude of headroom above
every perceptual threshold. Three decimals would spend another ~1,100 B on
digits with no bound that wants them.

Two decimals. The multiplier is module-private to `pen.ts` (see D4), and
the reference writes the same `100` inline, as it writes every constant.

## D2 — Round at the write, never in the geometry

The round is applied where a number becomes text: inside `pass()` as each
point is appended to a `d` string, and inside `el()` as each numeric
attribute is stringified. Nothing upstream sees a rounded value: anchors,
hop-window intersection, the checker's every rule, and `--ps-i` ranking all
run on full-precision floats exactly as today. Two consequences are
accepted and stated:

- `--ps-len` is measured by `draw` from the written `d` attribute, so it is
  now measured from rounded digits. The per-gesture ratio it emits is
  floored to two decimals by its own format; an input perturbation of
  0.005 units per point can move a ratio by at most a hundredth. That is
  inside the resolution the variable already declares, and it is
  deterministic.
- A caller who parses coordinates back out of the markup reads rounded
  values. That reader was already reading jitter, not geometry; the diagram
  data remains the only source of exact positions, which is the library's
  published stance (coordinates are given, never computed).

The form is `Math.round(n * 100) / 100`, not `toFixed`: an integer over 100
always prints as its shortest round-trip decimal (no padded zeros, no
exponent in this range), and `-0` interpolates as `"0"`.

## D3 — The reference moves first, and why that is constitutional

Goldens are generated from `reference/renderer.html` only — generating them
from the port would make parity a tautology — so a change to the written
bytes *must* land in the reference or the parity gate dies. CONTRIBUTING's
read-only rule exists against drift: editing the reference **to settle a
disagreement** moves the target instead of finding the fault. This is the
clause beside it: a golden changes when a visual change is intended, with a
before/after pair and a minor changeset. The depth change's "the reference
stays frozen" (design D5 there) was that change's decision — depth
assembled from existing passes precisely so the reference would not need to
learn it — not a general ban, and this change cannot use that trick:
there is no way to shrink written digits without writing different digits.

Reference, goldens, and port move in **one commit**, so no commit in the
history has a red parity gate.

## D4 — Which numbers, and where the rule lives

Every number the renderer writes: path data through `pass()`, and every
numeric attribute through `el()` — `x`, `y`, `font-size`, `opacity`,
`stroke-width` among them. Blanket coverage at `el()` is deliberate: it is
what turns `stroke-width="1.2000000000000002"` into `stroke-width="1.2"`,
and it means no future attribute can leak float noise by forgetting a wrap.
Strings pass through untouched (`stroke-dasharray`, colors, the `--ps-*`
style text `draw` composes — already fixed-width by `toFixed`). One writer
sits outside both funnels, found in review: `label` interpolates its `size`
into a style string on both sides of the parity gate (`pen.ts` and the
reference alike). It is caller data, parity-symmetric, and integral in
every shipped caller, so it stays as it is; if a fractional label size ever
matters, the round belongs there too, on both sides at once.

The helper is module-private to `pen.ts`. It was weighed against a
`constants.ts` entry and kept private: `constants` is a closed, counted
export surface (the manifest test pins its member count, and two documents
quote it), the value is a serialization contract rather than an aesthetic,
and both funnels live in the one file. The reference duplicates the `100`
the way it duplicates `26`, `2.6` and every other constant — it is the
frozen prose the constants were extracted from.

## D5 — What the golden delta must look like, and how it is judged

The regenerated goldens differ from the old in digits only: the same
element count, the same attribute names, every line shorter. The eye-check
is paired with a number (looking is not measuring): a one-off proof during
task 1.1 parses old and new path data pairwise and asserts the maximum
per-coordinate displacement is ≤ 0.005, which is the analytic bound. The
before/after render pair goes to the owner at the group boundary.

## D6 — Version and blast radius

- **core**: minor. Byte-moving by intent; the changeset says what shifts
  (every written number, at most two decimals) so anyone snapshot-testing
  their own diagrams knows why every snapshot moved.
- **mcp**: named minor beside it, the T-104 precedent — its rendered output
  changes, and an internal-dependency patch would claim byte-stability the
  release does not have.
- **react, animation**: untouched. No API moves, no floor moves; react
  renders through whatever core resolves, and the animation stylesheet
  carries no coordinates.
- The changeset folds into the pending release (core 0.9.0, mcp 0.11.0
  expected from the three changesets already in tree).

## D7 — Budgets

The helper and two call sites are new min+gzip bytes on the root and
`./server` entries (`./check` serializes nothing and should not move).
Measured at task 1.3, not estimated here. Current headroom is 126 B on each
of the two affected entries (5,570 measured against 5,696); if a tripwire
fires the re-decision follows the ledger's standing rule — at a green gate,
measured need plus the conventional 100 up to the next multiple of 64 —
in its own commit.

## D8 — The recorded figures that go false

The depth-cost numbers were measured on full-precision markup and live in
four places that cannot see each other: `docs/agents.md` ("about 84 B per
px", "4,558 B", "90 kB", the 20000-px probe), `README.md` (§ depth costs),
`packages/core/README.md:147`, and the `depth` JSDoc at
`packages/core/src/types.ts:574`. The T-103 probe recipe is recorded beside
the agents.md numbers, seed included; task 2.1 re-runs it and moves all
four documents together, then regenerates the embedded MCP resources.
Committed rendered assets re-render in 2.2 for the same reason: a PNG or
GIF of bytes the renderer no longer writes is a stale record with a gate
(`npm run diagrams`, the animation check) that cannot see it.
