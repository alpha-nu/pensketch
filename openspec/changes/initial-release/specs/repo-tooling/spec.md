# repo-tooling — Delta Specification

> Workspace, build, quality gates, CI, and release machinery. Exact config
> contents and layout: design.md D6.

## ADDED Requirements

### Requirement: Scoped packages in an npm-workspaces monorepo
The repository SHALL be an npm-workspaces monorepo with `@pensketch/core` in
`packages/core` and `@pensketch/react` in `packages/react`, both `"license":
"MIT"` and `"publishConfig": { "access": "public" }` (scoped packages default
to restricted). Zero runtime dependencies in core; the react package's
dependency shape is fixed by the react-bindings capability. The `workspace:*`
protocol SHALL NOT appear (npm resolves plain semver ranges locally;
changesets keeps internal ranges current).

#### Scenario: Publishable as public
- **WHEN** `npm publish --dry-run` runs in either package after a build
- **THEN** the resolved access is public and the tarball contains `dist`, `README.md`, and license metadata only

### Requirement: Dual-format builds with types
Each package SHALL build with tsup to ESM + CJS + `.d.ts` (minified,
sourcemapped, target es2020) with a conditional `exports` map resolving
`types`/`import`/`require`, `"sideEffects": false`, and
`"engines": { "node": ">=22" }`.

#### Scenario: Both module systems resolve
- **WHEN** the built package is consumed via `import` in ESM and `require` in CJS
- **THEN** both load and expose the same API with types available

### Requirement: Test and coverage gates
Tests SHALL run under vitest with a jsdom environment; coverage (v8) SHALL
enforce ≥90% lines and branches, with `examples/**`, `tools/**`, and
`**/dist/**` excluded. The thresholds SHALL be keyed per package so that each
one is held to the bar individually rather than in aggregate, and the source
files SHALL be included explicitly so that a file no test imports counts as
uncovered instead of vanishing from the report.

#### Scenario: Coverage regression fails
- **WHEN** a change drops line or branch coverage below 90%
- **THEN** `npm test` exits non-zero

### Requirement: Size budgets are enforced
`tools/check-size.mjs` SHALL gzip the built ESM entry of each package and
fail (non-zero exit, printing actual vs budget) when `@pensketch/core`
exceeds 5120 bytes or `@pensketch/react` exceeds 2048 bytes min+gzip.

#### Scenario: Budget breach
- **WHEN** a change pushes core's min+gzip ESM output over 5120 bytes
- **THEN** `npm run size` fails and CI goes red

### Requirement: CI validates the full chain including golden freshness
CI SHALL run on push/PR to `main` over Node 22 and 24 with, in order: `npm
ci`, lint (Biome), typecheck (`tsc --noEmit`), tests with coverage, build,
golden regeneration followed by an assertion that the working tree is
completely unchanged, and the size check. A drift between
`reference/renderer.html`, the
generator, and the checked-in goldens SHALL therefore be impossible to merge
silently.

#### Scenario: Stale goldens blocked
- **WHEN** a commit edits the golden generator so its output differs from the checked-in goldens
- **THEN** the goldens-freshness step fails CI

### Requirement: Releases are owner-triggered with a visual semver clause
Publishing SHALL happen only via a `workflow_dispatch` release workflow using
changesets with npm provenance and an `NPM_TOKEN` secret. Version semantics
pre-1.0: **patch** guarantees byte-identical rendered output; **minor** may
change rendered output or add API, and its changeset SHALL say so and
describe what shifts; every user-visible change SHALL carry a changeset; the
implementing agent SHALL never publish, tag, or push.

#### Scenario: Visual change is classified
- **WHEN** a commit alters any aesthetic constant or PRNG consumption order
- **THEN** it includes regenerated expectations, a before/after PNG pair, and a minor changeset describing the visual shift

#### Scenario: No unsolicited publishes
- **WHEN** all CI checks pass on `main`
- **THEN** nothing is published until the owner triggers the release workflow
