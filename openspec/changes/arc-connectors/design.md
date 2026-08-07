# Design: arc-connectors

## D1 — The primitive is an arc, not a curve

`arc(cx, cy, rx, ry, from, to, opts)`, angles in radians, swept `from → to`
with the sign giving direction. It samples into a polyline and hands that to
`stroke`, which is the only way anything is drawn here.

Not a Bézier. The engine's whole character comes from `pass()` walking a
polyline, cutting each leg into ~26 px steps and jittering every point with
the ends damped. A `<path>` with a `C` command would be smooth where
everything around it wobbles, and would need its own jitter scheme to match.
An arc sampled to points needs none: it is a polyline like every other, and
falls through the existing machinery unchanged.

Sampling density is a constant, `ARC_STEPS`, chosen so a full half-circle at
typical loop sizes is dense enough not to read as a polygon. The example that
prompted this change learned the same lesson by hand — its comment records
that seven points read as an arc and four read as a beak.

## D2 — A self-transition is `from` and `to` naming the same node and side

```js
{ from: ['pin', 'r'], to: ['pin', 'r'], out: 60, span: 24, label: 'digit entered', lx: 326, ly: 196 }
```

Chosen over a separate `loop` field because it removes a trap rather than
adding surface. That syntax means nothing today and draws a stub across the
node's corner; after this it means the only thing a reader would ever guess it
means.

Same id with **different** sides throws. A corner loop is a reasonable feature
and a different one, with its own geometry to get right, and shipping it
silently alongside this would be the same mistake as the stub.

`out` is how far the loop projects beyond the side. `span` is how far apart
its two anchors sit along the side. Both have documented defaults, in the way
`size` has one: a caller who writes neither still gets a loop, and `check`
tells them if it lands somewhere it should not. Neither is inferred from the
node's dimensions — that would be layout, and this library does not do layout.

The arrowhead lands on the returning anchor, so the loop reads as a transition
rather than as decoration.

## D3 — `bow` is a perpendicular offset, and never combines with `via`

```js
{ from: ['a', 'r'], to: ['b', 'l'], bow: 30 }
```

The apex sits `bow` px from the midpoint of the straight chord, perpendicular
to it. Positive is to the right of travel, so `A→B` with `bow: 30` and `B→A`
with `bow: 30` bow to opposite sides of the same line, which is what a caller
drawing a pair actually wants.

`bow` with `via` throws. A caller who has supplied corners has already
described the path, and there is no honest reading of "curve it as well" that
does not involve inventing a shape on their behalf.

Note pointers take `bow` with the same meaning and the same restriction.

## D4 — `edge-overlap` is part of this change, not a follow-up

The `bow` half of this proposal is a fix for a problem a caller cannot see. A
diagram with `A→B` and `B→A` renders one line, looks deliberate, and is wrong;
without a rule, `bow` is a feature waiting for someone to notice they need it.

The rule reports two edges as `edge-overlap` when their sampled paths stay
within a small distance of each other along their whole length — which catches
the exact-duplicate case and the near-parallel one, and does not fire on edges
that merely cross. A warning, not an error: two connectors on one line is
sometimes what a caller means.

This takes the rule count to eight, so the requirement heading that counts them
is renamed at the same time. A count in a heading is a fact with a short life.

## D5 — What does not change

No layout, no routing, no automatic placement, and no "make it look right".
Every number that positions a curve is written by the caller, exactly as `via`
points are. The library refuses inference; a curve is not the place to start.

Rendered output for every existing diagram is byte-identical. The new code
paths consume from the seeded sequence only when invoked, so a diagram that
uses none of this draws exactly what it drew before — asserted against the
existing goldens rather than argued.

## D6 — Braces and brackets: deferred, and cheap once this lands

Prototyped while specifying this. A curly brace is **four quarter-arcs and two
runs** — 24 points, exact geometry, drawn by the existing `stroke`:

```
x extent    174.0 → 200.0  (asked for tip at 174)
y extent    40.0 → 240.0
tip         174.0, 140.0   (asked for the vertical middle)
```

So once `arc` exists, a brace is about ten lines of point generation on top of
it. A square bracket needs no arc at all — four points through `stroke`, which
a caller can already draw today.

Deferred anyway, for two reasons. It is an **annotation**, not a connector:
its home is `notes`, its questions are about labels and spans, and it shares
nothing with this change but the primitive. And this change already carries
three user-visible features; adding a fourth with a different shape of
decision behind it is how a change stops being reviewable.

Recorded here so the next change can start from the geometry rather than
rediscover it.
