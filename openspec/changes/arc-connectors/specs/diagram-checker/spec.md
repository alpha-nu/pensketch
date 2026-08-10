# diagram-checker — Delta Specification

> An eighth rule, because `bow` fixes a defect a caller cannot see; and curved
> paths made visible to the rules that already exist.

## RENAMED Requirements

- FROM: `### Requirement: Seven rules over diagram geometry`
- TO: `### Requirement: The rules over diagram geometry`

## MODIFIED Requirements

### Requirement: The rules over diagram geometry
`check` SHALL report: `duplicate-id` and `node-overlap` and `out-of-bounds` as
errors; `label-collision`, `text-overflow`, `group-escape`, `orphan-node` and
`edge-overlap` as warnings. Each rule's severity SHALL be raisable, lowerable,
or switchable off through options. `out-of-bounds` SHALL run only when a
`viewBox` is supplied.

`edge-overlap` SHALL fire when two edges' sampled paths stay within a small
distance of one another along their whole length, which is the case a caller
cannot see: two connectors drawn one on top of the other read as one
deliberate line. It SHALL NOT fire on edges that merely cross. It is a warning
because a pair on one line is sometimes meant.

#### Scenario: A duplicate id is reported alongside everything else
- **WHEN** two nodes share an `id`
- **THEN** `check` reports `duplicate-id` as an error, naming both, together with every other finding in the diagram — where `draw` throws on the first defect it meets and renders nothing

#### Scenario: A label lying on a connector is caught
- **WHEN** an edge label's box falls within the configured clearance of any edge's path
- **THEN** `check` reports `label-collision` naming the label and the edge it collides with

#### Scenario: Half in a group is a defect, wholly outside is not
- **WHEN** a node's box partially intersects a group's box
- **THEN** `check` reports `group-escape`
- **WHEN** a node's box lies wholly inside or wholly outside every group
- **THEN** no `group-escape` finding is produced

#### Scenario: One line where the author drew two
- **WHEN** two edges connect the same pair of anchors and neither carries a `bow` or a differing `via`
- **THEN** `check` reports `edge-overlap` naming both, since the picture shows one connector and the data says two

#### Scenario: Crossing is not overlapping
- **WHEN** two edges intersect at a point and diverge
- **THEN** no `edge-overlap` finding is produced

#### Scenario: A rule can be switched off
- **WHEN** options set a rule to `off`
- **THEN** no finding with that rule id is returned

### Requirement: Edge geometry accounts for the jitter
Edge paths SHALL be derived from the exported `anchor` function and whichever
of the edge's own fields describes its path: the `via` points on a straight
run, the sampled arc on an edge carrying `bow`, and the sampled loop on an edge
naming one node at both ends — whose `via` SHALL be left out entirely, since
the loop turns at no corners and the edge is refused rather than drawn. Each
segment SHALL be inflated by half
the jitter amplitude plus half the stroke width before clearance is applied,
because the drawn line does not follow the ideal path.

#### Scenario: A label just clear of the ideal path still collides
- **WHEN** a label sits closer to a segment than the inflated width plus clearance
- **THEN** `label-collision` is reported, even though the label does not touch the ideal path

#### Scenario: A corner no arrow turns at is not a corner
- **WHEN** an edge names one node at both ends and carries `via`
- **THEN** those points are absent from the path every rule measures, so neither a corner outside the `viewBox` nor a label near one is reported — there is no ink at either

## ADDED Requirements

### Requirement: Curved paths are checked as the shapes they draw
Every geometric rule SHALL treat a self-transition's loop and a bowed
connector as the path actually drawn, by sampling it into segments, rather
than as the straight line between its anchors. `out-of-bounds` SHALL therefore
report a loop that projects past the `viewBox`, and `label-collision` SHALL
report a label lying on the curved part of a connector.

#### Scenario: A loop outside the frame is reported
- **WHEN** a self-transition projects beyond the `viewBox`
- **THEN** `check` reports `out-of-bounds`, where the straight line between its anchors would have sat wholly inside

#### Scenario: A label on the curve is reported
- **WHEN** a label sits within the clearance of a bowed connector's arc but clear of the chord
- **THEN** `check` reports `label-collision`

### Requirement: A loop's corners are not measured, because none are drawn
An edge naming one node at both ends SHALL have its `via` left out of the path
`check` measures. `out-of-bounds` SHALL NOT report such a point as a corner the
arrow turns at, and it SHALL NOT be spliced into the path `label-collision`
measures against. `draw` refuses that edge outright, which settles nothing
here: `check` runs on diagrams that are never drawn, which is most of the
reason it exists. This is not mirrored as a finding of its own — the house line
is that `draw`'s refusals go unmirrored, `duplicate-id` excepted, and a rule id
is a published name in every table that lists them.

#### Scenario: A corner outside the frame that the arrow never turns at
- **WHEN** a self-transition carries a `via` point outside the `viewBox`
- **THEN** no `out-of-bounds` finding names it, where before it was reported as a corner the arrow leaves the picture at

#### Scenario: A label beside a corner no loop turns at
- **WHEN** a label sits on a self-transition's `via` point, far from the side the loop hangs off
- **THEN** no `label-collision` finding is produced, where before the label was reported as lying on the line it labels with no ink drawn near it
