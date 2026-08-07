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
changesets keeps internal ranges current). `@pensketch/core` SHALL also
publish the JSON Schema generated from its types, at the `./schema.json`
subpath, so that a caller validates against the version they installed rather
than a copy taken once and left to drift.

#### Scenario: Publishable as public
- **WHEN** `npm publish --dry-run` runs in either package after a build
- **THEN** the resolved access is public, and the tarball contains `dist`, `README.md`, license metadata, and — for core alone — the generated schema, and nothing else

#### Scenario: The schema is reachable by name
- **WHEN** `@pensketch/core/schema.json` is imported by an installed consumer
- **THEN** it resolves to the schema generated from the types that same version ships

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

### Requirement: CI validates the full chain including generated-file freshness
CI SHALL run on push and pull request to `main`, and on manual dispatch, as a
single job that installs once and runs, in order: `npm ci`, lint (Biome),
typecheck (`tsc --noEmit`), tests with coverage, build, the size check, and
regeneration of every generated artefact — goldens and the published schema —
followed by an assertion that the whole working tree is unchanged. It SHALL
then repeat the suite on the oldest Node the manifests admit, and finally
typecheck and run the bindings suite against the older React major the peer
range allows. A newer run on the same ref SHALL cancel the one in flight.
Drift between `reference/renderer.html`, the generator and the checked-in
goldens SHALL therefore be impossible to merge silently, and so SHALL drift
between the TypeScript types and the schema published beside them.

#### Scenario: Stale goldens blocked
- **WHEN** a commit edits the golden generator so its output differs from the checked-in goldens
- **THEN** the generated-files step leaves the tree dirty and CI fails

#### Scenario: A schema that no longer describes the types
- **WHEN** a commit changes a diagram type without regenerating the schema
- **THEN** the same step fails, so no release ships a schema describing types it does not have

#### Scenario: A commit can be re-verified without inventing another
- **WHEN** a run is lost to something outside the commit — an outage, a flake
- **THEN** CI can be dispatched by hand against that same commit

### Requirement: Releases are owner-triggered with a visual semver clause
Publishing SHALL happen only via a `workflow_dispatch` release workflow using
changesets with npm provenance, authenticated by trusted publishing: the
registry trusts this repository and this workflow file, and npm exchanges the
OIDC token minted by `id-token: write` for a short-lived credential. No
long-lived registry token SHALL be stored as a secret, since a secret that
exists can be exfiltrated and one that does not cannot. The workflow SHALL
assert the runner's npm can perform that exchange, because an npm too old to
try fails at the registry with a plain authentication error that reads like a
misconfigured secret. Version semantics
pre-1.0: **patch** guarantees byte-identical rendered output; **minor** may
change rendered output or add API, and its changeset SHALL say so and
describe what shifts; every user-visible change SHALL carry a changeset; the
implementing agent SHALL never publish, tag, or push. The release job SHALL
assert its own outcome and fail when a dispatch neither published nor opened a
version pull request: the changesets action is pinned by commit, renames every
input in its next major, and Actions only warns about an input a workflow
declares that the action does not — so a bad upgrade of that pin does nothing
and exits zero.

#### Scenario: A dispatch that released nothing goes red
- **WHEN** a dispatch neither publishes nor opens a version pull request
- **THEN** the job fails, so releasing nothing cannot pass for a quiet success

#### Scenario: Visual change is classified
- **WHEN** a commit alters any aesthetic constant or PRNG consumption order
- **THEN** it includes regenerated expectations, a before/after PNG pair, and a minor changeset describing the visual shift

#### Scenario: No unsolicited publishes
- **WHEN** all CI checks pass on `main`
- **THEN** nothing is published until the owner triggers the release workflow

#### Scenario: There is no registry credential to steal
- **WHEN** the repository's secrets are enumerated
- **THEN** none of them grants publish rights, because the release workflow authenticates by exchanging a per-run OIDC token instead
