# documentation-and-examples — Delta Specification

> A sixth folder, and the one thing a reader cannot learn from a still picture:
> that the drawing has an order.

## MODIFIED Requirements

> Restated from the live baseline in full, with all six scenarios carried word
> for word and one added. The edits are the new folder in the opening list and
> a paragraph describing what it exists to demonstrate. The `showcase/`
> paragraph, the alike-connectors rule, the breadth clause and the
> earns-its-folder clause are unchanged.

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

#### Scenario: The animation example is a caller, not a reimplementation
- **WHEN** `examples/animation` is read for how the drawing is set up
- **THEN** it calls `@pensketch/animation`, and stamps no `pathLength` and no index of its own

#### Scenario: Both surfaces are shown
- **WHEN** a reader looks for how to animate a diagram
- **THEN** they find it done from a page in `animation/` and through the bindings in `react/`, rather than inferring the second from the first

#### Scenario: The bindings are demonstrated where their failures are visible
- **WHEN** the animated `<PenSketch>` runs in `examples/react`
- **THEN** it does so under StrictMode and while the diagram is stepping on its timer, so a doubled stylesheet, a missing one, and a drawing that restarts on every render would all be seen rather than reasoned about

> **Root README covers the full learning path** gains one section, and loses a
> staleness it already carried. The animation section sits after the React
> quickstart and before the drawing model, which is where a reader meets it:
> it needs both quickstarts to make sense and none of the model below it.
>
> The architecture section is not this change's doing — it has been in the
> README since the showcase example landed and was never added here, so the
> enumeration has been false for one section already. A requirement that lists
> what a document contains goes false the moment the document grows, and
> `--strict` cannot see it, which is why both are corrected together rather
> than only the one this change is responsible for.

### Requirement: Root README covers the full learning path in fixed order
The root README SHALL contain, in order: hero (name, tagline, theme-aware
`<picture>` over `docs/assets/hero-{light,dark}.png`), why-pensketch (four
one-line differentiators), install, the architecture drawn by the thing it
describes, vanilla quickstart (A1), React quickstart
(A2), making a diagram draw itself, the drawing model (prose + four field
tables for
DiagramNode/Edge/Note/Diagram + anchor glossary), the pen (A3 + Pen method
table), theming (variable table + A4 + font paragraph), determinism & testing
(seed story, two-sentence version policy, A5), examples table, generating
diagrams programmatically (pointing at the machine-caller reference and the
schema), an honest pensketch-vs-rough.js comparison, and license.

#### Scenario: A newcomer can go from install to themed diagram
- **WHEN** a reader follows the README top to bottom
- **THEN** every code block they encounter runs as-is against the released packages

#### Scenario: A section is added without the list being told
- **WHEN** the README grows a section this enumeration does not name
- **THEN** the requirement is false and nothing fails, which is why the enumeration is corrected in the change that adds the section rather than the one that notices

> **README snippets have one source of truth** is edited in one place: what a
> snippet's source may be when Appendix A does not cover it. Appendix A was
> archived with `initial-release` and holds A1 through A5; it cannot grow, so a
> rule naming it as the only source makes every snippet about anything added
> since unsourceable. The rule's purpose was never the file — it was that a
> snippet has exactly one home and an API change updates that home rather than
> five copies. A published `@example` is that home, and a better one: it ships
> in the `.d.ts`, so a caller reads it in their editor whether or not they ever
> open a README.

### Requirement: README snippets have one source of truth
Every code snippet in any README SHALL be copied verbatim from a single named
source, and when an API change invalidates a snippet that source SHALL be
updated in the same commit and propagated to every copy. For the surfaces it
covers, that source SHALL be design.md Appendix A. For a surface Appendix A
does not cover — it was archived holding A1 through A5 and cannot grow — the
source SHALL be the `@example` in the JSDoc of the export the snippet
demonstrates, which the package publishes in its declarations. A snippet SHALL
NOT be composed fresh in a README. The examples SHALL
NOT be held to this rule: a quickstart earns its place by being the shortest
thing that draws and an example by being worth looking at, and tying the two
together holds every example down to what a README can afford to print.

#### Scenario: Snippet drift is a defect
- **WHEN** a README code block is diffed against its source
- **THEN** they are byte-identical

#### Scenario: A snippet for something Appendix A never described
- **WHEN** a README documents an export added after the appendix was archived
- **THEN** its snippet is the published `@example` for that export, copied rather than written, so the editor tooltip and the README cannot disagree
