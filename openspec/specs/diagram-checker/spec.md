# diagram-checker Specification

## Purpose
TBD - created by archiving change diagram-checker. Update Purpose after archive.
## Requirements
### Requirement: A pure checker on its own subpath
`@pensketch/core` SHALL export `check(diagram, options?)` from the subpath
`@pensketch/core/check`, returning an array of findings. It SHALL have zero
runtime dependencies, SHALL NOT render, SHALL NOT touch any DOM, and SHALL
NOT mutate the diagram it is given. Importing the root entry SHALL NOT pull
the checker into a consumer's bundle.

#### Scenario: Callable without a DOM
- **WHEN** `check` is called in an environment with no `document` and no `SVGSVGElement`
- **THEN** it returns findings normally

#### Scenario: The main bundle is unaffected
- **WHEN** a consumer imports only `@pensketch/core`
- **THEN** the root entry's min+gzip size is unchanged and the checker's code is absent

### Requirement: Findings are stable, sorted and machine-readable
Every finding SHALL carry a stable `rule` id, a `severity` of `error` or
`warning`, a one-sentence `message`, an `at` point in the diagram's own
coordinate space, and the `subjects` involved. Findings SHALL be sorted by
severity, then rule, then position, so that the same diagram always yields the
same array and the output can be snapshot-tested.

#### Scenario: Same diagram, same findings
- **WHEN** `check` runs twice over the same diagram and options
- **THEN** both calls return deeply equal arrays in the same order

### Requirement: Text width is estimated and findings say so
`check` SHALL estimate text width as `length * fontSize * glyphWidth` rather
than measuring it, SHALL default `glyphWidth` to a value calibrated against
the documented font stack that over-states the width of every label in this
repository's own diagrams, and SHALL mark every finding that depends on the
estimate so a caller can weigh it accordingly.

#### Scenario: An estimated finding is labelled
- **WHEN** `text-overflow` is reported
- **THEN** the finding carries `estimated: true`

#### Scenario: The estimate errs toward warning
- **WHEN** a label's true rendered width is close to its box width
- **THEN** the estimate over-states it, so the caller is warned rather than left with a silent overflow

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

### Requirement: The checker never repairs
`check` SHALL NOT move, resize, reorder or otherwise alter any part of a
diagram, and SHALL NOT propose replacement coordinates. Automatic layout
remains a project non-goal.

#### Scenario: Reporting, not fixing
- **WHEN** `check` finds an overlap
- **THEN** it returns a finding describing it and the diagram passed in is unchanged

### Requirement: The repository's own diagrams are checked in CI
CI SHALL run the checker over the diagrams this repository ships — the
examples and the README hero — and fail on any `error` finding.

#### Scenario: A shipped example regresses
- **WHEN** a change introduces an overlapping node in an example diagram
- **THEN** CI fails with the finding

### Requirement: The rules over diagram geometry
`check` SHALL report: `duplicate-id` and `node-overlap` and `out-of-bounds` as
errors; `label-collision`, `text-overflow`, `group-escape`, `orphan-node` and
`edge-overlap` as warnings. Each rule's severity SHALL be raisable, lowerable,
or switchable off through options. `out-of-bounds` SHALL run only when a
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

### Requirement: A brace is checked as the shape it draws
Every geometric rule SHALL treat a brace as its sampled path rather than as
the straight line between its endpoints, in the same way a self-transition's
loop and a bowed connector are treated. `out-of-bounds` SHALL therefore report
a brace whose tip projects past the `viewBox` even when both its endpoints sit
inside, and SHALL report a brace's label by the same rule it reports any other
text.

Whether a brace joins the paths `label-collision` searches SHALL be decided in
this change and recorded, not left to the implementation: a note drawn across
a brace is the same defect as a label drawn across a connector, and the only
thing standing in the way is that a finding must be able to name a brace
rather than an edge.

#### Scenario: A tip outside the frame is reported
- **WHEN** a brace's depth carries its tip past the `viewBox` while both endpoints sit inside
- **THEN** `check` reports `out-of-bounds`, where the straight line between its endpoints would have sat wholly within

#### Scenario: A finding names the brace
- **WHEN** any rule reports a defect involving a brace
- **THEN** the message and its subjects name that brace, not an edge index that does not exist

