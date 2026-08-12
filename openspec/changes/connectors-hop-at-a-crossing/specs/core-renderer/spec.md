# core-renderer — Delta Specification

> One added requirement: a connector may be drawn hopping over another where
> the two cross. Nothing existing is modified — the default is off at both
> levels, so every path this renderer draws today it draws unchanged.

## ADDED Requirements

### Requirement: A connector can hop a crossing
An edge SHALL accept `hop`, and `DrawOptions` SHALL accept `hops`, resolved as
`edge.hop ?? options.hops ?? false`. Both SHALL default to `false`, so that a
diagram which asks for nothing is drawn exactly as it was before this change.
`hop: false` SHALL override `hops: true` for that edge, so a diagram-wide
switch is not all-or-nothing.

An edge that resolves to hopping SHALL be drawn with a short arc where it
crosses another edge, offset to the right of travel — the sign convention `bow`
and a brace's `depth` already carry — sized by the `HOP_OUT` and `HOP_SPAN`
constants and not by any field the caller writes. The arc SHALL be spliced into
the edge's own point list and drawn through the same `stroke` as the rest of
it, so that it is jittered like every other point and reads as drawn rather
than as applied.

A crossing SHALL be a **strict interior intersection** of two segments — both
parameters in the open interval `(0, 1)` — and parallel pairs SHALL be skipped.
Edges meeting at a shared anchor therefore SHALL NOT be decorated, and two
edges drawn along one another SHALL NOT be, there being no crossing to bridge.
Detection SHALL compare an edge only with another edge, never with a node's
outline, a brace, or a note's pointer.

Where both edges of a crossing resolve to hopping, the edge later in `edges`
SHALL go over. Nothing about the two paths' geometry SHALL be consulted to
decide it: the author reorders the array or names `hop: false` on one of the
pair, and the rule that produced the result is one sentence long.

A hop whose span would reach within `HEAD_LEN` of an edge's final point SHALL
be dropped rather than drawn, so that `arrow()` never takes its head angle from
spliced points. It SHALL be dropped silently: `hop` applies to that edge and
merely does not apply at that spot, which is the line already drawn between a
field that contradicts the path and one that does not apply to it.

Detection SHALL be a plain pairwise walk over the segments of every edge path,
with no spatial index and no sweep line.

`check` SHALL NOT model hops. The path it walks is the un-hopped one, so a hop
that leaves the frame is not reported and a label's clearance is measured to
the line rather than to the arc. This is a stated divergence rather than an
oversight: the error is bounded by `HOP_OUT`, at a point the author chose to
decorate.

#### Scenario: A crossing is told apart
- **WHEN** two edges cross and one of them resolves to hopping
- **THEN** that edge is drawn with an arc over the other, and the other is drawn straight through

#### Scenario: A diagram that asks for nothing is unchanged
- **WHEN** a diagram omits `hop` on every edge and `hops` from its options
- **THEN** its output is byte-identical to what it was before this change

#### Scenario: One edge opts out of a diagram-wide switch
- **WHEN** a diagram is drawn with `hops: true` and one edge carries `hop: false`
- **THEN** that edge is drawn straight through every crossing it makes, and the rest still hop

#### Scenario: A fan-out is not decorated
- **WHEN** three edges leave one node from the same anchor and the diagram is drawn with `hops: true`
- **THEN** no arc is drawn where they share that anchor, because a shared endpoint is not an interior intersection

#### Scenario: Two lines drawn along each other get no arc
- **WHEN** two edges share a stretch of one line and the diagram is drawn with `hops: true`
- **THEN** neither is decorated, since a hop bridges a crossing and there is none

#### Scenario: A contested crossing is settled by order
- **WHEN** both edges of a crossing resolve to hopping
- **THEN** the one later in `edges` is drawn over the earlier one

#### Scenario: A hop under an arrowhead is dropped
- **WHEN** a crossing falls within `HEAD_LEN` of the edge's final point
- **THEN** no arc is spliced there and the arrowhead's angle is taken from the edge's own direction of travel
