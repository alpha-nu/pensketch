# documentation-and-examples — Delta Specification

> A fifth example folder, `showcase/`, and the one thing that makes it
> different from the other four: it is drawn to exercise the breadth of the
> data model rather than one feature of it.

## MODIFIED Requirements

> Restated from the baseline in full, with all five of its scenarios carried
> word for word. `showcase/` joins the enumeration and one paragraph is added;
> nothing is removed, and the clause that an example must earn its folder is
> left exactly as written, because it is the clause this addition has to answer
> to.

### Requirement: Runnable examples, each earning its folder
`examples/` SHALL contain `vanilla/` (a diagram drawn from data under the A4
theming, importing the built core dist relatively), `custom-pen/` (`pen()`
used on its own, plus whatever `raw` callbacks draw what the data model still
has no word for), `react/` (a Vite app rendering `<PenSketch>` with a seed
control and a `useSketch` drawing, deliberately wrapped in
`<React.StrictMode>`), `state-machine/` (a state machine that branches on
a decision, with a dotted exception path routed back into the node it left,
and a self-transition stated in data), and `showcase/` (this project's own
logical architecture, drawn under the same theming as `vanilla/`). Each SHALL
carry its own diagram,
chosen to exercise what that folder exists to demonstrate rather than to
repeat a README snippet. Examples SHALL be runnable per design.md D7, excluded
from publishing, coverage, and size budgets, ASCII-only in fixture strings,
and screenshot-verified at implementation time and after any API change.

`showcase/` SHALL reach for the breadth of the data model in one diagram —
every drawn shape, `accent` and `hatch`, a straight connector, an orthogonal
one, a bowed one, a self-transition, both kinds of brace, and notes with
pointers — and SHALL do so **without `raw`**, so that what it draws is
expressible as data and can be served whole rather than served with a hole in
it. A feature that cannot be reached without `raw` SHALL be left to
`custom-pen/`, which exists for exactly that. The diagram SHALL state what its
own `hatch` and `dotted` mean, since the renderer attaches no meaning to
either and a picture using both without saying so teaches a convention that
does not exist.

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

#### Scenario: The showcase is served whole
- **WHEN** an agent reads `pensketch://example/showcase`
- **THEN** it receives the diagram as data with no `rawOmitted` note beside it, because there is no `raw` in it to omit
