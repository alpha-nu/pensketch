# Proposal: diagram-checker

> A subpath export, `@pensketch/core/check`, that finds layout defects in a
> diagram and returns them as data. Zero dependencies, outside the main
> bundle, and callable without rendering anything.

## Why

pensketch deliberately performs no layout and never measures text. Every
consequence of that lands on the caller, and none of it is visible to the type
system or to `draw`, which renders a broken picture as happily as a good one:

- an edge label sitting on top of a connector — including its own
- two nodes overlapping
- a label wider than the box drawn around it
- geometry outside the `viewBox`, silently clipped
- a node escaping the group meant to contain it
- two nodes sharing an `id`, where the second silently wins

A human catches all of these by looking at the picture once. That is the
entire feedback loop today, and it does not survive contact with a caller that
cannot see — an agent generating a diagram, a script generating one from data,
or CI checking one it did not draw.

This is not hypothetical. Rebuilding this repository's three examples took
three render-and-inspect rounds against a real browser, and the OAuth diagram
went out with connectors drawn through three of its own labels before the
second round caught them. The lane gaps were 34 px; a 13.5 px label plus
clearance does not fit, and nothing said so. Every defect found in that
exercise is mechanically detectable from the diagram data alone.

## What Changes

- **New subpath** `@pensketch/core/check` exporting `check(diagram, options?)`
  returning `Finding[]`. Zero runtime dependencies, like the rest of core.
- **Seven rules**, each with a stable machine-readable id, a severity, a human
  message, and the coordinates involved so a caller can act without guessing.
- **Text width is estimated, never measured**, and findings that depend on the
  estimate say so. The factor is an option.
- **Packaging**: a second build entry, an `exports` map entry, and a size
  budget of its own. The main bundle and its 5120 B budget are untouched;
  nothing that does not import the subpath pays a byte.
- **First-party use**: the repository's own diagrams — three examples and the
  README hero — are checked in CI, so the rules are exercised by the project
  that ships them.

## Capabilities

### New Capabilities

- `diagram-checker`: the `check()` API, the rule set, finding shape, severity
  semantics, and the estimation contract

### Modified Capabilities

- `repo-tooling`: a second build entry and `exports` condition, a second size
  budget, and a CI step that checks the repository's own diagrams

## Impact

- **npm**: no new package. `@pensketch/core` gains a subpath; consumers who do
  not import it are unaffected, and `sideEffects: false` plus a separate entry
  keeps it out of their bundle.
- **Semver**: a **minor** on `@pensketch/core`. New API, no rendered output
  changes — `check` never draws and never mutates the diagram.
- **Depends on**: nothing. `anchor` is already exported, so edge geometry is
  computable without touching `draw`.
- **Blocks**: `mcp-server`, whose `check_diagram` tool is this function.

## Non-goals

Hard walls, not deferrals:

- **No layout.** The checker reports; it never moves anything. Auto-layout is
  a standing project non-goal and this change does not soften it.
- **No text measurement.** Measuring means a font, a canvas or a DOM, and a
  dependency. The estimate is documented as an estimate.
- **No rendering.** `check` takes the same data `draw` takes and returns
  before any element exists.
- **No opinions about taste.** Empty regions, colour choices and visual
  balance are not defects.
