# repo-tooling Specification

## Purpose
TBD - created by archiving change initial-release. Update Purpose after archive.
## Requirements
### Requirement: Scoped packages in an npm-workspaces monorepo
The repository SHALL be an npm-workspaces monorepo with `@pensketch/core` in
`packages/core`, `@pensketch/react` in `packages/react`,
`@pensketch/animation` in `packages/animation`, and `@pensketch/mcp`
in `packages/mcp`, all `"license": "MIT"` and `"publishConfig": { "access":
"public" }` (scoped packages default to restricted). **Zero runtime
dependencies in the rendering packages** — `@pensketch/core`,
`@pensketch/react` and `@pensketch/animation` — which is what keeps them out of
a consumer's lockfile; the react package's dependency shape is fixed by the
react-bindings capability, and the animation package's by the animation
capability. `@pensketch/mcp` MAY carry runtime dependencies, because it is a
tool an agent runs rather than code that ships inside a page, and it SHALL NOT
be a dependency of any rendering package. The `workspace:*` protocol SHALL
NOT appear (npm resolves plain semver ranges locally; changesets keeps
internal ranges current). Every internal range SHALL exclude the next major of
what it names, and any range a release rewrites SHALL be a caret or tilde
range: changesets replaces a range with its leading operator plus the new
version, reading that operator from the first two characters, so a compound
range is flattened — `>=0.0.1 <1.0.0` comes back as `>=0.1.0` and the upper
bound is gone. A peer range that a release leaves alone MAY stay compound.
`@pensketch/core` SHALL also publish the JSON Schema
generated from its types, at the `./schema.json` subpath, so that a caller
validates against the version they installed rather than a copy taken once and
left to drift.

#### Scenario: Publishable as public
- **WHEN** `npm publish --dry-run` runs in any package after a build
- **THEN** the resolved access is public, and the tarball contains `dist`, `README.md`, license metadata, and — for core alone — the generated schema, and nothing else

#### Scenario: The schema is reachable by name
- **WHEN** `@pensketch/core/schema.json` is imported by an installed consumer
- **THEN** it resolves to the schema generated from the types that same version ships

#### Scenario: The rendering packages stay dependency-free
- **WHEN** `@pensketch/core`, `@pensketch/react` or `@pensketch/animation` gains a runtime dependency
- **THEN** the manifest test fails, regardless of what `@pensketch/mcp` depends on

#### Scenario: A release cannot widen an internal range
- **WHEN** the version bump rewrites the range `@pensketch/mcp` declares on `@pensketch/core`, or the peer range `@pensketch/react` declares on it
- **THEN** the rewritten range still excludes the next core major, and the manifest test fails if it does not

#### Scenario: The server never leaks into the browser packages
- **WHEN** `@pensketch/mcp` appears in the dependencies of any rendering package
- **THEN** the manifest test fails

### Requirement: Dual-format builds with types
Each package SHALL build with tsup to ESM + CJS + `.d.ts` (minified,
sourcemapped, target es2020) with a conditional `exports` map resolving
`types`/`import`/`require`, `"sideEffects": false`, and
`"engines": { "node": ">=22" }`. `@pensketch/core` SHALL additionally publish
a `./check` subpath built from its own entry, resolving the same three
conditions, so that the checker is reachable by name and absent from any
bundle that does not import it.

#### Scenario: Both module systems resolve
- **WHEN** the built package is consumed via `import` in ESM and `require` in CJS
- **THEN** both load and expose the same API with types available

#### Scenario: The subpath resolves in both module systems
- **WHEN** `@pensketch/core/check` is imported in ESM and required in CJS
- **THEN** both resolve to a built entry with its own type declarations

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
`tools/check-size.mjs` SHALL gzip the built ESM entry of each published entry
point and fail (non-zero exit, printing actual vs budget) when
`@pensketch/core` exceeds 5440 bytes, `@pensketch/core/check` exceeds 3968
bytes, `@pensketch/core/server` exceeds 5440 bytes, `@pensketch/react` exceeds
2048 bytes, or `@pensketch/animation` exceeds 768 bytes min+gzip. Each
published entry SHALL be a self-contained
file: build-time code splitting SHALL be off, because a shared chunk makes an
entry's budget measure a re-export rather than the code it stands for. It
SHALL also fail when the size printed in the README's comparison table is not
the size the build produces, since a figure a reader is invited to compare
against another project is a derived number, and every other derived number in
this repository is held to its source by a gate rather than by memory.
`@pensketch/mcp` SHALL NOT carry a byte budget —
it is spawned, never bundled into a page — but its packed tarball size SHALL
be reported at build time, because a WebAssembly rasterizer and an embedded
font dominate it and a user fetching it through `npx` waits for every byte.

The splitting rule above follows the budgets and SHALL therefore apply to the
budgeted entries only. `@pensketch/mcp` has no budget for a chunk to hide a
re-export from, and the rule cost it real bytes: with four entries each
inlining its own copy of the SDK the tarball packed at 566 KB, and as shared
chunks at **162 KB** — less than the 270 KB it packed with two entries, since
the duplication predated the fourth. Those are measurements taken on
2026-09-07 and no gate holds them, this package carrying no byte budget by the
rule above, so a figure quoted from them SHALL carry that date. Where an entry carries no budget, a
shared chunk measures nothing wrongly and the download is what it saves.

A budget SHALL be raised deliberately and in advance of the work that needs
the room, in one step, with the measured need recorded where the number is
declared. It SHALL NOT be raised at a failing gate to make that gate pass: a
budget corrected after the fact records only that something grew, where one
corrected before records what was decided and on what evidence.

A budget sized from a prototype is a claim, and a claim the finished work
falsifies SHALL be re-decided deliberately rather than left standing because
it happened to hold. Such a re-decision SHALL be taken while the gate is
still green, in its own commit, with the new arithmetic beside the number
and the reason the first was wrong — it is a correction of a decision, not a
raise for work, and the "in one step" rule above governs the raise, not the
correction. Where a change knows in advance that its own estimate may not
survive contact, it SHALL say so where the estimate is recorded, so that the
correction is a plan being followed rather than a surprise being absorbed.

#### Scenario: Budget breach
- **WHEN** a change pushes core's min+gzip ESM output over 5120 bytes
- **THEN** `npm run size` fails and CI goes red

#### Scenario: Each subpath is held separately
- **WHEN** either subpath exceeds its own budget
- **THEN** `npm run size` fails, and the root entry's budget is unaffected either way

#### Scenario: A published comparison cannot go stale
- **WHEN** an entry grows and the README still prints the size it had before
- **THEN** `npm run size` fails, naming both numbers, rather than leaving the repository's front page to be corrected at release time

#### Scenario: A budget moves before the code does
- **WHEN** a change knows from a prototype that a feature will not fit an entry's budget
- **THEN** the budget is raised in its own commit, before the feature is written, carrying the measurement that justifies the new number

#### Scenario: The server's download weight is visible
- **WHEN** `@pensketch/mcp` is packed
- **THEN** its tarball size is reported, so the wait an `npx` user pays for is a known number rather than an accident

#### Scenario: A package with no budget may share chunks
- **WHEN** `@pensketch/mcp` is built with more than one entry
- **THEN** code splitting is allowed there, because no entry of it is measured against a budget, and the packed size the gate reports falls rather than rises

#### Scenario: A drawing feature is caught in the entry that carries it
- **WHEN** a feature is added to `draw` and only the root entry is measured
- **THEN** `@pensketch/core/server` is measured too and fails on its own account, because it bundles its own copy of the renderer and pays for the feature whether or not anyone imports it

### Requirement: CI validates the full chain including generated-file freshness
CI SHALL run on push and pull request to `main`, and on manual dispatch, as a
single job that installs once and runs, in order: `npm ci`, lint (Biome),
typecheck (`tsc --noEmit`), tests with coverage, build, an assertion that
every published entry point resolves and exposes its documented surface, the
size check, regeneration of **every** generated artefact — each artefact a
`tools/` generator produces, without exception — followed by an assertion that
the whole working tree is unchanged, and the checker over every diagram this
repository ships. It SHALL then repeat the suite on the oldest Node the
manifests admit, and finally typecheck and run the bindings suite against the
older React major the peer range allows. A newer run on the same ref SHALL
cancel the one in flight.

The regeneration step SHALL be described by that rule and SHALL NOT be
specified as a list of artefact names. A list is a fact with a short life: one
was written when there were two generators, and it still named two after a
third and a fourth had been added. Adding a generator without adding it to
this step SHALL be understood as leaving that artefact ungated.

Drift between `reference/renderer.html`, the generator and the checked-in
goldens SHALL therefore be impossible to merge silently, and so SHALL drift
between the TypeScript types and the schema published beside them, between a
served resource and the file it mirrors, between the documented install
version and the version the package carries, and so SHALL a layout defect in a
shipped example.

#### Scenario: Stale goldens blocked
- **WHEN** a commit edits the golden generator so its output differs from the checked-in goldens
- **THEN** the generated-files step leaves the tree dirty and CI fails

#### Scenario: A schema that no longer describes the types
- **WHEN** a commit changes a diagram type without regenerating the schema
- **THEN** the same step fails, so no release ships a schema describing types it does not have

#### Scenario: A new generator joins the gate
- **WHEN** a generator is added under `tools/`
- **THEN** it is run by the regeneration step, because the requirement covers every generator rather than the ones that existed when it was written

### Requirement: Releases are owner-triggered with a visual semver clause
Publishing SHALL happen only via `workflow_dispatch`, and versioning and
publishing SHALL be separate workflow files. One dispatch SHALL do one of them,
chosen by the operator rather than by the repository's state: opening the
version pull request and publishing to a registry differ in whether they can be
undone, and a control that does either depending on what it finds cannot be
read before it is used.

Each workflow SHALL assert its own precondition and refuse the other's job,
naming it: the versioning workflow requires at least one pending changeset, the
publishing workflow requires none. Only the publishing workflow SHALL hold
`id-token: write`, so the job that bumps version numbers cannot mint a
credential that publishes.

Publishing SHALL use changesets with npm provenance, authenticated by trusted
publishing: the registry trusts this repository and the publishing workflow
file, and npm exchanges the OIDC token minted by `id-token: write` for a
short-lived credential. No long-lived registry token SHALL be stored as a
secret, since a secret that exists can be exfiltrated and one that does not
cannot. The workflow SHALL assert the runner's npm can perform that exchange,
because an npm too old to try fails at the registry with a plain authentication
error that reads like a misconfigured secret. It SHALL push the git tags
`changeset publish` creates, which is not done for it once the changesets
action is no longer what invokes the publish.

The publishing workflow SHALL NOT re-run a subset of CI's gates. It SHALL
instead require that CI concluded successfully on the exact commit being
published, and SHALL run only what assembles the artefact and what CI cannot
establish about the runner. A release path that repeats some of CI's checks and
omits others is a weaker gate wearing the appearance of a stronger one, and the
list of which to repeat is a list, which goes stale.

Version semantics
pre-1.0: **patch** guarantees byte-identical rendered output; **minor** may
change rendered output or add API, and its changeset SHALL say so and describe
what shifts; every user-visible change SHALL carry a changeset; the
implementing agent SHALL never publish, tag, or push.

Compatibility is a second axis, and the clause above governs only the first. A
change that removes or renames a published name, narrows a type, or refuses
input it previously accepted SHALL be a **minor**, whatever it does to rendered
bytes. A caret range on a 0.x version stops at the minor — `^0.3.0` is
`>=0.3.0 <0.4.0` — so a patch reaches a consumer on their next install without
being chosen and a minor does not: pre-1.0 the minor slot is the compatibility
boundary, and the patch slot SHALL NOT carry a break. This SHALL be stated
rather than left to convention because nothing gates it. A byte-moving change
misfiled as a patch is at least partly caught by the goldens and the parity
tests; an API break misfiled as a patch is caught by nothing, the test pinning
the public surface to an exact list being edited by the same commit that
changes that surface. The versioning workflow
SHALL assert its own outcome and fail when a dispatch opens no version pull
request: the changesets action is pinned by commit, renames every input in its
next major, and Actions only warns about an input a workflow declares that the
action does not — so a bad upgrade of that pin does nothing and exits zero. For
`@pensketch/mcp`, which renders nothing of its own, the byte-identity clause
SHALL be read as applying to everything a tool returns, not to the markup
alone: `render_diagram` returns findings beside its SVG, and a release that
changed what those findings say while leaving the markup identical would be a
visible change misfiled as a patch.

#### Scenario: A dispatch cannot be ambiguous about what it is for
- **WHEN** the publishing workflow is dispatched while a changeset is still pending
- **THEN** it fails before anything is published, naming the versioning workflow as the one to run, rather than quietly opening a version pull request instead

#### Scenario: A version dispatch that opened nothing goes red
- **WHEN** a versioning dispatch opens no version pull request
- **THEN** the job fails, so versioning nothing cannot pass for a quiet success

#### Scenario: A publish dispatch with nothing to publish is a rehearsal, not a failure
- **WHEN** the publishing workflow is dispatched with no changeset pending and nothing unpublished
- **THEN** it runs its guard, its CI-conclusion assertion, the install, the build and the tag push, and succeeds — so the release path can be exercised end to end without a release, every step but the npm upload and the OIDC exchange
- **AND** this deliberately inverts the single workflow's rule that a dispatch releasing nothing goes red: that rule existed because one dispatch could not say which of two jobs it meant to do, which is the ambiguity the split removes

#### Scenario: Publishing a commit CI has not passed is refused
- **WHEN** a publish is dispatched for a commit whose CI run failed or has not finished
- **THEN** the job fails before publishing, rather than proceeding on the strength of the checks it happens to repeat

#### Scenario: A break that renders identically is still not a patch
- **WHEN** a change removes a published name, narrows a type, or refuses input it previously accepted, while every diagram that still renders renders byte-identically
- **THEN** it is released as a minor, because a caret range would deliver a patch to consumers without their choosing it

#### Scenario: Visual change is classified
- **WHEN** a commit alters any aesthetic constant or PRNG consumption order
- **THEN** it includes regenerated expectations, a before/after PNG pair, and a minor changeset describing the visual shift

#### Scenario: No unsolicited publishes
- **WHEN** all CI checks pass on `main`
- **THEN** nothing is published until the owner triggers the publishing workflow

#### Scenario: The server's patch promise is about its output
- **WHEN** a patch release of `@pensketch/mcp` changes the SVG `render_diagram` returns
- **THEN** the release is misclassified and the change requires a minor instead

### Requirement: The documented install version is derived, not typed
Every version this repository states to someone installing the server SHALL be
generated from the version `@pensketch/mcp` carries, by a `tools/` generator,
and SHALL be regenerated as part of the release's own versioning command so
that the correction lands in the same pull request as the bump that
invalidated it. That covers the pin in the READMEs and the two versions in the
registry manifest `mcp-publisher` sends — the server entry and the npm package
it points at — because a registry listing a release nobody can install fails
the same way a README does. The generator SHALL fail rather than succeed
silently when it finds no pin to rewrite, and SHALL rewrite only an install
pin — a version named in prose as history SHALL be left alone.

The registry manifest's server name and the `mcpName` in the published
manifest SHALL be asserted equal by that generator. The registry matches the
two to verify ownership, so a publish with them apart is refused there, with
nothing in this repository to explain why.

Pinning SHALL remain: an unpinned `npx` invocation resolves to whatever is
latest at the moment a client starts, which makes the behaviour of a caller's
tools depend on when they happened to launch.

#### Scenario: The registry is not told a version that was never published
- **WHEN** `@pensketch/mcp` is versioned
- **THEN** the registry manifest carries the new version in both places it states one, because the same generator writes them

#### Scenario: An ownership claim that would be refused
- **WHEN** the registry manifest's server name and the package's `mcpName` differ
- **THEN** the generator fails naming both, rather than leaving the refusal to happen at the registry

#### Scenario: A release cannot ship instructions for the release before it
- **WHEN** a version bump changes what `@pensketch/mcp` publishes as
- **THEN** the same pull request carries READMEs naming the new version, and CI's tree-clean assertion fails if it does not

#### Scenario: History is not rewritten into a lie
- **WHEN** a README states which release a defect shipped in
- **THEN** that version is left as written, because it is a fact about the past rather than an instruction

#### Scenario: A lost pin is loud
- **WHEN** no install pin is found in the files the generator maintains
- **THEN** it exits non-zero rather than reporting success over nothing

### Requirement: The showcase page is generated and gated
A generator SHALL produce the published page from `shippedDiagrams()`, and a
CI check SHALL hold the committed page to a fresh generation, on the same
terms as the generated resources and schema.

Wherever the visual system is shared between the page and anything else, it
SHALL have one source. A palette copied into a second file is the drift this
repository's generators exist to prevent.

A generated page SHALL NOT carry hand-written statements of fact about what it
shows. Counts, shapes and features SHALL be computed from the same data the
figures are drawn from; prose SHALL be confined to what cannot be derived. The
tree-clean assertion proves a page was regenerated and says nothing about
whether its sentences are still true - and a regenerated page carrying a
falsified sentence passes it.

#### Scenario: One palette, one source
- **WHEN** a colour or type stack is changed
- **THEN** every consumer of it changes, because none of them holds its own copy

#### Scenario: A stale page is a failure
- **WHEN** the committed page differs from a fresh generation
- **THEN** CI fails, rather than publishing a page that describes an older repository

#### Scenario: A published page is deployed only from a tree that passed
- **WHEN** a commit fails CI, including on the tree-clean assertion above
- **THEN** nothing is deployed, because the deploy runs on CI's success rather than beside it on the same push

