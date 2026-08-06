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
`@pensketch/core` exceeds 5120 bytes, `@pensketch/core/check` exceeds 1536
bytes, or `@pensketch/react` exceeds 2048 bytes min+gzip.

#### Scenario: Budget breach
- **WHEN** a change pushes core's min+gzip ESM output over 5120 bytes
- **THEN** `npm run size` fails and CI goes red

#### Scenario: The checker has its own budget
- **WHEN** the checker's min+gzip output exceeds 1536 bytes
- **THEN** `npm run size` fails, and core's own budget is unaffected either way

### Requirement: CI validates the full chain including golden freshness
CI SHALL run on push/PR to `main` over Node 22 and 24 with, in order: `npm
ci`, lint (Biome), typecheck (`tsc --noEmit`), tests with coverage, build,
golden regeneration followed by an assertion that the working tree is
completely unchanged, the size check, and the checker over every diagram this
repository ships. A drift between `reference/renderer.html`, the generator,
and the checked-in goldens SHALL therefore be impossible to merge silently,
and so SHALL a layout defect in a shipped example.

#### Scenario: Stale goldens blocked
- **WHEN** a commit edits the golden generator so its output differs from the checked-in goldens
- **THEN** the goldens-freshness step fails CI

#### Scenario: A shipped diagram develops a layout defect
- **WHEN** a change makes two nodes overlap in an example diagram
- **THEN** the checker step fails CI with the finding
