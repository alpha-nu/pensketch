# Design: connectors-hop-at-a-crossing

## D1. Where the decision lives

A hop needs two things that live in different places. *Where the crossings are*
is knowable only to something holding every edge path at once, which is `draw`
and nothing below it — `pen` draws one stroke and cannot see a second. *What a
hop looks like* is a property of a drawn line, which is `pen`'s business.

So: `draw` finds the crossings and cuts the paths; `pen` is unchanged. This
keeps `Pen`'s member list closed, which *The public API surface is closed*
states as an exact enumeration — a change there would falsify it, and a hop is
not a new primitive. It is a shorter set of points handed to `stroke`, more than once.

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

## D4. The break is on the line underneath

`hop: true` says this edge goes over. What moves is the *other* one: it is cut
for `HOP_GAP` px, centred on the crossing, and the edge going over is drawn
straight through. Its own path is untouched.

That is not what this change proposed. The proposal described a bump on the
line going over — a short bow spliced through `bowPoints`, free because
`bowPoints` is already in the root bundle. It does not work, for two reasons
that compound, and both were found by rendering rather than by reading:

**A perpendicular displacement cannot clear a perpendicular crossing.** The
splice offsets the line perpendicular to *itself*. Where two edges meet at a
right angle — most of an orthogonal diagram — that perpendicular is parallel to
the line being crossed, so the apex slides along it and lands on it. True at
every size.

**`ARC_MIN_CHORD` guarantees a vertex.** It is 12 px, and it is correct: `pass`
splits every chord again and jitters both ends by up to `AMP / 2`, so an arc
sampled finer than that draws as noise rather than as a hand. At hop scale the
bow samples into two chords, and two chords over a semicircle is a sharp V.

Together: a sharp vertex landing exactly on the line it was meant to bridge,
which reads as a junction. Rendered at 6/12, 8/16, 10/20 and 7/22 — larger read
worse, because a larger V is a larger arrowhead pointing at the other line.

Three further shapes went to the render before the break was chosen. A
flat-topped **step** has the property the V lacks, a crown parallel to the line
it belongs to, and can be four points in the same stroke — but it reads as an
orthogonal routing corner, which is the wrong signal in a diagram whose paths
are built from `via` corners. A deliberately shallow **peak** is a gentler
version of the same failure. A **finely sampled arc** at reduced amplitude does
read as a bridge, but needs a second sampler that contradicts `ARC_MIN_CHORD`,
and a separate `stroke` to carry the reduced amplitude — which puts a shared
point on two independently jittered passes, the ~1 px seam `bracePoints` exists
to avoid.

The break needs none of that. It is a cut in a point list, no curve, no second
sampler, one constant instead of two. It is not cheaper in bytes — 4196 against
the bow's 4134, because a break is a list of runs and a `stroke` for each of
them — but it is the one that reads.

One honest limitation: a gap in a *dotted* line underneath is nearly invisible,
the line already being mostly gap.

## D5. `HOP_GAP` is calibrated at both ends

10 px, measured on a render rather than reasoned about.

**Below it**, the crossing line lays down a band about 4.2 px wide — `WIDTH`
1.6 plus the `AMP` 2.6 the jitter moves it across — so a gap of 8 leaves under
2 px of daylight either side and reads as a smudge rather than a break.

**Above it**, at 16 the two halves stop reading as one interrupted line and
start reading as two lines that happen to be collinear, which is a different
and worse claim about the drawing.

10 clears the band by about 2.9 px each side and still closes visually. Both
bounds were rendered; neither was inferred from the other.

## D6. What counts as a crossing

A strict interior intersection: solving the two segments parametrically, both
`u` and `v` in the open interval `(0, 1)`, with parallel pairs (`den == 0`)
skipped.

That is not fussiness. Measured on `showcase` before its routing was reworked,
the strict test returned **1** transversal crossing where a test admitting
endpoints returned 10. Three of the nine extra are the fan where `pen→sample`,
`pen→rng` and `pen→theme` leave one anchor at (440, 498): cutting a fan-out
would be a defect introduced by the feature meant to remove one.

Worth knowing which clause does that work, because it is not the obvious one. A
crossing at a shared *start* is dropped one step later anyway — its `t0` is
negative, and the high-water guard refuses it whatever the interior test said.
So relaxing `>=` to `>` leaves a fan-out test green and proves nothing. The
case the strict test actually earns is an edge that **ends on** another:
interior to the run being cut, an endpoint of the run doing the crossing.
Inclusive, a line that merely arrives at another would break it. That is the
mutation the test suite is pinned against.

Collinear pairs are skipped because two lines drawn along each other have no
crossing to mark — see D9 for what that does and does not leave behind.

Scope is edge against edge. An edge crossing a node's outline, a brace, or a
note's pointer is a different relationship, and `check` already declines to
compare an edge with a node's outline at all.

## D7. The arrowhead

`arrow()` takes its head angle from the last two points of the run it is
handed. A break near the end would hand it a run that stops short of the head,
aiming the barbs off the line of travel — and the gap would eat the head.

`HEAD_LEN` is 10. A break falling within `HEAD_LEN` of the final point SHALL be
dropped rather than cut. Dropped silently: the field applies to the edge and
merely does not apply at that spot, which is the line the fail-fast requirement
already draws between `via` on a loop (throws, contradicts) and `out` on a
straight edge (ignored, does not apply).

## D8. `check` does not model hops

`edgePath` in `geometry.ts` is the checker's copy of the path, and it stays the
unbroken one. So `label-collision` can measure clearance to a stretch of line
the renderer cut away, and report a label lying on ink that is not there.

This is a deliberate divergence, taken because `core/check` has 64 bytes of
headroom and the error is bounded by `HOP_GAP` — ten pixels, at a point the
author chose to decorate. Teaching the checker would cost a budget move to buy
precision nobody is short of. It is stated in the requirement so that a later
reader finds it written down rather than inferring it from a discrepancy.

## D9. The overlap a break cannot help, and what did

Applying this to `showcase` exposed the limit of the feature. That diagram's
worst reading problem was never a crossing:

```
edge 0 & 1   page->root  / react->root    76px
edge 2 & 3   mcp->check  / mcp->server    58px
edge 2 & 4   mcp->check  / mcp->schema    58px
edge 3 & 4   mcp->server / mcp->schema    70px
```

262 px of line drawn along other line, and a break does nothing for any of it
by construction — parallel pairs are skipped, because a break marks a crossing
and there is none. Turning the feature on drew exactly one break, in a diagram
whose three most confusing places it could not touch.

`edge-overlap` is silent on all of it: its test is that *every* sampled point
of each path lies near the other, which a pair sharing a trunk and then
diverging never satisfies. The diagrams gate reporting zero warnings on that
file is the proof, not a reassurance.

What fixed it was routing, under a rule this repository already had — *an
anchor is free*. `mcp` reaches three things and now leaves by three different
sides, so nothing stacks; `react` arrives at core's left rather than descending
the column `page` already occupies. Not one connection changed, only which side
each line leaves and lands on. **262 px → 0**, and the two crossings that
remain are both marked.

Still deliberately out of scope: widening `edge-overlap` to report partial
overlap, so that the next diagram to do this is told rather than looked at.
That is a change to a checker with 64 bytes of headroom, and it is the natural
follow-on rather than part of this.
