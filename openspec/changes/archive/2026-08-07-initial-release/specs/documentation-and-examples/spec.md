# documentation-and-examples — Delta Specification

> READMEs, CONTRIBUTING, the runnable `examples/` folder, and the README
> asset pipeline. Section-by-section content and the canonical snippets:
> design.md D7 + Appendix A.

## ADDED Requirements

### Requirement: README snippets have one source of truth
Every code snippet in any README SHALL be copied verbatim from design.md
Appendix A. When an API change invalidates a snippet, Appendix A SHALL be
updated in the same commit and propagated to every copy. The examples SHALL
NOT be held to this rule: a quickstart earns its place by being the shortest
thing that draws and an example by being worth looking at, and tying the two
together holds every example down to what a README can afford to print.

#### Scenario: Snippet drift is a defect
- **WHEN** a README code block is diffed against its Appendix A source
- **THEN** they are byte-identical

### Requirement: Root README covers the full learning path in fixed order
The root README SHALL contain, in order: hero (name, tagline, theme-aware
`<picture>` over `docs/assets/hero-{light,dark}.png`), why-pensketch (four
one-line differentiators), install, vanilla quickstart (A1), React quickstart
(A2), the drawing model (prose + four field tables for
DiagramNode/Edge/Note/Diagram + anchor glossary), the pen (A3 + Pen method
table), theming (variable table + A4 + font paragraph), determinism & testing
(seed story, two-sentence version policy, A5), examples table, generating
diagrams programmatically (pointing at the machine-caller reference and the
schema), an honest pensketch-vs-rough.js comparison, and license.

#### Scenario: A newcomer can go from install to themed diagram
- **WHEN** a reader follows the README top to bottom
- **THEN** every code block they encounter runs as-is against the released packages

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
and the ASCII/`\uXXXX` rule for fixture strings.

#### Scenario: A contributor learns the golden rule before touching goldens
- **WHEN** a contributor reads CONTRIBUTING
- **THEN** the golden policy and its rationale are stated explicitly

### Requirement: Three runnable examples, each earning its folder
`examples/` SHALL contain `vanilla/` (a diagram drawn from data under the A4
theming, importing the built core dist relatively), `custom-pen/` (a diagram
whose `raw` callbacks draw what the data model has no word for, plus `pen()`
used on its own), and `react/` (a Vite app rendering `<PenSketch>` with a seed
control and a `useSketch` drawing, deliberately wrapped in
`<React.StrictMode>`). Each SHALL carry its own diagram, chosen to exercise
what that folder exists to demonstrate rather than to repeat a README snippet.
Examples SHALL be runnable per design.md D7, excluded from publishing,
coverage, and size budgets, ASCII-only in fixture strings, and
screenshot-verified at implementation time and after any API change.

#### Scenario: Vanilla example runs from a fresh clone
- **WHEN** a user runs `npm ci && npm run build` at the root, serves the repository over HTTP, and opens `examples/vanilla/index.html` (browsers refuse ES-module imports over `file://`)
- **THEN** the quickstart diagram renders, and flips theme under a dark color scheme

#### Scenario: React example exercises both APIs
- **WHEN** `npm install && npm run dev` runs inside `examples/react`
- **THEN** the page renders its diagram via `<PenSketch>`, redraws it when the seed control changes, and draws a caption via `useSketch`, all under StrictMode

### Requirement: A reference for callers who cannot see the result
The repository SHALL carry documentation addressed to a program generating
diagrams rather than to a person — `docs/agents.md` — covering the whole type
surface, the constants worth designing around, every error `draw` throws, and
the defects the type system cannot catch: nothing is laid out, text is never
measured, a label near a connector is drawn through, and draw order is part of
the rendered bytes. Every figure in it SHALL be measured from this repository
rather than estimated. It is product documentation for callers and SHALL say
so, distinct from `CONTRIBUTING.md`, which addresses work on the repository
itself.

#### Scenario: The traps are stated with numbers
- **WHEN** the reference gives a clearance, a text-width factor, or a proportion
- **THEN** it is a figure measured from this repository's own diagrams, and the worked example it ships validates against the published schema

### Requirement: README hero images are generated, deterministic, and committed
`tools/render-assets.mjs` SHALL render its own hero diagram at 2× to
`docs/assets/hero-light.png` (background `#FFFFFF`) and, under emulated
dark `prefers-color-scheme`, `hero-dark.png` (background `#161B21`), with
corner pixels verified against the background; the PNGs SHALL be committed
and reproducible from the same repo state.

#### Scenario: Regeneration is a no-op on an unchanged repo
- **WHEN** the asset script re-runs with no source changes
- **THEN** the committed PNGs are unchanged
