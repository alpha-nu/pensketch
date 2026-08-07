# documentation-and-examples — Delta Specification

> A fourth example folder, and a disclosure rule for what `raw` costs a caller
> reading the served copy.

## MODIFIED Requirements

### Requirement: Three runnable examples, each earning its folder
`examples/` SHALL contain `vanilla/` (a diagram drawn from data under the A4
theming, importing the built core dist relatively), `custom-pen/` (a diagram
whose `raw` callbacks draw what the data model has no word for, plus `pen()`
used on its own), `react/` (a Vite app rendering `<PenSketch>` with a seed
control and a `useSketch` drawing, deliberately wrapped in
`<React.StrictMode>`), and `state-machine/` (a state machine that branches on
a decision, with a dotted exception path routed back into the node it left,
and a self-transition drawn through `raw`). Each SHALL carry its own diagram,
chosen to exercise what that folder exists to demonstrate rather than to
repeat a README snippet. Examples SHALL be runnable per design.md D7, excluded
from publishing, coverage, and size budgets, ASCII-only in fixture strings,
and screenshot-verified at implementation time and after any API change.

Every shipped diagram SHALL be loadable as data by `tools/shipped-diagrams.mjs`
and SHALL pass `check` in CI, so that an example cannot teach a defect the
project publishes a rule against.

#### Scenario: Vanilla example runs from a fresh clone
- **WHEN** a user runs `npm ci && npm run build` at the root, serves the repository over HTTP, and opens `examples/vanilla/index.html` (browsers refuse ES-module imports over `file://`)
- **THEN** the quickstart diagram renders, and flips theme under a dark color scheme

#### Scenario: React example exercises both APIs
- **WHEN** `npm install && npm run dev` runs inside `examples/react`
- **THEN** the page renders its diagram via `<PenSketch>`, redraws it when the seed control changes, and draws a caption via `useSketch`, all under StrictMode

#### Scenario: A new example folder reaches every gate that governs the others
- **WHEN** an example folder is added
- **THEN** its diagram is checked by `npm run diagrams`, and adding it without wiring it into `tools/shipped-diagrams.mjs` leaves it unchecked, which the folder count in this requirement exists to catch

## ADDED Requirements

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
