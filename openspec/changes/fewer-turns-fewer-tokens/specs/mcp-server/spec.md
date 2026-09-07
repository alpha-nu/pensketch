# mcp-server — Delta Specification

## MODIFIED Requirements

### Requirement: Three tools, all pure
The server SHALL expose `check_diagram`, `render_diagram` and `render_png`.
All SHALL be pure functions of their arguments: no network access, no
filesystem access, no stored state, no secrets. `check_diagram` SHALL return
the checker's findings plus a count of errors and warnings. `render_diagram`
SHALL return SVG text **and the findings for the drawing it just made**.
`render_png` SHALL return image content.

`render_diagram`'s findings SHALL be computed over the geometry it rendered,
including `extrude` and `depth`, so they describe the drawing the caller
received rather than a different one. Purity is untouched: the findings come
from the same arguments, and calling the tool twice still returns the same
bytes.

`check_diagram` SHALL remain, and SHALL NOT instruct callers to run it before
rendering. It serves the caller who wants findings without markup, and the
caller about to spend a multi-second raster.

A refusal SHALL stay one block. `render_diagram` returns two blocks when it
draws and one, carrying `isError`, when it cannot: there is no drawing to
report findings for. A caller reading the second block unconditionally SHALL
find it absent on a throw, which is the same shape every tool here has always
had for an error.

#### Scenario: Checking a diagram with a defect
- **WHEN** `check_diagram` is called with a diagram whose nodes overlap
- **THEN** it returns the finding and a non-zero error count

#### Scenario: One call, both answers
- **WHEN** `render_diagram` is called with a diagram whose label overflows its box
- **THEN** it returns the markup and the `text-overflow` finding together, and the caller needs no second call to learn of it

#### Scenario: A diagram that cannot be drawn
- **WHEN** `render_diagram` is called with a diagram `draw` refuses
- **THEN** it returns one block carrying the renderer's message and `isError`, not a second block reporting findings for a drawing that does not exist

#### Scenario: A clean diagram says so
- **WHEN** `render_diagram` is called with a diagram that has no findings
- **THEN** it returns the markup and reports no findings, rather than omitting the report

#### Scenario: The same call twice
- **WHEN** any tool is called twice with identical arguments
- **THEN** the results are identical, because nothing outside the arguments is read

## ADDED Requirements

### Requirement: The tool descriptions ask for the cheap spelling
The `diagram` argument description SHALL ask for compact JSON, and SHALL be
honest that it is a request rather than a constraint: the model chooses how it
spells its own output. Measured across ten shipped figures, the difference is
4,832 tokens pretty-printed against 2,454 minified.

#### Scenario: A description that does not overclaim
- **WHEN** the `diagram` description is read
- **THEN** it asks for compact JSON without asserting that non-compact JSON is refused, because it is not
