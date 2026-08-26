# documentation-and-examples Specification

## Purpose
TBD - created by archiving change initial-release. Update Purpose after archive.
## Requirements
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

### Requirement: Package READMEs stand alone on npm
Each package SHALL ship an npm-facing README per design.md D7 (core: A1 + Pen
table + variable table; react: A2 + props table + `useSketch`), embedding
`hero-light.png` via absolute raw.githubusercontent URL (npm does not
reliably honor `<picture>`), written fully resolved against the repository
that already exists — no placeholder markers at any point.

#### Scenario: No dead placeholders at release
- **WHEN** a release is prepared
- **THEN** no `TODO(owner)` markers remain in either package README

### Requirement: CONTRIBUTING teaches the guardrails
`CONTRIBUTING.md` SHALL cover: setup, every verification command with one
line each on what they prove, the golden policy including
never-regenerate-to-green, patch-vs-minor selection under the visual clause,
the ASCII/`\uXXXX` rule for fixture strings, and how to work alongside the
release — that `main` has two writers, that local work diverges from
`origin/main` the moment a release lands, and that the repository is worked
with `pull.rebase` on so the answer is a rebase rather than a merge bubble or
a refusal.

It SHALL NOT state how many verification commands there are. That count has
changed twice, and a number in a heading is a fact nothing checks.

#### Scenario: A contributor learns the golden rule before touching goldens
- **WHEN** a contributor reads CONTRIBUTING
- **THEN** the golden policy and its rationale are stated explicitly

#### Scenario: A contributor is not surprised by a diverged main
- **WHEN** a release lands while a contributor holds unpushed commits
- **THEN** CONTRIBUTING has already told them why, and which git configuration makes the reconciliation a rebase

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

Depth takes the second arm. Extrusion was drawn on the hero first and stood
there through three rounds of polish; the owner then read the picture against
it and judged it better flat. The treatment is carried by `vanilla/` and on
show in the showcase instead, so the hero's flatness is that recorded
judgement - a decision, not an oversight.

#### Scenario: Regeneration is a no-op on an unchanged repo
- **WHEN** the asset script re-runs with no source changes
- **THEN** the committed PNGs are unchanged

#### Scenario: The hero draws what the package can draw
- **WHEN** a release adds a connector shape, an annotation shape, or a node treatment to the data model
- **THEN** the hero draws it, or the change records why the picture is better without it

### Requirement: A served example says what its data cannot carry
A served example whose source draws with `raw` SHALL carry a plain-language
statement naming the stroke the caller will not receive and why it could not
travel. `raw` holds functions, so a diagram that draws with one cannot be
serialized whole, and the served copy is the picture minus that stroke. The
generator SHALL fail rather than serve a diagram that draws with `raw` and
carries no such statement.

#### Scenario: The omission is disclosed rather than silent
- **WHEN** an agent reads a served example whose source draws with `raw`
- **THEN** the entry names what was removed, so a caller reproducing the data knows which stroke is missing rather than discovering a gap

#### Scenario: A new `raw` cannot ship undisclosed
- **WHEN** a shipped diagram gains a `raw` callback and no statement is written for it
- **THEN** `npm run resources` exits non-zero and CI fails on the regeneration gate

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

Extrusion SHALL be carried and taught by `vanilla/`, and the choice is the
picture's rather than the count's: a pipeline's stages are groups, which the
renderer never extrudes because a group bounds a set rather than being an
object, while its jobs are boxes and its gate is a decision that opts out.
The hybrid therefore says something true about the drawing instead of
demonstrating a field. The showcase draws the whole register raised, by owner
decision of 2026-08-26, the diagram-wide `extrude` stated once in its
options: the breadth diagram shows the treatment across every shape at once,
and the groups' refusal to extrude does the work of keeping the bands reading
as regions behind the objects they hold. What the earlier ruling guarded
against still holds: a picture reaching for every shape at once remains the
worst place to introduce a register per node, and it is `vanilla/` that
introduces it. The showcase applies the register with one switch, and asks
the reader to have met the field elsewhere.

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

