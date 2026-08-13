# core-renderer — Delta Specification

> One added requirement: a connector may be drawn as the one that goes over
> where two cross, breaking the line underneath. Nothing existing is modified —
> the default is off at both levels, so every path this renderer draws today it
> draws unchanged, byte for byte.

## ADDED Requirements

### Requirement: A connector can go over another where they cross
An edge SHALL accept `hop`, and `DrawOptions` SHALL accept `hops`, resolved as
`edge.hop ?? options.hops ?? false`. Both SHALL default to `false`, so that a
diagram which asks for nothing renders exactly as it did before this change.
`hop: false` SHALL override `hops: true` for that edge, so a diagram-wide
switch is not all-or-nothing.

Where an edge that goes over crosses one that does not, **the line underneath
SHALL be broken** for `HOP_GAP` px, centred on the crossing, and the edge going
over SHALL be drawn straight through. Nothing SHALL be added to the path of the
edge going over: what moves is the other one.

The break SHALL NOT be a bump on the line going over. That is the older
convention and this renderer cannot draw it. Displacing a line perpendicular to
itself moves the apex *along* whatever it crosses at a right angle, so the bump
lands on the line it is meant to bridge rather than clearing it; and
`ARC_MIN_CHORD` — which exists because `pass` jitters by up to `AMP / 2` and
finer chords draw as noise — flattens an arc at that scale into two chords,
making the apex a vertex. Rendered at four sizes it reads as a junction. This
clause states the finding so the bump is not proposed again as an oversight.

A crossing SHALL be a **strict interior intersection** of two segments — both
parameters in the open interval `(0, 1)` — and parallel pairs SHALL be skipped.
So an edge that merely *arrives at* another, its endpoint landing on the other's
run, SHALL NOT break it; edges meeting at a shared anchor SHALL NOT break each
other; and two edges drawn along one another SHALL NOT, there being no crossing
to break for. Detection SHALL compare an edge only with another edge, never
with a node's outline, a brace, or a note's pointer.

Where both edges of a crossing go over, the edge later in `edges` SHALL win, so
that layering is a total order on the array. Nothing about the two paths'
geometry SHALL be consulted to decide it: the author reorders `edges` or names
`hop: false` on one of the pair.

Two crossings closer together than `HOP_GAP` SHALL leave one break rather than
two overlapping into a longer one. A break falling within `HEAD_LEN` of an
edge's final point SHALL be dropped rather than drawn, so that no arrowhead is
eaten and `arrow` never takes its angle from a run that stops short of the
head. It SHALL be dropped silently: `hop` applies to that edge and merely does
not apply at that spot.

Detection SHALL be a plain pairwise walk over the segments of every edge path,
with no spatial index and no sweep line.

`check` SHALL NOT model this. The path it walks is the unbroken one, so a
finding is computed against a line the renderer drew a gap in. This is a stated
divergence rather than an oversight: the error is bounded by `HOP_GAP`, at a
point the author chose to mark.

#### Scenario: A crossing is told apart
- **WHEN** two edges cross and one of them goes over
- **THEN** the one underneath is broken where they meet and the one going over is drawn through it, so a reader can tell which line is continuous

#### Scenario: A diagram that asks for nothing is unchanged
- **WHEN** a diagram omits `hop` on every edge and `hops` from its options
- **THEN** its output is byte-identical to what it was before this change

#### Scenario: One edge opts out of a diagram-wide switch
- **WHEN** a diagram is drawn with `hops: true` and one edge carries `hop: false`
- **THEN** that edge no longer goes over, and the edge it crossed is drawn whole again

#### Scenario: A fan-out is not cut
- **WHEN** three edges leave one node from the same anchor and the diagram is drawn with `hops: true`
- **THEN** none of them is broken where they share that anchor, because a shared endpoint is not an interior intersection

#### Scenario: A connector that ends on another does not break it
- **WHEN** an edge's final anchor lies on the run of another edge that goes over
- **THEN** the run is drawn whole, because arriving at a line is not crossing it

#### Scenario: Two lines drawn along each other are left alone
- **WHEN** two edges share a stretch of one line and the diagram is drawn with `hops: true`
- **THEN** neither is broken, since a break marks a crossing and there is none

#### Scenario: A contested crossing is settled by order
- **WHEN** both edges of a crossing go over
- **THEN** the one later in `edges` wins and the earlier one is the one broken

#### Scenario: A break under an arrowhead is dropped
- **WHEN** a crossing falls within `HEAD_LEN` of the edge's final point
- **THEN** no gap is cut there and the arrowhead is drawn from the edge's own direction of travel
