# core-renderer — Delta Specification

> A curved primitive, a self-transition the data model can state, and a
> perpendicular offset that separates two connectors sharing a pair. Geometry
> and reasoning: arc-connectors/design.md.

## ADDED Requirements

### Requirement: An arc is a sampled polyline like every other stroke
The pen SHALL expose `arc(cx, cy, rx, ry, from, to, opts)`, sweeping an
elliptical arc from angle `from` to angle `to` in radians, the sign of the
difference giving direction. It SHALL sample the arc into points and draw them
through the same two-pass `stroke` as every other primitive, so that a curve
carries the same jitter, the same damped ends and the same pressure as a
straight line. It SHALL NOT emit a Bézier or any other smooth path command.

#### Scenario: A curve wobbles like the rest of the picture
- **WHEN** an arc and a straight line are drawn by the same pen at the same seed
- **THEN** both are `<path>` elements of jittered line segments, and neither carries a curve command

#### Scenario: Sampling is dense enough to read as a curve
- **WHEN** a half-circle is drawn at a typical loop size
- **THEN** its sampled points are close enough together that the result reads as an arc rather than as a polygon

### Requirement: A self-transition is stated in the data
An edge whose `from` and `to` name the same node id and the same side SHALL
draw a loop leaving and returning to that side, with the arrowhead on the
returning anchor. `out` SHALL set how far the loop projects beyond the side and
`span` SHALL set how far apart its two anchors sit along it; both SHALL have
documented defaults and SHALL NOT be derived from the node's dimensions. The
loop SHALL take `label`, `lx`, `ly`, `anchor` and `dotted` with the same
meaning they carry on any other edge.

#### Scenario: A state machine states its own loop
- **WHEN** an edge names the same node and side at both ends
- **THEN** a loop is drawn off that side, and no `raw` callback is required to express it

#### Scenario: It survives a JSON boundary
- **WHEN** a diagram containing a self-transition is serialized, sent over an interface that carries data rather than code, and rendered by the receiver
- **THEN** the loop is drawn, because it is data and not a function

#### Scenario: The checker can see it
- **WHEN** a self-transition's loop or its label lies outside the `viewBox`, or its label sits on a connector
- **THEN** `check` reports it, where a loop drawn through `raw` was invisible to every rule

### Requirement: A connector can bow off its chord
An edge SHALL accept `bow`, offsetting the apex of its path from the midpoint
of the straight line between its anchors, perpendicular to that line, by the
given number of pixels. A positive value SHALL offset to the right of travel,
so that two edges between the same pair, given the same positive `bow`, bow to
opposite sides. A note pointer SHALL accept `bow` with the same meaning.

#### Scenario: Two connectors between one pair are told apart
- **WHEN** `A→B` and `B→A` are both given `bow: 30`
- **THEN** they curve to opposite sides of the line between the two nodes and are separately readable

#### Scenario: An unbowed edge is unchanged
- **WHEN** an edge omits `bow`
- **THEN** its path is exactly what it was before this change, byte for byte

## MODIFIED Requirements

### Requirement: Invalid diagram data fails fast and specific
`draw()` SHALL throw an `Error` naming the offending item for: an edge
referencing an unknown node id, two nodes sharing an id, a node with an
unknown shape, an edge `label` without numeric `lx`/`ly`, an edge whose `from`
and `to` name the same node but **different** sides, and an edge or note
combining `bow` with `via`. Each message SHALL carry what the caller needs to
fix it without reading the source — the ids that do exist, the shapes that are
accepted, why a label needs coordinates, that a loop attaches to one side, or
that a path with corners is already described — since the caller may be a
program with no view of the result. There SHALL be no other validation, no
console warnings, and no silent fallbacks in library code.

#### Scenario: Unknown node id
- **WHEN** an edge references node id `"ghost"` that no node declares
- **THEN** `draw()` throws an `Error` whose message contains the edge index, `"ghost"`, and the ids the diagram does declare

#### Scenario: A repeated id is not resolved silently
- **WHEN** two nodes declare the same `id`
- **THEN** `draw()` throws rather than keeping one of them, since every edge naming that id would otherwise point at a node the author did not mean

#### Scenario: A loop across two sides is refused rather than guessed
- **WHEN** an edge names the same node at both ends but two different sides
- **THEN** `draw()` throws, naming the node and saying a self-transition attaches to one side — where before this change the same data rendered a meaningless stub across the node's corner with no error at all

#### Scenario: A described path is not curved as well
- **WHEN** an edge or a note carries both `bow` and `via`
- **THEN** `draw()` throws, because the caller has already described the path and there is no reading of "curve it too" that does not invent geometry on their behalf
