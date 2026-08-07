# core-renderer — Delta Specification

> The `@pensketch/core` package: a seeded, hand-sketch SVG diagram renderer
> ported from `reference/renderer.html` (normative, read-only). Exact API
> shapes and aesthetic constants: design.md D2–D4.

## ADDED Requirements

### Requirement: Rendering is deterministic by contract
Given the same package version, diagram, seed, and theme, `draw()` SHALL
produce byte-identical serialized SVG on every call and on every machine
running a given JavaScript engine. Cross-engine identity is not claimed:
trigonometric results reach the emitted coordinates directly and ECMAScript
leaves them implementation-approximated. Package source SHALL NOT call
`Math.random`,
`Date`, timers, or locale-dependent APIs; all randomness SHALL flow from the
seeded `mulberry32` PRNG, and the order of PRNG consumption is part of the
public contract — reordering draw operations is a visual change even when
output looks the same.

#### Scenario: Same seed, same bytes
- **WHEN** the same diagram is drawn twice into two fresh `<svg>` elements with the same seed and theme
- **THEN** the two serializations are byte-identical

#### Scenario: Different seed, different wobble
- **WHEN** the same diagram is drawn with seed 7 and seed 8
- **THEN** the serializations differ (the wobble moved), while node positions and text content are unchanged

### Requirement: The public API surface is closed
`@pensketch/core` SHALL export exactly: `mulberry32`, `pen`, `draw`, `anchor`,
`defaultTheme`, the frozen `constants` object, and the types in design.md D2 —
and nothing else. `Pen` SHALL expose exactly `stroke`, `arrow`, `rect`,
`pill`, `diamond`, `hatch`, `label`, `wash`, and `rng`. `label` SHALL accept a
`string` (normalized to a one-element array) or a `string[]`.

#### Scenario: No accidental exports
- **WHEN** the built module's export names are enumerated
- **THEN** they match the design.md D2 surface exactly

### Requirement: Port output is byte-identical to the reference
The port SHALL serialize byte-identical to golden files generated from
`reference/renderer.html` itself when rendering the `SAMPLER` fixture
(seed 7) and the `BUDGETS` fixture (seed 11) with the reference theme bridge
(design.md D5). Goldens SHALL be generated only from the reference (never
from the port) and checked in.

#### Scenario: Parity holds
- **WHEN** the port renders both fixtures with the reference-theme bridge and the shared serializer
- **THEN** output equals the checked-in goldens byte-for-byte

#### Scenario: Goldens cannot drift silently
- **WHEN** the golden generator is re-run against an unchanged reference
- **THEN** the checked-in golden files are unchanged (`git diff` clean)

### Requirement: Hand-sketch primitive fidelity
Every primitive SHALL reproduce the reference behavior exactly: double-pass
strokes (second pass ×.75 width, opacities .92/.5, round caps), ~26 px
segmentation with ×.4 endpoint damping, dash pattern `2 7` for dotted, corner
overshoot `4 × rng()` per rect stroke end in the reference's stroke order,
26-segment pills with radius jitter 3/2 at amplitude 1.4, closed-midpoint
diamonds, 11 px-spaced clipped hatching, per-line `<text>` labels with
`dominant-baseline:middle` and inline fill/size style, and plain `rx=6` wash
rects. All aesthetic constants SHALL live as named exports in `constants.ts`
and SHALL NOT be runtime-configurable in this release.

#### Scenario: Double-stroke structure
- **WHEN** a single `stroke()` call renders
- **THEN** exactly two `<path>` elements are appended, the second with `stroke-width` equal to ×.75 of the first and opacities .92 and .5 respectively

#### Scenario: Dotted stays dotted only on the shaft
- **WHEN** `arrow()` renders with `dotted: true`
- **THEN** the shaft paths carry `stroke-dasharray="2 7"` and the two arrowhead strokes carry none

### Requirement: Diagram render order is normative
`draw()` SHALL render groups, then edges, then non-group nodes, then notes,
then raw callbacks — each phase in array order, with the per-phase styling
fixed in design.md D3 — and SHALL first remove all existing children so
re-drawing is idempotent.

#### Scenario: Z-order
- **WHEN** a diagram with a group, an edge, a box, a note, and a raw callback is drawn
- **THEN** the svg's children appear in group → edge → node → note → raw order

#### Scenario: Idempotent redraw
- **WHEN** `draw()` is called twice in a row with identical inputs
- **THEN** the svg contains the content exactly once and serializes identically to a single call

### Requirement: Theming flows through CSS variables with baked fallbacks
The default theme SHALL emit `var(--ps-ink, #232B36)`-style values (full set:
design.md D4) verbatim into SVG attributes, so a host page restyles diagrams
— including dark mode — purely by redefining `--ps-*` variables. A partial
theme override SHALL replace only the provided keys. The package SHALL ship
no CSS and no fonts.

#### Scenario: Dark mode without re-rendering
- **WHEN** a rendered diagram's host page redefines the `--ps-*` variables under a dark scheme
- **THEN** the diagram recolors with no JS involvement

#### Scenario: Partial override
- **WHEN** `draw()` runs with `theme: { ink: 'hotpink' }`
- **THEN** ink-colored output uses `hotpink` while all other roles keep their `--ps-*` defaults

### Requirement: Invalid diagram data fails fast and specific
`draw()` SHALL throw an `Error` naming the offending item for: an edge
referencing an unknown node id, two nodes sharing an id, a node with an
unknown shape, and an edge `label` without numeric `lx`/`ly`. Each message
SHALL carry what the caller needs to fix it without reading the source — the
ids that do exist, the shapes that are accepted, or why a label needs
coordinates — since the caller may be a program with no view of the result.
There SHALL be no other validation, no console warnings, and no silent
fallbacks in library code.

#### Scenario: Unknown node id
- **WHEN** an edge references node id `"ghost"` that no node declares
- **THEN** `draw()` throws an `Error` whose message contains the edge index, `"ghost"`, and the ids the diagram does declare

#### Scenario: A repeated id is not resolved silently
- **WHEN** two nodes declare the same `id`
- **THEN** `draw()` throws rather than keeping one of them, since every edge naming that id would otherwise point at a node the author did not mean

### Requirement: Core is DOM-implementation independent
Element creation SHALL go through `svg.ownerDocument.createElementNS`; the
package SHALL NOT reference the global `document` or `window`, so rendering
works in any conforming DOM (browser, jsdom, happy-dom) by passing an
`SVGSVGElement` from that DOM.

#### Scenario: Renders under jsdom
- **WHEN** `draw()` is invoked on an svg element created by a jsdom document in Node
- **THEN** rendering completes and the serialization matches the browser-identical bytes

### Requirement: Optional accessible labeling
When `DrawOptions.label` is provided, `draw()` SHALL set `role="img"` and
`aria-label` on the target svg; when absent it SHALL set neither.

#### Scenario: Labeled diagram
- **WHEN** `draw(svg, diagram, { label: 'Request flow' })` runs
- **THEN** the svg carries `role="img"` and `aria-label="Request flow"`
