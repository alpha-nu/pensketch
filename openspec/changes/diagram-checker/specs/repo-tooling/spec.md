# repo-tooling — Delta Specification

> The checker adds a second build entry, a second published subpath, a third
> size budget, and a CI step. Exact config: diagram-checker/design.md D5.

## MODIFIED Requirements

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

### Requirement: Size budgets are enforced
`tools/check-size.mjs` SHALL gzip the built ESM entry of each published entry
point and fail (non-zero exit, printing actual vs budget) when
`@pensketch/core` exceeds 5120 bytes, `@pensketch/core/check` exceeds 2560
bytes, or `@pensketch/react` exceeds 2048 bytes min+gzip. Each published
entry SHALL be a self-contained file: build-time code splitting SHALL be off,
because a shared chunk makes the root entry's budget measure a re-export
rather than the code it stands for.

#### Scenario: Budget breach
- **WHEN** a change pushes core's min+gzip ESM output over 5120 bytes
- **THEN** `npm run size` fails and CI goes red

#### Scenario: The checker has its own budget
- **WHEN** the checker's min+gzip output exceeds 2560 bytes
- **THEN** `npm run size` fails, and core's own budget is unaffected either way

#### Scenario: An entry point stands on its own
- **WHEN** a second entry is added to a package's build
- **THEN** each entry remains a self-contained file, so neither one's budget is measuring a re-export and neither drags in the other's code

### Requirement: CI validates the full chain including generated-file freshness
CI SHALL run on push and pull request to `main`, and on manual dispatch, as a
single job that installs once and runs, in order: `npm ci`, lint (Biome),
typecheck (`tsc --noEmit`), tests with coverage, build, an assertion that
every published entry point resolves and exposes its documented surface, the
size check, regeneration of every generated artefact — goldens and the
published schema — followed by an assertion that the whole working tree is
unchanged, and the checker over every diagram this repository ships. It SHALL
then repeat the
suite on the oldest Node the manifests admit, and finally typecheck and run
the bindings suite against the older React major the peer range allows. A
newer run on the same ref SHALL cancel the one in flight. Drift between
`reference/renderer.html`, the generator and the checked-in goldens SHALL
therefore be impossible to merge silently, and so SHALL drift between the
TypeScript types and the schema published beside them, and so SHALL a layout
defect in a shipped example.

#### Scenario: Stale goldens blocked
- **WHEN** a commit edits the golden generator so its output differs from the checked-in goldens
- **THEN** the generated-files step leaves the tree dirty and CI fails

#### Scenario: A schema that no longer describes the types
- **WHEN** a commit changes a diagram type without regenerating the schema
- **THEN** the same step fails, so no release ships a schema describing types it does not have

#### Scenario: A published entry stops resolving
- **WHEN** an exports map names a file the build does not produce, or an entry stops exporting a documented name
- **THEN** CI fails, even though nothing else in the repository loads `dist/`

#### Scenario: A commit can be re-verified without inventing another
- **WHEN** a run is lost to something outside the commit — an outage, a flake
- **THEN** CI can be dispatched by hand against that same commit

#### Scenario: A shipped diagram develops a layout defect
- **WHEN** a change makes two nodes overlap in an example diagram
- **THEN** the checker step fails CI with the finding
