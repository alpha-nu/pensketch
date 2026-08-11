# Design: hatch-follows-the-outline

## D1. What `hatch` did

Everything in D1 to D4 is the state this change found and the reasoning that
priced the fix; D5 is what shipped. Present tense below means "before this
change".

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
the shippable variant needs 250 — so the budget has to rise by about 140 before
a byte is written, which is this project's rule. `@pensketch/core` has 1623 B
free today and would absorb it without comment; `./server` is the entry that
decides, as it was for `brace-annotations` group 2. It rose to **3872** in a
commit of its own, against a shipped figure of 3773 — see D5, which is 20 B
above this table's prediction and for a version that does three things the
prototype did not.

## D3. Three ways forward — the second was chosen

1. **Document and stop.** Zero bytes. The diamond stays wrong and says so, in
   the one document written for callers who cannot see the result, and with the
   tests to keep it from moving unnoticed.
2. **Ship the contour hatch and raise `./server` by ~140 B.** ← **chosen.** The
   question was whether a shape nothing currently ships is worth 250 B on the
   entry with the least headroom — measured against `brace-annotations`, which
   spent 260 B there on a whole new phase of the data model. The owner's answer
   was to ship it and make it more robust than the prototype on the way, which
   is what D5 records.
3. **Refuse `hatch` where it is not faithful.** Cheapest in bytes and worst for
   callers: it would break `examples/custom-pen/` and a published example
   resource, to prevent a picture some callers may want.

A fourth was considered and rejected before measuring: insetting the outline
properly rather than insetting the box. Offsetting a polygon inward is a
harder problem than clipping to one, and it would not help the diamond, whose
error is the corners rather than the inset.

**Half of that was wrong, and measuring is what caught it.** The corners were
indeed the visible error, and clipping to the outline does fix them. But once
it does, the inset becomes the *next* error rather than a non-issue: a diamond
inscribed in an inset box stands 1.81 px inside the shipped 150 × 76 and
nothing at all inside a 278 × 30. And offsetting is not the general problem
here — a diamond inset perpendicular to its own edges is a similar diamond, so
it is one scale factor. D5 has the arithmetic and the sweep.

## D4. The prototype, as it was measured

The prototype was written into the tree, built, measured, rendered, and then
reverted with `git checkout -- .` — so the artifact behind D2's table no longer
exists anywhere. What follows is that artifact, recorded here for the same
reason `arc-connectors` recorded its brace geometry: a table of byte counts is
only as good as the code that produced it, and a paraphrase is not that code.

An independent implementation written from D2's prose alone, without sight of
this listing, landed at +185/+186 and +263/+260 against the +190/+193 and
+251/+250 below. That is the useful measure of how much the prose carries: it
reproduces the **conclusion** — 25-odd lines, a quarter of a kilobyte, does not
fit — and not the numbers.

The listing below was reapplied to a clean tree and remeasured, so that it is
the artifact rather than a description of one: core **3748**, `./check`
**3006**, `./server` **3769**, 346 tests green. That is D2's second row.

**`sample.ts`** — the outline, reusing the sampler the arc already needs:

```ts
export function outlinePoints(
  shape: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Point[] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (shape === 'pill') return arcPoints(cx, cy, w / 2, h / 2, 0, 2 * Math.PI);
  if (shape === 'diamond')
    return [[cx, y], [x + w, cy], [cx, y + h], [x, cy], [cx, y]];
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
}
```

**`pen.ts`** — the keep-both variant, which is the one the table's second row
measures. The `box` arm is the shipped closed form, untouched, and it returns
before the scanline so parity cannot move:

```ts
function hatch(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = theme.ink,
  shape = 'box',
) {
  if (shape === 'box') {
    for (let i = -h; i < w; i += HATCH_GAP)
      stroke(
        [
          [Math.max(x, x + i), i < 0 ? y - i : y],
          [Math.min(x + w, x + i + h), i + h > w ? y + (w - i) : y + h],
        ],
        { color, width: HATCH_W, amplitude: HATCH_AMP },
      );
    return;
  }
  const pts = outlinePoints(shape, x, y, w, h);
  for (let c = x - y - h; c < x + w - y; c += HATCH_GAP) {
    const hits: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      const d = b[0] - a[0] - (b[1] - a[1]);
      const t = (c - a[0] + a[1]) / d;
      if (d && t >= 0 && t < 1) hits.push(a[1] + t * (b[1] - a[1]));
    }
    hits.sort((p, q) => p - q);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const p0 = hits[i] as number;
      const p1 = hits[i + 1] as number;
      stroke(
        [
          [c + p0, p0],
          [c + p1, p1],
        ],
        { color, width: HATCH_W, amplitude: HATCH_AMP },
      );
    }
  }
}
```

Delete the `box` arm and its `return` and you have the first row of the table:
smaller by about 60 B, and two failed goldens.

Three details a paraphrase loses, each of which is a bug if it is rederived
wrongly:

- **A hit is parameterised by `y`, not by a point.** On a 45° line `x = y + c`,
  so one number identifies the crossing and the endpoint is `[c + y, y]`. There
  is no second solve and no second sort key.
- **`t >= 0 && t < 1` is half-open on purpose.** A crossing that lands exactly
  on a vertex belongs to one of the two edges that meet there, not both.
  Closing the interval double-counts every vertex, which pairs the crossings up
  wrongly and leaves alternating gaps — the diamond's four corners are all
  vertices, so it fails there first.
- **`if (d && …)` guards an edge parallel to the hatch.** Such an edge has no
  single crossing to report, and without the guard `t` is `±Infinity` or `NaN`
  and survives the comparison in some orderings.

**`draw.ts`** passes the shape through, and **`types.ts`** widens `Pen.hatch`
by one optional argument:

```ts
p.hatch(n.x + HATCH_INSET, n.y + HATCH_INSET, n.w - HATCH_INSET * 2, n.h - HATCH_INSET * 2, theme.pen, n.shape);

hatch(x: number, y: number, w: number, h: number, color?: string, shape?: string): void;
```

That signature is why the measurement is of *this* design and not of the
alternative: adding a separate `Pen` member instead — `hatchIn(points, color)`
— costs a name on a closed public surface, and `api.test.ts` holds `Pen` to an
exact member list, so it is a change to a requirement rather than to a
function. The optional sixth argument keeps `pen.hatch(x, y, w, h)` drawing
exactly what it draws today.

## D5. What shipped, and where it departs from D4

D4 is the artifact that produced D2's table and is left as it stood. What
shipped is not that listing, and the differences are the point of this section:
a design document that records only the prototype leaves the next reader
unable to tell which decisions were taken and which were inherited.

**Cost, measured on the built tree** — core 3497 → **3750** (+253), `./check`
3006 → **3008**, `./server` 3519 → **3773** (+254), react unchanged. The 2 B on
`./check` are not code: the built file is character-for-character the same
program with some of esbuild's short names permuted, the entry never having
hatched anything. 353 tests, no golden moved.

**1. The crossing rule.** D4 reads the half-open interval from each edge's
direction of travel — `t >= 0 && t < 1` — which reports every vertex exactly
once. That is right where a line crosses through a vertex and wrong where it
only touches one, and a single stray crossing pairs the whole line up wrongly.
Shipped instead: a crossing counts when the line falls between the edge's two
ends taken low to high, `(c >= ca) !== (c >= cb)`, which is half-open at the
lower end whichever way the edge runs. A test on a notched clip fails by
**20.2 px** under D4's rule — the span stops at the notch's inner corner with
its true exit dropped. The same comparison is false when both ends are equal,
so it also settles an edge lying along the hatch, which D4 guarded separately
with `if (d && …)`.

**2. The inset.** D4 inherits `draw`'s existing arithmetic: the box is inset by
`HATCH_INSET` and the outline inscribed in what is left. That is a perpendicular
inset only on a box. Measured as ink-to-outline distance over 5566 sizes from
60 × 30 to 300 × 120:

| shape | D4's inset | shipped |
|---|---|---|
| `box` (untouched arm) | 3.40 px min | 3.40 px min |
| `pill` | 1.85 px min, 3.31 median | unchanged — see below |
| `diamond` | **0.00 px** min, 1.54 median | **3.21 px** min, 3.54 median |

The diamond's failure is not exotic: 1.81 px on the 150 × 76 this repository
ships, and zero — ink lying on the outline — at 278 × 30. A diamond inset
properly is a similar diamond, so scaling about the centre is exact:
`s = 1 - HATCH_INSET · hypot(a, b) / (a · b)`, clamped at 0 so a shape too small
to hold the inset shades nothing rather than a mirrored sliver of itself.

The pill is left inscribed in the inset box, deliberately. An ellipse offset by
a constant is a curve of higher degree than an ellipse, and the worst measured
case is 1.85 px at an aspect of 8.5:1 — half a px of daylight between strokes
1 and 1.6 px wide, against a 3.31 px median. Buying the last half-pixel costs
more than the fault is worth.

**3. Points, not a shape name.** D4's sixth argument is a shape *name*, so an
arbitrary outline has no way in and `raw` cannot shade inside what it traced.
D4 priced the alternative as a new `Pen` member, which `api.test.ts` holds to
an exact list and the requirement names — a change to the closed surface. The
third option neither considered: make the sixth argument the *points*. It costs
no name, `draw` computes them anyway, and `pen.hatch(x, y, w, h)` still draws
exactly what it drew. Verified by rendering a ten-point concave star through
`raw` and its own outline.

**Declined: a minimum span length.** Where a ruled line grazes a shape the two
crossings are close together and the stroke is nearly a dot. Priced against the
input it really catches, it is a phantom: across the same 5566 sizes the *box*
arm — untouched, and the reference's own behaviour — draws a span under 3 px at
**every one of them**, because its first scanline is degenerate by construction
and `sampler.seed7.svg.txt:76` opens the shipped hatching with a 0.58 px
stroke. A guard would defend the two new shapes against something the shipped
one has always done and nobody has reported.
