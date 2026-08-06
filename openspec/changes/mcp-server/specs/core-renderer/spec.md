# core-renderer — Delta Specification

> A second way to render: to a string, where there is no DOM. Exact API and
> the reasoning: mcp-server/design.md D3.

## ADDED Requirements

### Requirement: Rendering to a string without a DOM
`@pensketch/core` SHALL export `renderToString(diagram, options)` from the
subpath `@pensketch/core/server`, returning the SVG markup that `draw`
produces. It SHALL have zero runtime dependencies, SHALL NOT require jsdom, a
browser, or any global `document`, and SHALL NOT be pulled into a consumer's
bundle by importing the root entry.

#### Scenario: Renders where there is no DOM
- **WHEN** `renderToString` is called in an environment with no `document` and no `SVGSVGElement`
- **THEN** it returns SVG markup

#### Scenario: The browser entry is unaffected
- **WHEN** a consumer imports only `@pensketch/core`
- **THEN** the root entry's min+gzip size is unchanged and this code is absent

### Requirement: The string renderer is the same renderer
`renderToString` SHALL produce byte-identical output to `draw` writing into a
real `<svg>` for the same diagram, seed, theme and engine. It SHALL match the
attribute ordering and escaping of the golden serializer, and a test SHALL
assert its output against a checked-in golden.

#### Scenario: String output matches DOM output
- **WHEN** the same diagram and seed are rendered by `renderToString` and by `draw` into a browser `<svg>`
- **THEN** the two markup strings are identical

#### Scenario: A second renderer cannot drift unnoticed
- **WHEN** `renderToString` produces output differing from the checked-in golden
- **THEN** the parity test fails, because byte parity is the project's contract and a divergent second renderer would break it silently
