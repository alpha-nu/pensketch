# repo-tooling — Delta Specification

> State the regeneration rule rather than the inventory, and derive the
> documented install version instead of typing it.

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: The documented install version is derived, not typed
The version the READMEs instruct a reader to install SHALL be generated from
the version `@pensketch/mcp` carries, by a `tools/` generator, and SHALL be
regenerated as part of the release's own versioning command so that the
correction lands in the same pull request as the bump that invalidated it. The
generator SHALL fail rather than succeed silently when it finds no pin to
rewrite, and SHALL rewrite only an install pin — a version named in prose as
history SHALL be left alone.

Pinning SHALL remain: an unpinned `npx` invocation resolves to whatever is
latest at the moment a client starts, which makes the behaviour of a caller's
tools depend on when they happened to launch.

#### Scenario: A release cannot ship instructions for the release before it
- **WHEN** a version bump changes what `@pensketch/mcp` publishes as
- **THEN** the same pull request carries READMEs naming the new version, and CI's tree-clean assertion fails if it does not

#### Scenario: History is not rewritten into a lie
- **WHEN** a README states which release a defect shipped in
- **THEN** that version is left as written, because it is a fact about the past rather than an instruction

#### Scenario: A lost pin is loud
- **WHEN** no install pin is found in the files the generator maintains
- **THEN** it exits non-zero rather than reporting success over nothing
