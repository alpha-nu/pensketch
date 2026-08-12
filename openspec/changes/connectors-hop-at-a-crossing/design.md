# Design: connectors-hop-at-a-crossing

## D1. Where the decision lives

A hop needs two things that live in different places. *Where the crossings are*
is knowable only to something holding every edge path at once, which is `draw`
and nothing below it — `pen` draws one stroke and cannot see a second. *What a
hop looks like* is a property of a drawn line, which is `pen`'s business.

So: `draw` finds the crossings and splices the path; `pen` is unchanged. This
keeps `Pen`'s member list closed, which *The public API surface is closed*
states as an exact enumeration — a change there would falsify it, and a hop is
not a new primitive. It is a different set of points handed to `stroke`.

## D2. Resolution, and why `hop: false` has to mean something

```
edge.hop ?? options.hops ?? false
```

Read with `??` rather than `||`, so `false` is a value and not an absence. That
is the whole reason the field is worth having on the edge when the diagram-wide
switch exists: with `||`, `hop: false` and an omitted `hop` would be the same
input, and an author who wants one crossing left flat would have to turn the
option off for the whole picture and re-enable it edge by edge.

The default is `false` at both levels. Every shipped diagram renders byte for
byte as it does today until something opts in, which is what keeps the goldens
still and makes this change reviewable.

## D3. Who goes over

Where both edges of a crossing resolve to hopping, **the later index in
`edges` goes over**.

The alternative considered and rejected was the schematic convention — the more
horizontal of the two bridges the more vertical. It looks more consistent
without the author thinking about it, and it is what an EDA tool does. It was
rejected because it makes the renderer inspect geometry in order to decide
which of two relationships is subordinate, and because it needs a tiebreak of
its own at 45°, so it does not actually remove the arbitrary rule — it hides
one behind another.

Index order is arbitrary too, but it is *visible*, already meaningful (it is
draw order), and an author who dislikes the result fixes it by moving a line in
the array or naming `hop: false`. Nothing about the fix requires understanding
the rule that produced it.

Refusing the ambiguity with a throw was also rejected: a diagram would then
start throwing when a node moves two pixels, which turns a rendering nicety
into a build break.

## D4. The divot

A hop is a short bow, not a new curve. Take the crossing at parameter `u` along
a segment, walk `HOP_SPAN / 2` back and forward along the path, and replace the
points between with `bowPoints(p0, p1, HOP_OUT)`. `bowPoints` is already in the
root bundle — it is what `bow` is built from — so the shape costs almost
nothing beyond the detection.

Three consequences worth stating:

- The spliced points are jittered by `pass` like every other point, so a hop
  looks drawn rather than applied.
- The sign follows the convention `bow` and `depth` already carry: positive is
  to the right of travel. A hop is always positive, so on a left-to-right run
  it bulges downward and on a right-to-left run it bulges upward. Consistent
  within one edge, and mirrored between an edge and its reverse — which is
  correct, since those are two different lines.
- A square step was rejected outright. In a diagram whose orthogonal paths are
  drawn from `via` corners, a right-angled divot reads as a routing corner,
  which is exactly the wrong signal. A gap was rejected because it is invisible
  on a dotted edge, which is where the showcase's one crossing nearly landed.

## D5. `HOP_OUT` and `HOP_SPAN` are calibrated at both ends

`AMP` is 2.6, so the ideal path already wanders by up to ±1.3 px at each piece
boundary, and the two-pass ink at `WIDTH` 1.6 lays a band several pixels wide. A
hop that is not decisively larger than that reads as a wobble — the feature
draws something and communicates nothing.

`SEG_LEN` is 26, so a hop consuming much of a chord stops reading as a bump on
a line and starts reading as a bulge in it, or swallows a `via` corner whole.

**Both bounds get measured before either constant is written down**, against a
render, at more than one line angle and on both a solid and a dotted edge. A
constant chosen against only the small end is a constant that fails at the
large end, and the figures go in the commit message, not into a comment as a
recollection.

## D6. What counts as a crossing

A strict interior intersection: solving the two segments parametrically, both
`u` and `v` in the open interval `(0, 1)`, with parallel pairs (`den == 0`)
skipped.

That is not fussiness. Measured on the current `showcase`, the strict test
returns **1** transversal crossing; a test that admitted endpoints would also
return 9 touches, and 3 of those are the fan where `pen→sample`, `pen→rng` and
`pen→theme` leave one anchor at (440, 498). Decorating a fan-out with three
divots would be a defect introduced by the feature meant to remove one.

Collinear pairs are skipped for the same reason a hop cannot help them: two
lines drawn along each other have no crossing to bridge. This is why the change
leaves 262 px of doubled line in `showcase` untouched — see D9.

Scope is edge against edge. An edge crossing a node's outline, a brace, or a
note's pointer is a different relationship, and `check` already declines to
compare an edge with a node's outline at all.

## D7. The arrowhead

`arrow()` takes its head angle from the last two points of the path. A hop
spliced near the end would put two hop points there and aim the barbs off the
line of travel.

`HEAD_LEN` is 10. A hop whose span reaches within `HEAD_LEN` of the final point
SHALL be dropped rather than drawn — the crossing is under the arrowhead, where
a bump is illegible anyway. Dropped silently: the field applies to the edge and
merely does not apply at that spot, which is the line the fail-fast requirement
already draws between `via` on a loop (throws, contradicts) and `out` on a
straight edge (ignored, does not apply).

## D8. `check` does not model hops

`edgePath` in `geometry.ts` is the checker's copy of the path, and it stays the
un-hopped one. So `out-of-bounds` cannot see a bump poke `HOP_OUT` past the
frame, and `label-collision` measures clearance to a line that is locally a few
pixels away from where the ink went.

This is a deliberate divergence, taken because `core/check` has 64 bytes of
headroom and the error is bounded by `HOP_OUT` — a few pixels, at a point the
author chose to decorate. Teaching the checker would cost a budget move to buy
precision nobody is short of. It is stated in the requirement so that a later
reader finds it written down rather than inferring it from a discrepancy.

## D9. Deliberately not in this change

**The 262 px of collinear overlap in `showcase`.** Measured:

```
edge 0 & 1   page->root  / react->root    76px
edge 2 & 3   mcp->check  / mcp->server    58px
edge 2 & 4   mcp->check  / mcp->schema    58px
edge 3 & 4   mcp->server / mcp->schema    70px
```

This is what makes that picture hard to read, and a hop does nothing for it by
construction. `edge-overlap` is silent on all of it because its test is that
*every* sampled point of each path lies near the other, which a shared trunk
that diverges at one end never satisfies — the diagrams gate reporting zero
warnings on this file is the proof.

Separating those trunks is an edit to the diagram, and widening `edge-overlap`
to catch partial overlap is a change to the checker with its own 64-byte
problem. Both are real; neither is this.
