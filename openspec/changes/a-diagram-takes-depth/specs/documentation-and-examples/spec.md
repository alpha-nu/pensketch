# documentation-and-examples — Delta Specification

> Two enumerations went false the same way and neither gate could see it. The
> hero requirement fires on "a connector or annotation shape" and depth is a
> node treatment; the examples requirement lists what the bundled diagrams
> demonstrate and never learned the word. Both are widened, the folder that
> carries extrusion is named, and the general hazard is written into the body
> so the next enumeration is read rather than trusted. The stranded
> blockquote at the end of "Runnable examples" is dropped here rather than at
> archive - it is a previous change's note to its own reviewer, it is about
> "Root README covers the full learning path" and not about examples at all,
> and its one durable sentence is promoted into the requirement body.

## MODIFIED Requirements

### Requirement: README hero images are generated, deterministic, and committed
`tools/render-assets.mjs` SHALL render its own hero diagram at 2× to
`docs/assets/hero-light.png` (background `#FFFFFF`) and, under emulated
dark `prefers-color-scheme`, `hero-dark.png` (background `#161B21`), with
corner pixels verified against the background; the PNGs SHALL be committed
and reproducible from the same repo state.

The hero is the first drawing anyone sees, and a reader who meets the project
there SHALL meet what it can draw. A release that adds anything to the data
model a reader would see in a picture - a connector shape, an annotation
shape, or a **treatment** applied to nodes that already exist - SHALL read the
hero again against it and draw it where the picture is better for it. The
earlier wording named shapes alone, and depth is a treatment rather than a
shape, so an entire feature passed a rule whose whole point is that the first
drawing shows what the library does. The hero is a picture
first: a shape appears because the drawing wanted it, never so that every
field is on display. Where the picture is better without a shape, that
judgement SHALL be recorded, so an absence reads as a decision rather than as
an oversight.

#### Scenario: Regeneration is a no-op on an unchanged repo
- **WHEN** the asset script re-runs with no source changes
- **THEN** the committed PNGs are unchanged

#### Scenario: The hero draws what the package can draw
- **WHEN** a release adds a connector shape, an annotation shape, or a node treatment to the data model
- **THEN** the hero draws it, or the change records why the picture is better without it

### Requirement: Runnable examples, each earning its folder
`examples/` SHALL contain `vanilla/` (a diagram drawn from data under the A4
theming, importing the built core dist relatively), `custom-pen/` (`pen()`
used on its own, plus whatever `raw` callbacks draw what the data model still
has no word for), `react/` (a Vite app rendering `<PenSketch>` with a seed
control and a `useSketch` drawing, deliberately wrapped in
`<React.StrictMode>`, and that drawing animated through the prop),
`state-machine/` (a state machine that branches on
a decision, with a dotted exception path routed back into the node it left,
and a self-transition stated in data), `showcase/` (this project's own
logical architecture, drawn under the same theming as `vanilla/`), and
`animation/` (several panels of one explanation, each drawing itself). Each
SHALL carry its own diagram,
chosen to exercise what that folder exists to demonstrate rather than to
repeat a README snippet. Examples SHALL be runnable per design.md D7, excluded
from publishing, coverage, and size budgets, ASCII-only in fixture strings,
and screenshot-verified at implementation time and after any API change.

`animation/` SHALL use `@pensketch/animation` as a caller would, rather than
stamping the attributes itself. An example that hand-rolls what the package
exists to do teaches the recipe this change was written to stop people
copying — and would keep working after the package had regressed, which is the
opposite of what a shipped example is for. It SHALL hold more than one panel,
because what the animation shows that a still cannot is the *order* the pen
lays a picture down in, and one panel makes that a detail rather than the
point.

The animation SHALL be demonstrated **twice**, once from each surface a caller
has: `animation/` for a page holding an element, and `react/` for the bindings.
The two are not the same demonstration in different syntax. The bindings apply
the motion inside an effect that also clears and redraws, and the prop is a
function compared by identity — so the failures that belong to React are a
second stylesheet where there should be one, none where there should be one,
and a drawing that restarts on every parent render. None of those can occur in
`animation/`.

It SHALL be `react/` that carries this rather than a folder of its own. A
seventh folder would have to reproduce what that one already is — StrictMode,
so every effect runs twice, and a diagram stepping on a timer, so the component
re-renders without being touched — which is precisely the environment in which
those three failures show themselves. A quieter example would demonstrate the
feature and test nothing, and this requirement already refuses a feature
demonstration with a diagram wrapped around it. `react/` SHALL declare
`@pensketch/animation` among its own dependencies, as it already declares the
core, because a caller importing the function is the whole of what the bindings
ask of them and an example that did not would not be showing the API.

`showcase/` SHALL reach for the breadth of the data model in one diagram —
every drawn shape, `accent` and `hatch`, a straight connector, an orthogonal
one, a self-transition, both kinds of brace, and notes whose pointers bow —
and SHALL do so **without `raw`**, so that what it draws is
expressible as data and can be served whole rather than served with a hole in
it. A feature that cannot be reached without `raw` SHALL be left to
`custom-pen/`, which exists for exactly that. The diagram SHALL state what its
own `hatch` and `dotted` mean, since the renderer attaches no meaning to
either and a picture using both without saying so teaches a convention that
does not exist.

Connectors leaving one node together SHALL be drawn alike. Reaching for a
`bow` to clear an obstacle one of them meets makes that one connector look
like a different kind of relationship from its siblings, when the difference
is only that its path was awkward. Where a straight run clips something,
choosing a different anchor SHALL be preferred to bending one line out of a
set: an anchor is free and a `bow` is a claim.

The bundled examples SHALL demonstrate what the library can draw, not only
what it once could not. Every connector shape the data model expresses — a
self-transition, and a pair of nodes joined both ways without the two lines
landing on top of each other — every annotation shape it expresses — a
brace and a bracket over a span — and every **treatment** it expresses over
the nodes themselves, extrusion included, SHALL appear in at least one shipped
example, so that a reader learning from the examples meets the feature and a
caller copying one starts from a diagram that uses it. An example added for
that purpose SHALL still earn its folder: it is a picture worth looking at
that happens to use the feature, never a feature demonstration with a diagram
wrapped around it.

Extrusion SHALL be carried by `vanilla/`, and the choice is the picture's
rather than the count's: a pipeline's stages are groups, which the renderer
never extrudes because a group bounds a set rather than being an object, while
its jobs are boxes and its gate is a decision that stays flat. The hybrid
therefore says something true about the drawing instead of demonstrating a
field. `showcase/` SHALL NOT be the folder that carries it while it remains
the breadth diagram: a picture reaching for every shape at once is the worst
place to introduce a register that applies to all of them, and depth reads as
a register rather than as an accent.

A requirement that enumerates what a document or a diagram contains goes false
the moment either grows, and `openspec validate --strict` cannot see it. Every
list in this requirement is therefore a claim with a short life, and a change
that adds to the data model SHALL read them against the addition rather than
trusting that a gate would have said something.

Every shipped diagram SHALL be loadable as data by `tools/shipped-diagrams.mjs`
and SHALL pass `check` in CI, so that an example cannot teach a defect the
project publishes a rule against. A diagram that extrudes SHALL pass it
**extruded**, checked with the pair the page draws with, since the sweep is
what the rules measure and a flat check of an extruded page is a check of a
drawing nobody is making.

#### Scenario: Vanilla example runs from a fresh clone
- **WHEN** a user runs `npm ci && npm run build` at the root, serves the repository over HTTP, and opens `examples/vanilla/index.html` (browsers refuse ES-module imports over `file://`)
- **THEN** the quickstart diagram renders, and flips theme under a dark color scheme

#### Scenario: React example exercises both APIs
- **WHEN** `npm install && npm run dev` runs inside `examples/react`
- **THEN** the page renders its diagram via `<PenSketch>`, redraws it when the seed control changes, and draws a caption via `useSketch`, all under StrictMode

#### Scenario: What the data model gained is on show
- **WHEN** a reader looks through the shipped examples after this change
- **THEN** they find a self-transition, a bowed pair, and a braced span drawn from data, rather than reading that all three are possible and seeing none of them

#### Scenario: A node treatment is on show, not only described
- **WHEN** a reader looks through the shipped examples for extrusion
- **THEN** they find a diagram drawn with it, checked extruded by `npm run diagrams` and served with its `options` beside its data, rather than reading in the reference that the fields exist

#### Scenario: A demonstration still has to be a diagram
- **WHEN** an example is changed to show a new connector or annotation shape
- **THEN** the diagram still makes sense as a picture of something, and the shape is used because that picture needs it

#### Scenario: A new example folder reaches every gate that governs the others
- **WHEN** an example folder is added
- **THEN** its diagram is checked by `npm run diagrams`, and adding it without wiring it into `tools/shipped-diagrams.mjs` leaves it unchecked, which the folder count in this requirement exists to catch

#### Scenario: The showcase is served whole
- **WHEN** an agent reads `pensketch://example/showcase`
- **THEN** it receives the diagram as data with no `rawOmitted` note beside it, because there is no `raw` in it to omit

#### Scenario: The animation example is a caller, not a reimplementation
- **WHEN** `examples/animation` is read for how the drawing is set up
- **THEN** it calls `@pensketch/animation`, and stamps no `pathLength` and no index of its own

#### Scenario: Both surfaces are shown
- **WHEN** a reader looks for how to animate a diagram
- **THEN** they find it done from a page in `animation/` and through the bindings in `react/`, rather than inferring the second from the first

#### Scenario: The bindings are demonstrated where their failures are visible
- **WHEN** the animated `<PenSketch>` runs in `examples/react`
- **THEN** it does so under StrictMode and while the diagram is stepping on its timer, so a doubled stylesheet, a missing one, and a drawing that restarts on every render would all be seen rather than reasoned about
