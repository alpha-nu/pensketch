# diagram-checker — Delta Specification

> `edge-overlap` grows the case it was missing: two connectors that share a run
> and then part. Everything else in the requirement is carried word for word.

## MODIFIED Requirements

> Restated from the live baseline in full, with all six of its scenarios
> carried word for word and two added. The rule list, the severities, the
> option handling and the `viewBox` clause are unchanged; only the paragraph
> describing what `edge-overlap` fires on is edited, and it gains rather than
> loses.

### Requirement: The rules over diagram geometry
`check` SHALL report: `duplicate-id` and `node-overlap` and `out-of-bounds` as
errors; `label-collision`, `text-overflow`, `group-escape`, `orphan-node` and
`edge-overlap` as warnings. Each rule's severity SHALL be raisable, lowerable,
or switchable off through options. `out-of-bounds` SHALL run only when a
`viewBox` is supplied.

`edge-overlap` SHALL fire when two edges' sampled paths stay within a small
distance of one another along their whole length, **and also when they do so
along a run longer than `OVERLAP_MIN` before parting**, which is the case a
caller cannot see: two connectors drawn one on top of the other read as one
deliberate line, and a pair that shares a trunk reads as one line for as long
as the trunk lasts. It SHALL NOT fire on edges that merely cross. The finding
SHALL name the length of the shared run, since the fix is to move one of the
two and the length is what says how far. It is a warning because a pair on one
line is sometimes meant.

`OVERLAP_MIN` SHALL be calibrated against the diagrams this repository ships:
above the longest run any of them draws deliberately, and below the shortest
run that reads as one line. A threshold chosen to silence a gate rather than to
describe the drawing is what makes a warning worth switching off.

#### Scenario: A duplicate id is reported alongside everything else
- **WHEN** two nodes share an `id`
- **THEN** `check` reports `duplicate-id` as an error, naming both, together with every other finding in the diagram — where `draw` stops at the first defect it meets, leaving on the page whatever it had drawn before reaching it

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

#### Scenario: A shared trunk is reported even though the paths part
- **WHEN** two edges run together for longer than `OVERLAP_MIN` and then separate, as one arriving at a node and another turning onto the same approach do
- **THEN** `check` reports `edge-overlap` naming both and the length they share, where before it was silent because neither path lay on the other along its whole length

#### Scenario: Meeting at an anchor is not a shared trunk
- **WHEN** two edges arrive at the same anchor from different directions, touching only where they land
- **THEN** no `edge-overlap` finding is produced, a shared point being nothing to move
