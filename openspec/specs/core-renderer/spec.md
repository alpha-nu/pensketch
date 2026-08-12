# core-renderer Specification

## Purpose
TBD - created by archiving change initial-release. Update Purpose after archive.
## Requirements
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
Every primitive the reference draws SHALL reproduce its behavior exactly:
double-pass strokes (second pass ×.75 width, opacities .92/.5, round caps),
~26 px segmentation with ×.4 endpoint damping, dash pattern `2 7` for dotted,
corner overshoot `4 × rng()` per rect stroke end in the reference's stroke
order, 26-segment pills with radius jitter 3/2 at amplitude 1.4,
closed-midpoint diamonds, 11 px-spaced hatching cut to the rectangle it is given
in the reference's own closed form, per-line `<text>`
labels with `dominant-baseline:middle` and inline fill/size style, and plain
`rx=6` wash rects. A primitive the port adds where the reference has none —
`arc` is the first — SHALL be assembled from those same passes rather than
from a second way of drawing, and `reference/renderer.html` SHALL NOT be
edited to acquire it: it is the ground truth the port is measured against, and
a target that moves measures nothing. All aesthetic constants SHALL live as
named exports in `constants.ts` and SHALL NOT be runtime-configurable in this
release.

#### Scenario: Double-stroke structure
- **WHEN** a single `stroke()` call renders
- **THEN** exactly two `<path>` elements are appended, the second with `stroke-width` equal to ×.75 of the first and opacities .92 and .5 respectively

#### Scenario: Dotted stays dotted only on the shaft
- **WHEN** `arrow()` renders with `dotted: true`
- **THEN** the shaft paths carry `stroke-dasharray="2 7"` and the two arrowhead strokes carry none

#### Scenario: A primitive the reference does not have
- **WHEN** `arc()` renders
- **THEN** it appends the same two jittered `<path>` elements every other primitive appends

#### Scenario: Adding a primitive moves nothing already drawn
- **WHEN** a diagram that calls no arc is rendered by a port that has one
- **THEN** it still serializes byte-identical to the golden generated from the reference, since the new code draws from the seeded sequence only when it is invoked

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

### Requirement: An arc is a sampled polyline like every other stroke
The pen SHALL expose `arc(cx, cy, rx, ry, from, to, opts)`, sweeping an
elliptical arc from angle `from` to angle `to` in radians, the sign of the
difference giving direction. It SHALL sample the arc into points and draw them
through the same two-pass `stroke` as every other primitive, so that a curve
carries the same jitter, the same damped ends and the same pressure as a
straight line. It SHALL NOT emit a Bézier or any other smooth path command.
Sampling SHALL be no coarser than the segmentation a straight leg receives: at
any radius, no chord of a sampled arc SHALL be longer than that segment
length. It SHALL also be no finer than the pen's own hand: no chord SHALL be
shorter than the finest the look already contains, because `pass` splits every
chord again and jitters both ends of each piece, so a chord shorter than the
jitter is drawn as a line doubling back on itself. Sampling finer than that
buys nothing either — a chord departs its arc by less than the jitter moves the
point anyway — so it is loss with no gain.

#### Scenario: A curve wobbles like the rest of the picture
- **WHEN** an arc and a straight line are drawn by the same pen at the same seed
- **THEN** both are `<path>` elements of jittered line segments, and neither carries a curve command

#### Scenario: Sampling is dense enough to read as a curve
- **WHEN** a half-circle is drawn at a typical loop size
- **THEN** its sampled points are close enough together that the result reads as an arc rather than as a polygon

#### Scenario: A small arc is not drawn finer than the jitter
- **WHEN** an arc is drawn whose radius is small enough that a fixed angle per chord would produce chords of a few px — a brace's corner and a self-transition on a node-sized box are the cases that arise
- **THEN** it is sampled more coarsely instead, so the drawn line reads as a hand rather than as noise, and the shape it loses is less than the jitter it keeps

#### Scenario: A curve is never described more coarsely than a straight line
- **WHEN** an arc is drawn whose radius is large enough that a fixed angle per chord would produce chords longer than the renderer's own segment length — a connector bowed shallowly across a wide diagram is the case that arises
- **THEN** it is sampled more finely instead, so no leg of a curve is longer than a leg of a straight line beside it

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

### Requirement: Hatching is cut to the shape's outline
`hatch` SHALL rule 45° lines across the rectangle it is given, `HATCH_GAP`
apart, and cut each of them to that rectangle in closed form. Given a clip
polygon it SHALL cut them to that instead — the same lines, cut somewhere
else — leaving the rectangle to say only which lines are ruled.

Cutting to a polygon SHALL solve each of its edges for the line, sort the
crossings along the line and stroke them in pairs, which fills by the even-odd
rule and so admits a concave or self-intersecting outline. Edges SHALL be
walked wrapping round, so a polygon that repeats its first point and one that
does not are the same outline. A crossing SHALL be counted when the line falls
in the half-open interval between the edge's two ends taken low to high,
whichever way round the edge runs: a line crossing through a vertex is then
reported by one of the two edges meeting there, and a line that only touches
one by both or by neither, which is what keeps the crossings in pairs. Reading
that interval from each edge's direction of travel instead reports every vertex
once, which is right for a crossing and wrong for a touch, and one stray
crossing pairs the whole line up wrongly.

`draw` SHALL pass a clip for every shape whose outline is not its box, and none
for a `box`. The clip SHALL stand `HATCH_INSET` inside the outline the node is
drawn with, measured perpendicular to that outline, which is not the same as
the outline inscribed in the box inset by `HATCH_INSET`: on a 150 × 76 diamond
the second leaves 1.81 px and on a 278 × 30 one it leaves nothing at all. A
shape too small to hold the inset SHALL shade nothing rather than shade a
mirrored sliver of itself.

A `box` SHALL keep the closed form. The reference emits a degenerate
zero-length stroke at its first scanline where a contour clip emits nothing —
14 strokes against 13 for `SAMPLER`, 21 against 20 for `BUDGETS` — so routing a
box through the clip would fail parity structurally rather than by rounding,
and `reference/renderer.html` is normative.

#### Scenario: A hatched box is shaded exactly, and identically to before
- **WHEN** a node with `shape: 'box'` and `hatch: true` is drawn
- **THEN** every hatch stroke lies within the node's box inset by `HATCH_INSET`, allowing for the hatch jitter, and the parity goldens are unchanged

#### Scenario: A hatched pill is shaded inside its ellipse
- **WHEN** a node with `shape: 'pill'` and `hatch: true` is drawn
- **THEN** every hatch ink point lies within the ellipse the pill traces, allowing for the jitter

#### Scenario: A hatched diamond is shaded inside its four sides
- **WHEN** a node with `shape: 'diamond'` and `hatch: true` is drawn
- **THEN** every hatch ink point lies within the diamond, and each corner of its box — half the box's area and none of the shape's — is bare

#### Scenario: A vertex the line only touches keeps the crossings paired
- **WHEN** a ruled line meets a clip's vertex without leaving the shape there
- **THEN** the span runs on to the shape's true boundary rather than stopping at that vertex

#### Scenario: A caller's own outline can be shaded
- **WHEN** a `raw` callback strokes a polygon of its own and passes those points to `hatch`
- **THEN** the shading is cut to that polygon, concave notches included

