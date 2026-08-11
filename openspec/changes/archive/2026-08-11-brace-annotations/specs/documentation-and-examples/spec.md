# documentation-and-examples — Delta Specification

> The reference lists the phases a diagram is drawn in. There is a new one,
> and a caller who learned the old list needs to know it moved.

> The requirement below is restated from the text `arc-connectors` leaves
> behind, not from what is in the main spec today. That change archives first.

## MODIFIED Requirements

### Requirement: Runnable examples, each earning its folder
`examples/` SHALL contain `vanilla/` (a diagram drawn from data under the A4
theming, importing the built core dist relatively), `custom-pen/` (`pen()`
used on its own, plus whatever `raw` callbacks draw what the data model still
has no word for), `react/` (a Vite app rendering `<PenSketch>` with a seed
control and a `useSketch` drawing, deliberately wrapped in
`<React.StrictMode>`), and `state-machine/` (a state machine that branches on
a decision, with a dotted exception path routed back into the node it left,
and a self-transition stated in data). Each SHALL carry its own diagram,
chosen to exercise what that folder exists to demonstrate rather than to
repeat a README snippet. Examples SHALL be runnable per design.md D7, excluded
from publishing, coverage, and size budgets, ASCII-only in fixture strings,
and screenshot-verified at implementation time and after any API change.

The bundled examples SHALL demonstrate what the library can draw, not only
what it once could not. Every connector shape the data model expresses — a
self-transition, and a pair of nodes joined both ways without the two lines
landing on top of each other — and every annotation shape it expresses — a
brace and a bracket over a span — SHALL appear in at least one shipped
example, so that a reader learning from the examples meets the feature and a
caller copying one starts from a diagram that uses it. An example added for
that purpose SHALL still earn its folder: it is a picture worth looking at
that happens to use the feature, never a feature demonstration with a diagram
wrapped around it.

Every shipped diagram SHALL be loadable as data by `tools/shipped-diagrams.mjs`
and SHALL pass `check` in CI, so that an example cannot teach a defect the
project publishes a rule against.

#### Scenario: Vanilla example runs from a fresh clone
- **WHEN** a user runs `npm ci && npm run build` at the root, serves the repository over HTTP, and opens `examples/vanilla/index.html` (browsers refuse ES-module imports over `file://`)
- **THEN** the quickstart diagram renders, and flips theme under a dark color scheme

#### Scenario: React example exercises both APIs
- **WHEN** `npm install && npm run dev` runs inside `examples/react`
- **THEN** the page renders its diagram via `<PenSketch>`, redraws it when the seed control changes, and draws a caption via `useSketch`, all under StrictMode

#### Scenario: What the data model gained is on show
- **WHEN** a reader looks through the shipped examples after this change
- **THEN** they find a self-transition, a bowed pair, and a braced span drawn from data, rather than reading that all three are possible and seeing none of them

#### Scenario: A demonstration still has to be a diagram
- **WHEN** an example is changed to show a new connector or annotation shape
- **THEN** the diagram still makes sense as a picture of something, and the shape is used because that picture needs it

#### Scenario: A new example folder reaches every gate that governs the others
- **WHEN** an example folder is added
- **THEN** its diagram is checked by `npm run diagrams`, and adding it without wiring it into `tools/shipped-diagrams.mjs` leaves it unchecked, which the folder count in this requirement exists to catch

### Requirement: README hero images are generated, deterministic, and committed
`tools/render-assets.mjs` SHALL render its own hero diagram at 2× to
`docs/assets/hero-light.png` (background `#FFFFFF`) and, under emulated
dark `prefers-color-scheme`, `hero-dark.png` (background `#161B21`), with
corner pixels verified against the background; the PNGs SHALL be committed
and reproducible from the same repo state.

The hero is the first drawing anyone sees, and a reader who meets the project
there SHALL meet what it can draw. A release that adds a connector or
annotation shape to the data model SHALL read the hero again against it and
draw the shape where the picture is better for it. The hero is a picture
first: a shape appears because the drawing wanted it, never so that every
field is on display. Where the picture is better without a shape, that
judgement SHALL be recorded, so an absence reads as a decision rather than as
an oversight.

#### Scenario: Regeneration is a no-op on an unchanged repo
- **WHEN** the asset script re-runs with no source changes
- **THEN** the committed PNGs are unchanged

#### Scenario: The hero draws what the package can draw
- **WHEN** a release adds a connector or annotation shape to the data model
- **THEN** the hero draws it, or the change records why the picture is better without it

### Requirement: A reference for callers who cannot see the result
The repository SHALL carry documentation addressed to a program generating
diagrams rather than to a person — `docs/agents.md` — covering the whole type
surface, the constants worth designing around, every error the renderer
throws, and the traps a type system cannot express. It SHALL state which
things are permanent design decisions rather than gaps, and SHALL be served
verbatim by `@pensketch/mcp` rather than restated.

Where a stated limitation ceases to be true, the reference SHALL be corrected
in the same change that lifts it, and the correction SHALL say what the
limitation was — a caller that learned the old rule needs to know it has
moved, not merely to find the new text. The trap list SHALL name
self-transitions as expressible in data, and `raw` SHALL be described as the
escape hatch for what the data model still has no word for rather than for
self-transitions specifically.

The phase list SHALL name `braces` in its place in the draw order, in the
reference and in both READMEs, since the order is part of the rendered bytes
and a caller reasoning about what covers what reads it there.

#### Scenario: The reference is the served reference
- **WHEN** an agent reads `pensketch://spec`
- **THEN** it receives `docs/agents.md` byte for byte, with no separately maintained copy able to drift from it

#### Scenario: A lifted limitation is corrected where it was stated
- **WHEN** a change makes a documented impossibility possible
- **THEN** the trap that stated it is rewritten in that same change, so no released version ships a reference that contradicts its own renderer

#### Scenario: The draw order documented is the draw order drawn
- **WHEN** a phase is added to the render order
- **THEN** every place that lists the phases is corrected in the same change, because a reader deducing z-order from a stale list gets a wrong answer with nothing to warn them

#### Scenario: An example stops needing the escape hatch
- **WHEN** an example drew a self-transition through `raw` only because the data model could not state one
- **THEN** it is rewritten to state it, its `rawOmitted` disclosure disappears with the callback, and what the server serves becomes the whole picture rather than the picture minus a stroke
