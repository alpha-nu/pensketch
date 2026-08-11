# core-renderer — Delta Specification

> A span annotation the data model can state, drawn as one stroke, in a phase
> of its own. Geometry and the shapes rejected: brace-annotations/design.md.

## ADDED Requirements

### Requirement: A span can be braced
A diagram SHALL accept `braces`, each spanning `from` to `to` with a `depth`
giving the perpendicular offset of its tip from the midpoint of that span,
positive to the right of travel — the sign convention an edge's `bow` carries.
`kind` SHALL select a curly brace or a square bracket, and both SHALL be drawn
from points the caller's numbers determine, with nothing inferred from what
the brace happens to span.

A brace SHALL be drawn as **one** point list through a single `stroke`, never
as a sequence of separate strokes, because `pass` damps a leg's final point
and re-jitters independently per call: a shared point drawn twice lands about
a stroke's width apart, which reads as a break at a tangent join where it
reads as a hand-drawn corner at a right angle.

A brace and its label SHALL be drawn in `theme.pen`, the role that already
carries a group's border and a group's title, because a brace bounds a set and
names it for the cases a rectangle cannot serve. It SHALL NOT use `theme.ink`,
which would set it competing with the shapes it spans, nor `theme.accent`,
which would read as a note about the picture rather than part of it.

A brace SHALL take `lines`, `lx`, `ly` and `anchor` with the meaning they
carry on an edge's label, and `draw()` SHALL throw when `lines` is given
without numeric `lx` and `ly`. Nothing SHALL position the label relative to
the tip: this library does not measure text, and a caller who knows the depth
knows where the tip is.

#### Scenario: A group without a box
- **WHEN** a brace spans three boxes that are not enclosed by a group
- **THEN** it is drawn alongside them without claiming the space between, and no `raw` callback is required to express it

#### Scenario: It survives a JSON boundary
- **WHEN** a diagram containing a brace is serialized, sent over an interface that carries data rather than code, and rendered by the receiver
- **THEN** the brace is drawn, because it is data and not a function

#### Scenario: A bracket needs no arc
- **WHEN** `kind` is `square`
- **THEN** the brace is four points out, along and back, with no sampled curve in it

#### Scenario: The tip flips with the sign
- **WHEN** two braces share a span and are given equal and opposite `depth`
- **THEN** they face opposite sides of it

#### Scenario: One stroke, not six
- **WHEN** a curly brace renders
- **THEN** the svg gains exactly the two `<path>` elements one `stroke` produces, and the line is continuous through the joins between its arcs and its runs

#### Scenario: A label without coordinates is refused
- **WHEN** a brace carries `lines` and no numeric `lx`/`ly`
- **THEN** `draw()` throws, in the same terms as an edge label without coordinates

## MODIFIED Requirements

> The two requirements below are restated from the text `arc-connectors`
> leaves behind, not from what is in the main spec today. That change archives
> first.

### Requirement: The public API surface is closed
`@pensketch/core` SHALL export exactly: `mulberry32`, `pen`, `draw`, `anchor`,
`defaultTheme`, the frozen `constants` object, and the types in design.md D2 —
and nothing else. `Pen` SHALL expose exactly `stroke`, `arrow`, `rect`,
`pill`, `arc`, `diamond`, `hatch`, `label`, `wash`, and `rng`. `label` SHALL
accept a `string` (normalized to a one-element array) or a `string[]`.

Every type a caller can write into a diagram SHALL be exported by name,
`DiagramBrace` among them. A field table in a README and a `$defs` entry in the
schema are not a substitute: a caller who factors a brace into a helper needs
to annotate it, and a type that only the schema names cannot be annotated at
all.

#### Scenario: No accidental exports
- **WHEN** the built module's export names are enumerated
- **THEN** they match the design.md D2 surface exactly

#### Scenario: The surface opens by exactly one name
- **WHEN** a pen's own members are enumerated
- **THEN** they are the names above and no others, `arc` being the only one this change adds

#### Scenario: A member type is nameable
- **WHEN** a TypeScript caller imports a diagram member's type from the package root
- **THEN** it resolves, for every member the data model accepts

### Requirement: Invalid diagram data fails fast and specific
`draw()` SHALL throw an `Error` naming the offending item for: an edge
referencing an unknown node id, two nodes sharing an id, a node with an
unknown shape, an edge `label` without numeric `lx`/`ly`, a brace's `lines`
without them, an edge whose `from`
and `to` name the same node but **different** sides, an edge or note combining
`bow` with `via`, and a self-transition carrying `via` or `bow`. Each message
SHALL carry what the caller needs to fix it without reading the source — the
ids that do exist, the shapes that are accepted, why a label needs coordinates,
that a loop attaches to one side, or what already describes the path a second
field is trying to describe — since the caller may be a program with no view of
the result. The four ways one path can be described twice SHALL produce one
message shape, naming the field that is refused and what already describes the
path. A field that **contradicts** the path actually drawn SHALL throw; a field
that merely does not **apply** to it SHALL be ignored. That is the line between
`via` or `bow` on a loop, which describe corners it will not turn at and a
bulge it will not carry, and `out` or `span` on a straight edge, which describe
a loop that is not being drawn and whose names say so. An empty `via` describes
no corners, contradicts nothing, and SHALL be ignored wherever a filled one
throws. A `bow` that is not a finite number SHALL throw rather than draw, as
`out` and `span` already do, rather than reading as absent and drawing the
straight line. There SHALL be no other validation, no console warnings, and no
silent fallbacks in library code.

#### Scenario: Unknown node id
- **WHEN** an edge references node id `"ghost"` that no node declares
- **THEN** `draw()` throws an `Error` whose message contains the edge index, `"ghost"`, and the ids the diagram does declare

#### Scenario: A repeated id is not resolved silently
- **WHEN** two nodes declare the same `id`
- **THEN** `draw()` throws rather than keeping one of them, since every edge naming that id would otherwise point at a node the author did not mean

#### Scenario: A brace label without coordinates
- **WHEN** a brace carries `lines` and `lx` or `ly` is not a number
- **THEN** `draw()` throws, in the words an edge label is refused in, because the reason is the same one: nothing here measures text

### Requirement: Diagram render order is normative
`draw()` SHALL render groups, then edges, then non-group nodes, then braces,
then notes, then raw callbacks — each phase in array order, with the per-phase
styling fixed in design.md D3 — and SHALL first remove all existing children so
re-drawing is idempotent.

Braces sit between the shapes and the notes deliberately: a brace is drawn
over what it spans and under the annotation that explains it. The position is
part of the rendered bytes, so it is fixed here rather than left to the
implementation.

#### Scenario: Z-order
- **WHEN** a diagram with a group, an edge, a box, a brace, a note, and a raw callback is drawn
- **THEN** the svg's children appear in group → edge → node → brace → note → raw order

#### Scenario: A diagram that braces nothing is unchanged
- **WHEN** a diagram with no `braces` is rendered by a version that supports them
- **THEN** it serializes byte-identically to before, because the new phase draws from the seeded sequence only when it has something to draw

#### Scenario: Idempotent redraw
- **WHEN** `draw()` is called twice in a row with identical inputs
- **THEN** the svg contains the content exactly once and serializes identically to a single call
