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
