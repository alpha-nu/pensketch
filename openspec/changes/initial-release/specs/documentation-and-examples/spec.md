# documentation-and-examples — Delta Specification

> READMEs, CONTRIBUTING, the runnable `examples/` folder, and the README
> asset pipeline. Section-by-section content and the canonical snippets:
> design.md D7 + Appendix A.

## ADDED Requirements

### Requirement: README snippets have one source of truth
Every code snippet in any README SHALL be copied verbatim from design.md
Appendix A, and each example SHALL mirror its corresponding snippet with the
import line as the only permitted divergence (marked with a comment saying
why). When an API change invalidates a snippet, Appendix A SHALL be updated
in the same commit and propagated to every copy.

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
(seed story, two-sentence version policy, A5), examples table, an honest
pensketch-vs-rough.js paragraph, origin (only after the owner confirms the
source article is published), and license.

#### Scenario: A newcomer can go from install to themed diagram
- **WHEN** a reader follows the README top to bottom
- **THEN** every code block they encounter runs as-is against the released packages

### Requirement: Package READMEs stand alone on npm
Each package SHALL ship an npm-facing README per design.md D7 (core: A1 + Pen
table + variable table; react: A2 + props table + `useSketch`), embedding
`hero-light.png` via absolute raw.githubusercontent URL (npm does not
reliably honor `<picture>`), with the URL placeholder resolved before any
release.

#### Scenario: No dead placeholders at release
- **WHEN** a release is prepared
- **THEN** no `TODO(owner)` markers remain in either package README

### Requirement: CONTRIBUTING teaches the guardrails
`CONTRIBUTING.md` SHALL cover: setup, the six verification commands with one
line each on what they prove, the golden policy including
never-regenerate-to-green, patch-vs-minor selection under the visual clause,
and the ASCII/`\uXXXX` rule for fixture strings.

#### Scenario: A contributor learns the golden rule before touching goldens
- **WHEN** a contributor reads CONTRIBUTING
- **THEN** the golden policy and its rationale are stated explicitly

### Requirement: Three runnable examples mirror the documentation
`examples/` SHALL contain `vanilla/` (A1 + A4, importing the built core dist
relatively), `custom-pen/` (A3 plus one `draw()` with a `raw` callback), and
`react/` (Vite app rendering `<PenSketch>` with the BUDGETS fixture and a
`useSketch` custom drawing, deliberately wrapped in `<React.StrictMode>`).
Examples SHALL be runnable per design.md D7, excluded from publishing,
coverage, and size budgets, ASCII-only in fixture strings, and
screenshot-verified at implementation time and after any API change.

#### Scenario: Vanilla example runs from a fresh clone
- **WHEN** a user runs `npm ci && npm run build` at the root and opens `examples/vanilla/index.html`
- **THEN** the quickstart diagram renders, and flips theme under a dark color scheme

#### Scenario: React example exercises both APIs
- **WHEN** `npm install && npm run dev` runs inside `examples/react`
- **THEN** the page renders the BUDGETS diagram via `<PenSketch>` and the custom drawing via `useSketch`, under StrictMode

### Requirement: README hero images are generated, deterministic, and committed
`tools/render-assets.mjs` SHALL render the SAMPLER fixture at 2× to
`docs/assets/hero-light.png` (background `#FFFFFF`) and, under emulated
dark `prefers-color-scheme`, `hero-dark.png` (background `#161B21`), with
corner pixels verified against the background; the PNGs SHALL be committed
and reproducible from the same repo state.

#### Scenario: Regeneration is a no-op on an unchanged repo
- **WHEN** the asset script re-runs with no source changes
- **THEN** the committed PNGs are unchanged
