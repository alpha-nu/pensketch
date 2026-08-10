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
