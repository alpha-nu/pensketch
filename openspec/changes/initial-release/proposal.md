# Proposal: initial-release

> Bootstrap change for the pensketch repository — everything from empty folder
> to publishable `0.1.0` of both packages. The normative reference
> implementation lives at `reference/renderer.html` (read-only ground truth).

## Why

A production article ("The Responsible Harness") shipped with a hand-rolled,
~65-line pen-sketch SVG renderer: data-driven diagrams (nodes/edges/notes as
plain objects), seeded deterministic wobble, double-stroked ink aesthetic,
zero dependencies. That renderer is worth extracting as an open-source
product: nothing in the ecosystem combines diagram-level data input with
deterministic output (rough.js is shape primitives; Mermaid owns layout and
cannot be hand-placed). The owner intends a family of framework bindings, so
packages live under one npm scope.

## What Changes

- Scaffold an npm-workspaces monorepo (Biome, vitest+jsdom, tsup, changesets,
  GitHub Actions CI, MIT license).
- Port the reference renderer to TypeScript as `@pensketch/core` with **byte
  parity** against the reference (golden files generated from
  `reference/renderer.html` itself).
- Build `@pensketch/react` bindings (`<PenSketch>` component + `useSketch`
  hook), SSR- and StrictMode-safe.
- Ship documentation (root README with canonical snippets, npm-facing package
  READMEs, CONTRIBUTING, and a reference for callers that are programs) plus a
  runnable `examples/` folder, each folder carrying its own diagram rather
  than a copy of a README snippet.
- Establish the release machinery: changesets, owner-triggered publish with
  npm provenance, semver with an explicit visual clause.

## Capabilities

### New Capabilities

- `core-renderer`: the `@pensketch/core` public API, hand-sketch rendering
  behavior, determinism contract, reference byte-parity, theming, validation
- `react-bindings`: `@pensketch/react` component + hook, redraw semantics,
  SSR/StrictMode safety, dependency shape
- `repo-tooling`: workspace layout, build outputs, test/coverage gates, size
  budgets, CI pipeline, release + versioning policy
- `documentation-and-examples`: README structure with single-source snippets,
  package READMEs, CONTRIBUTING, `docs/agents.md` for machine callers, the
  `examples/` folder, README asset pipeline

### Modified Capabilities

<!-- none — new repository, no existing specs -->

## Impact

- **New repository**: everything under this folder; no external codebases
  touched.
- **npm**: two new public packages under the `@pensketch` scope
  (`@pensketch/core`, `@pensketch/react`).
- **Owner-reserved actions** (never the agent's): create the npm org
  `@pensketch` (this alone reserves the namespace; if a user named `pensketch`
  already exists, creation fails — stop and re-decide naming), create the
  GitHub repository, any `git push`, any `npm publish`, `NPM_TOKEN` setup,
  triggering the release workflow.
- **Depends on**: nothing. **Blocks**: any future binding change
  (`@pensketch/vue`, CLI, ...).
