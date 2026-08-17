# repo-tooling — Delta Specification

> A fourth rendering package, and one budget that moves. `./server` bundles its
> own copy of `draw`, so a drawing feature lands there whether or not anyone
> imports it — which is exactly what its separate budget exists to catch.

## MODIFIED Requirements

> Both requirements are restated from the live baseline in full, with every
> scenario carried word for word and none dropped.

> **Scoped packages** is edited in two places only: `@pensketch/animation` joins
> the package list, and joins the pair held to zero runtime dependencies. Every
> other clause — the `workspace:*` prohibition, the internal-range rule and its
> reasoning about how changesets flattens a compound range, the mcp carve-out,
> and the schema subpath — is unchanged.

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

> **Size budgets** is edited in one sentence: `@pensketch/core/server` goes from
> 4300 to 4480, and `@pensketch/animation` is added at 768. The
> self-contained-entry rule, the README comparison gate, the `@pensketch/mcp`
> exemption and the paragraph requiring a budget to move before the code are
> unchanged — that last one being the clause this change obeys by moving both
> numbers in group 1, before any of the work that needs them.
>
> 4480 is the prototype's measured 4374 plus the conventional 100 B of gzip
> headroom, taken up to the next multiple of 64; built, the entry measures 4378.
>
> The animation budget was first set at 704 by the same arithmetic on a 546 B
> prototype, and is **re-decided to 768 here** because the finished package
> measures 614. Nothing failed — 614 fits 704. What failed was the arithmetic:
> it left 90 B where this repository's standard is 100, and a margin smaller
> than the 2 B of gzip noise an entry has already been measured moving on
> identical code is not a margin. 614 plus 100 is 714, taken up to 768. A budget
> sized from a prototype is a claim, and a claim that the finished thing
> falsifies SHALL be re-decided deliberately rather than left standing because
> it happened to hold.

### Requirement: Size budgets are enforced
`tools/check-size.mjs` SHALL gzip the built ESM entry of each published entry
point and fail (non-zero exit, printing actual vs budget) when
`@pensketch/core` exceeds 5120 bytes, `@pensketch/core/check` exceeds 3520
bytes, `@pensketch/core/server` exceeds 4480 bytes, `@pensketch/react` exceeds
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

A budget SHALL be raised deliberately and in advance of the work that needs
the room, in one step, with the measured need recorded where the number is
declared. It SHALL NOT be raised at a failing gate to make that gate pass: a
budget corrected after the fact records only that something grew, where one
corrected before records what was decided and on what evidence.

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

#### Scenario: A drawing feature is caught in the entry that carries it
- **WHEN** a feature is added to `draw` and only the root entry is measured
- **THEN** `@pensketch/core/server` is measured too and fails on its own account, because it bundles its own copy of the renderer and pays for the feature whether or not anyone imports it
