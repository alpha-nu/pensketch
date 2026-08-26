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
coordinate space, and the `subjects` involved. A finding about the **call**
rather than about the drawing — an option the renderer would refuse, which
belongs to no node, edge, brace or note — SHALL name `options` among its
subjects and report the origin as its `at`, and the documentation SHALL say
so wherever it tells a reader that `at` is the place to look. A rule id
SHALL be stable in the sense that a published id never changes meaning, not
in the sense that the set never grows. Findings SHALL be sorted by
severity, then rule, then position, so that the same diagram always yields the
same array and the output can be snapshot-tested.

#### Scenario: Same diagram, same findings
- **WHEN** `check` runs twice over the same diagram and options
- **THEN** both calls return deeply equal arrays in the same order

#### Scenario: A finding about the call names the call
- **WHEN** `check` reports an option the renderer would refuse, on a diagram where no member carries the offending value
- **THEN** the finding names `options` among its subjects and reports the origin as its `at`, since there is no place in the drawing to look

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
`check` SHALL report: `duplicate-id`, `node-overlap`, `out-of-bounds` and
`undrawable-depth` as
errors; `label-collision`, `text-overflow`, `group-escape`, `orphan-node`,
`edge-overlap` and `text-collision` as warnings. Each rule's severity SHALL be
raisable, lowerable, or switchable off through options, the newest id
included: a rule the caller cannot silence is a rule they will work around. `out-of-bounds` SHALL run only when a
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

Every rule that measures a node SHALL read its box as the rectangle it covers
rather than as the four numbers it was written with. `w` and `h` may be
negative: a node written from any of its four corners names one rectangle, and
the pen lays the same ink over it whichever corner it was written from, because
winding is read off the outline's signed area and not off the sign of a
dimension. `node-overlap`, `group-escape` and `text-overflow` SHALL therefore
report a mirrored node exactly as they report the upright spelling of it, at
any depth and at none. A finding's `at` is the exception and stays the corner
the author wrote, because it is somewhere to go and look rather than a
measurement.

`text-overflow` is the one rule the covered extent alone does not settle. A
group's title is not centred in its frame: `draw` writes it at
`n.x + TITLE_DX` running right, from the written corner rather than from an
edge, so a group written from its far corner has its title laid outside the
frame it names. The room a title has SHALL be measured from where the pen
writes it to the covered right edge - the written width for every upright
group, nought for a mirrored one - so that a title drawn off the corner of its
own group stays a finding rather than being handed room it cannot reach.

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

#### Scenario: A block with no lines is not text
- **WHEN** a node, a group, a brace or a note carries `lines: []`, which the pen writes no `<text>` for
- **THEN** no rule measures it - no room to overflow, no box to collide with and no label to lie on a stroke - because what the rules measure is the text the drawing lays down

#### Scenario: A mirrored node is the rectangle it covers, with no depth in play
- **WHEN** a flat diagram writes a node from its far corner with negative `w` and `h`, and another node or a group laps the rectangle it covers
- **THEN** `check` reports `node-overlap` and `group-escape` exactly as it does for the upright spelling, and reports no `text-overflow` against a label that fits inside it

#### Scenario: A group's title is measured from where the pen writes it
- **WHEN** a group is written from its far corner, so its title is laid outside the frame it names
- **THEN** `check` reports `text-overflow` against the room inside that frame, which is nought less the padding, rather than against the width the frame covers

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
is that `draw`'s refusals go unmirrored, and a rule id is a published name in
every table that lists them, so mirroring one is a cost paid in documents as
well as in bytes. The exceptions are counted rather than assumed: `duplicate-id`
and `undrawable-depth`, each admitted because the defect it names would
otherwise cost the caller a round trip through a renderer that refuses the
whole diagram. A third SHALL be argued on that ground or not at all.

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

### Requirement: Extruded geometry is measured extruded
`check` SHALL accept the same `extrude`/`depth` pair in its options that
`draw` accepts, and SHALL read the same per-node fields, resolved by the same
idiom. For a shape node whose extrusion is on, every rule that measures the node's
**ink** — `node-overlap`, `out-of-bounds`, `group-escape` on the member's
side, and every rule that walks its
edges — SHALL use the swept box `(x, y − 0.75d, w + d, h + 0.75d)`, and the
anchors it walks SHALL be the renderer's moved ones: the covered rectangle's
screen-top and screen-right — `t` and `r` on an upright spelling — at the
flat anchor plus the extrusion vector, the two front-plane sides unmoved,
the side chosen off the screen geometry exactly as the renderer chooses it,
so a mirrored spelling walks the points its upright spelling walks. `label-collision`
belongs to that second clause and not the first: it measures text against
the paths a diagram draws, and a node's outline has never been one of them,
so what depth changes for it is where the edges start. A rule that compared
a label with a node's box flat would have to keep doing so, and the flat run
must not move. Every rule that
measures the node's **label** — `text-overflow`, `text-collision` — SHALL
keep the front box, because the label sits on the front face and does not
move: sweeping it would hand `text-overflow` d px of room no glyph can use,
which is claimed slack that spills. A group's own box never sweeps — a group
never extrudes — while its members' swept boxes are what `group-escape`
measures against the group's flat frame. A node the renderer resolves flat
because its shape cannot carry a face SHALL NOT sweep either, by reading
the same predicate rather than a second copy of it. The sweep SHALL be taken
from the box's own extent on each axis rather than from `w` and `h` as
written, because a mirrored dimension draws the same picture and would
otherwise cancel the rise or shrink the box — and a sweep that shrinks
**withdraws** a finding the flat checker already made, which is the one
thing depth must never do. The swept box stands for the faces;
they are not modeled stroke-by-stroke, and no finding SHALL pretend
otherwise.

The motivating defect shipped in this repository: a slab whose box ended
10 px inside the viewBox carried its deep face 2 px outside it, the render
clipped the face, and the eye — not the checker — caught it. `out-of-bounds`
over the swept box is that eye made mechanical.

Turning extrusion off SHALL restore the flat measurement exactly: for a
diagram with no `extrude` and no `depth` anywhere, no rule SHALL read a swept
box and no anchor SHALL move, so every finding is the one the checker makes
measuring that diagram flat. That is a statement about depth costing nothing
where it is unused, and not a promise that the flat measurement is never
itself corrected: a defect fixed in what a rule measures flat moves both
readings together and does not breach this.

#### Scenario: A face crossing the viewBox is out of bounds
- **WHEN** an extruded node's box ends inside the viewBox but `x + w + d` falls outside it
- **THEN** `check` reports `out-of-bounds` for that node, where the flat box alone would have passed

#### Scenario: A mirrored node is measured like the picture it draws
- **WHEN** one rectangle is written with a negative dimension and another with the same extent written positively, both extruded
- **THEN** `check` reports the same rules against both, and neither loses a finding it made flat — save for each finding's `at`, which stays the corner its node was written from, since the place to look at a clipped slab is the node that casts it

#### Scenario: Slabs that touch only in depth still overlap
- **WHEN** two extruded nodes' boxes are disjoint but their swept boxes intersect
- **THEN** `check` reports `node-overlap` naming both

#### Scenario: An edge is walked from the moved anchor
- **WHEN** a rule measures an edge leaving side `r` of an extruded node
- **THEN** the path it walks starts at the silhouette edge's midpoint, the same point `draw` attaches the edge to

### Requirement: A depth the renderer refuses is a finding, not a pass
`check` SHALL report `undrawable-depth` as an **error** wherever `draw`
would throw for the same diagram: an options `depth` that is not a positive
finite number while `options.extrude` is true, and any extruded node whose
asked-for depth, `node.depth ?? options.depth ?? DEPTH`, is not a positive
finite number. The finding SHALL name the offender the way the throw does,
distinguishing a node's own depth from an inherited options depth.

The quantity judged is the magnitude the pair names, not the depth
resolution yields. The two differ exactly where a shape cannot carry a face:
resolution answers nought there, so reading it instead would report every
face-less shape whose depth is perfectly good, and report nothing for the
face-less shape whose depth is not, inverting the rule in both directions
at once. A 10 × 8 pill at `depth: 12` SHALL report nothing and the same pill
at `depth: 0` SHALL report `undrawable-depth`.

Reporting rather than throwing is the checker's standing difference from
the renderer, already written into `duplicate-id`: `draw` stops at the first
defect, and `check` reports it alongside everything else, which is the
difference between one round trip and five. A checker that read an
undrawable depth as flat would return no findings for a diagram the
renderer refuses outright, which inverts the order the tools prescribe —
check first, then render — and breaks this capability's own promise that
the checker measures what the renderer draws.

A node whose depth is refused SHALL be measured **flat** as well as
reported. The report is the defect; a cascade of consequences derived from a
number the renderer will not draw is noise standing beside it. An infinite
depth swept an infinite box before this rule was written down, so a spurious
`out-of-bounds` accompanied every genuine finding.

`undrawable-depth` joins `RuleId` additively. The union is stable in the
sense that a published id never changes meaning, not in the sense that it
never grows.

#### Scenario: An undrawable options depth is reported, not passed
- **WHEN** `check` runs on a diagram with `extrude: true` and a `depth` of `NaN`
- **THEN** it reports `undrawable-depth` as an error, together with every other finding, where the same diagram makes `draw` throw

#### Scenario: An inherited undrawable depth names the node
- **WHEN** an extruded node's asked-for depth is invalid because it inherited it from the options
- **THEN** the finding names that node and says the value was inherited, matching the words the renderer throws with

#### Scenario: A depth is judged for what it is, not for the box it lands in
- **WHEN** a shape too small to carry a face extrudes at a valid depth, and another the same size extrudes at an invalid one
- **THEN** `check` reports nothing for the first and `undrawable-depth` for the second, because what is judged is the depth the pair asks for and not the nought that resolution answers for a face-less shape

#### Scenario: A refused depth is reported once, not compounded
- **WHEN** a node extrudes at a depth the renderer refuses, inside a viewBox its swept box would otherwise escape
- **THEN** `check` reports `undrawable-depth` and measures that node by its flat box, so no second finding is derived from the number that was refused

#### Scenario: A shape that cannot carry a face is not a defect
- **WHEN** a pill whose larger dimension falls under `3 × ARC_MIN_CHORD / π` carries a valid depth
- **THEN** `check` reports no `undrawable-depth`, and measures that node by its flat box, because the renderer resolves it flat rather than refusing it

#### Scenario: A label's room does not grow with depth
- **WHEN** an extruded node's label width is measured by `text-overflow`
- **THEN** the room is the front box's, exactly what a flat node of the same box offers

#### Scenario: A member's slab can escape its group
- **WHEN** an extruded member's swept box crosses its group's frame while its flat box does not
- **THEN** `check` reports `group-escape`, measured against the group's flat frame, because the group itself never extrudes

#### Scenario: Depth adds nothing to a flat diagram
- **WHEN** `check` runs on a diagram with no `extrude` and no `depth` anywhere
- **THEN** its findings are exactly those of the same diagram measured flat, with no rule reading a swept box and no anchor moved

