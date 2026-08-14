# diagram-checker — Delta Specification

> The checker gains the axis it never had: text against text. Every rule it
> carries today compares text against *strokes*, so two labels written in one
> place are drawn on top of one another and nothing reports it.

## MODIFIED Requirements

> Restated from the live baseline in full, with all 10 of its scenarios carried
> word for word and two added. The rule list gains one id and a paragraph
> describing the new rule is added; the `edge-overlap` paragraphs, the
> `OVERLAP_MIN` calibration clause, the severities, the option handling and the
> `viewBox` clause are untouched.

### Requirement: The rules over diagram geometry
`check` SHALL report: `duplicate-id` and `node-overlap` and `out-of-bounds` as
errors; `label-collision`, `text-overflow`, `group-escape`, `orphan-node`,
`edge-overlap` and `text-collision` as warnings. Each rule's severity SHALL be
raisable, lowerable, or switchable off through options. `out-of-bounds` SHALL run only when a
`viewBox` is supplied.

`edge-overlap` SHALL fire when two edges' sampled paths stay within a small
distance of one another along their whole length, **and also when two edges
that share exactly one endpoint stay within that distance along a run reaching
`OVERLAP_MIN` before parting**, which is the case a caller cannot see: two
connectors drawn one on top of the other read as one deliberate line, and a
pair that leaves one anchor together reads as one line for as long as the
trunk lasts. It SHALL NOT fire on edges that merely cross. The finding SHALL
name the length of the shared run, since the fix is to move one of the two and
the length is what says how far. It is a warning because a pair on one line is
sometimes meant.

The run SHALL be measured only for a pair sharing exactly one endpoint, and
this is a restriction rather than an oversight. A pair sharing **both** ends is
the shape `bow` exists to separate: two edges between one pair of anchors must
meet at each end whatever they do between, so a run there is unavoidable and
says nothing about whether the pair reads as two — what says it is how far
apart they get in the middle, which the whole-length test already measures.
A pair sharing **neither** end cannot be told apart from a shallow crossing by
proximity alone: two lines crossing at a narrow angle stay inside the same
distance for an arbitrarily long run, so measuring one there would fire on the
crossings this requirement forbids. Sharing exactly one endpoint is what makes
a run unambiguous, and it is deliberately narrower than "any two paths that
run together".

`OVERLAP_MIN` SHALL be calibrated against the diagrams this repository ships:
above the longest run any of them draws deliberately, and below the shortest
run that reads as one line. A threshold chosen to silence a gate rather than to
describe the drawing is what makes a warning worth switching off.

`text-collision` SHALL fire when the boxes of any two pieces of text the
drawing lays down intersect — a node's label, a group's title, an edge label, a
brace label or a note, each against every other. `label-collision` measures
text against the *strokes* a diagram draws, and a group's title and a node's
label are in no path, so before this rule nothing compared one piece of text
with another. It SHALL carry `estimated`, because the boxes rest on the width
estimate rather than on measured text. It SHALL have no clearance of its own:
two boxes either intersect or they do not, and a rule with nothing to tune is a
rule nobody argues into silence. It is a warning rather than an error because
text touching at the edges is sometimes close enough, and it names both pieces
so the caller decides which to move.

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

#### Scenario: A pair already separated by a bow is left alone
- **WHEN** two edges join the same pair of anchors and one carries a `bow` large enough that the whole-length test is false
- **THEN** no `edge-overlap` finding is produced, however long the two run together near the anchors they must both meet — a rule that named `bow` as the fix and then went on reporting the pair that took it would be telling the caller to do something that does not work

#### Scenario: Two connectors sharing a corridor but no anchor are not reported
- **WHEN** two edges are routed along the same stretch without sharing either endpoint
- **THEN** no `edge-overlap` finding is produced unless they coincide along their whole length, this being the price of not reporting shallow crossings, which stay within the same distance for an arbitrarily long run

#### Scenario: A label written through a group's title is reported
- **WHEN** an edge label's box intersects the box of a group's title, or of a node's own label
- **THEN** `check` reports `text-collision` naming both, where before it was silent because a title lays down no path for `label-collision` to measure against

#### Scenario: Text merely near other text is not a collision
- **WHEN** two pieces of text sit close together without their boxes intersecting
- **THEN** no `text-collision` finding is produced
