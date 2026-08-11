# Design: hatch-follows-the-box

## D1. What `hatch` actually does

`pen.hatch(x, y, w, h, color)` walks 45° lines across the box at `HATCH_GAP`
= 11 px and clips each to that box in closed form — the entry and exit points
are `Math.max`/`Math.min` against the box's own edges, not an intersection
with anything. `draw` calls it with the node's box inset by `HATCH_INSET` = 4
on every side, for every shape, without varying by shape.

So fidelity is a property of the shape, not of the hatching. Measured on the
lines `draw` actually emits, sampling each at 5% intervals and comparing
against the outline the node draws:

| shape | ink outside the outline | worst excursion |
|---|---|---|
| `box` 150 × 50 | none | 0 — the inset box *is* the shape, inset |
| `pill` 150 × 50 | 82 of 340 points | **15.5 px, 31% of the height** |
| `pill` 160 × 50 | 86 of 360 points | 16.7 px, 33% |
| `diamond` 150 × 76 | 46 of 78 ink points | fills all four corner triangles |

A diamond touches its box at four edge midpoints and encloses exactly half its
area, so half the shading has nowhere legitimate to be. The pill's overshoot is
worst at the **corner of the inset box**, which is where an ellipse is furthest
from its box — 16.5° from the centre for a 150 × 50, not 45°, which is the
corner angle only for a square.

The pill case ships and is served: `examples/custom-pen/index.html:86-87`
hatches `delivered` and `cancelled`, and that diagram reaches agents as
`pensketch://example/lifecycle`. The diamond case ships nowhere, which is why
nothing has caught it.

`raw` can call `hatch` — a callback is handed the whole pen. What it cannot do
is hatch *inside* a shape it drew: `hatch` takes four numbers and knows nothing
of what the callback traced.

## D2. The contour algorithm, prototyped and measured

**The algorithm.** Scanline clip. A 45° hatch line is `x = y + c`; walk `c`
across the shape's extent at `HATCH_GAP`, solve each edge of the outline for
it, sort the crossings, and stroke them in pairs. Every shape the renderer
draws is already a polyline or trivially becomes one — a box and a diamond are
four points, and a pill is `arcPoints(cx, cy, w/2, h/2, 0, 2π)`, which already
exists. About 25 lines including the outline helper.

**It works.** Prototyped in the tree and rendered: a hatched pill at 180 × 80
and a hatched diamond at 150 × 76 both fill inside their outlines, with no ink
outside either.

**It cannot replace the box path.** The reference emits a *degenerate* stroke
at its first scanline and only its first — `i = -h`, where the clipped line has
zero length. `sampler.seed7.svg.txt:76` opens the hatching with
`M63.62351137343794 375.80184044763445 L63.68423834573478 376.12254077065734
L64.10455027859658 376.0802070299163`, a stroke spanning 0.58 px; the last
scanline spans 15.21 px and is ordinary. `i = w` is excluded by the strict `<`,
so there is no second degenerate line. A correct clip finds one crossing at
that first scanline, not two, and draws nothing: the reference emits 14 hatch
strokes for `SAMPLER` and 21 for `BUDGETS` where a contour clip emits 13 and
20. Replacing the closed form outright therefore fails both parity goldens
**structurally**, not by rounding, and `reference/renderer.html` is normative
and read-only. The only shippable design carries **both** implementations:
closed form for a box, scanline for everything else.

**What each variant costs**, measured with `npm run size` (min+gzip), against
core 3497 and `./server` 3519:

| variant | core | `./check` | `./server` | tests |
|---|---|---|---|---|
| replace outright | 3687 (+190) | 3006 (+0) | 3712 (+193) | **2 parity goldens fail** |
| keep both paths | 3748 (+251) | 3006 (+0) | **3769 (+250)** | 346 pass |

An independent implementation of the same algorithm, written without sight of
these numbers, landed at +185/+186 and +263/+260 — within about 12 B either
way, which is how much the figure depends on how the loop is written rather
than on what it does. `./check` does not move at all: the checker never
hatches.

**It does not fit.** `./server` is budgeted at 3648 with **129 B free**, and
the shippable variant needs 250 — so the budget would have to rise by about
140 before a byte is written, which is this project's rule. `@pensketch/core`
has 1623 B free today and would absorb it without comment; `./server` is the
entry that decides, as it was for `brace-annotations` group 2.

## D3. Three ways forward, none chosen here

1. **Document and stop.** What this change does. Zero bytes. The diamond stays
   wrong and says so, in the one document written for callers who cannot see
   the result, and with the tests to keep it from moving unnoticed.
2. **Ship the contour hatch and raise `./server` by ~140 B.** The question is
   whether a shape nothing currently ships is worth 250 B on the entry with
   the least headroom — measured against `brace-annotations`, which spent 260
   B there on a whole new phase of the data model.
3. **Refuse `hatch` where it is not faithful.** Cheapest in bytes and worst for
   callers: it would break `examples/custom-pen/` and a published example
   resource, to prevent a picture some callers may want.

A fourth was considered and rejected before measuring: insetting the outline
properly rather than insetting the box. Offsetting a polygon inward is a
harder problem than clipping to one, and it would not help the diamond, whose
error is the corners rather than the inset.
