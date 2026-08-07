# repo-tooling — Delta Specification

> A third workspace package, whose dependency posture differs from the other
> two on purpose. Exact config: mcp-server/design.md.

## MODIFIED Requirements

### Requirement: Scoped packages in an npm-workspaces monorepo
The repository SHALL be an npm-workspaces monorepo with `@pensketch/core` in
`packages/core`, `@pensketch/react` in `packages/react`, and `@pensketch/mcp`
in `packages/mcp`, all `"license": "MIT"` and `"publishConfig": { "access":
"public" }` (scoped packages default to restricted). **Zero runtime
dependencies in the rendering packages** — `@pensketch/core` and
`@pensketch/react` — which is what keeps them out of a consumer's lockfile;
the react package's dependency shape is fixed by the react-bindings
capability. `@pensketch/mcp` MAY carry runtime dependencies, because it is a
tool an agent runs rather than code that ships inside a page, and it SHALL NOT
be a dependency of either rendering package. The `workspace:*` protocol SHALL
NOT appear (npm resolves plain semver ranges locally; changesets keeps
internal ranges current). `@pensketch/core` SHALL also publish the JSON Schema
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
- **WHEN** `@pensketch/core` or `@pensketch/react` gains a runtime dependency
- **THEN** the manifest test fails, regardless of what `@pensketch/mcp` depends on

#### Scenario: The server never leaks into the browser packages
- **WHEN** `@pensketch/mcp` appears in the dependencies of either rendering package
- **THEN** the manifest test fails

### Requirement: Size budgets are enforced
`tools/check-size.mjs` SHALL gzip the built ESM entry of each published entry
point and fail (non-zero exit, printing actual vs budget) when
`@pensketch/core` exceeds 5120 bytes, `@pensketch/core/check` exceeds 1536
bytes, `@pensketch/core/server` exceeds 1536 bytes, or `@pensketch/react`
exceeds 2048 bytes min+gzip. `@pensketch/mcp` SHALL NOT carry a byte budget —
it is spawned, never bundled into a page — but its packed tarball size SHALL
be reported at build time, because a WebAssembly rasterizer and an embedded
font dominate it and a user fetching it through `npx` waits for every byte.

#### Scenario: Budget breach
- **WHEN** a change pushes core's min+gzip ESM output over 5120 bytes
- **THEN** `npm run size` fails and CI goes red

#### Scenario: Each subpath is held separately
- **WHEN** either subpath exceeds its own budget
- **THEN** `npm run size` fails, and the root entry's budget is unaffected either way

#### Scenario: The server's download weight is visible
- **WHEN** `@pensketch/mcp` is packed
- **THEN** its tarball size is reported, so the wait an `npx` user pays for is a known number rather than an accident

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
change rendered output or add API, and its changeset SHALL say so and describe
what shifts; every user-visible change SHALL carry a changeset; the
implementing agent SHALL never publish, tag, or push. The release job SHALL
assert its own outcome and fail when a dispatch neither published nor opened a
version pull request: the changesets action is pinned by commit, renames every
input in its next major, and Actions only warns about an input a workflow
declares that the action does not — so a bad upgrade of that pin does nothing
and exits zero. For `@pensketch/mcp`, which renders nothing of its own, the
byte-identity clause SHALL be read as applying to the SVG its `render_diagram`
tool returns.

#### Scenario: A dispatch that released nothing goes red
- **WHEN** a dispatch neither publishes nor opens a version pull request
- **THEN** the job fails, so releasing nothing cannot pass for a quiet success

#### Scenario: Visual change is classified
- **WHEN** a commit alters any aesthetic constant or PRNG consumption order
- **THEN** it includes regenerated expectations, a before/after PNG pair, and a minor changeset describing the visual shift

#### Scenario: No unsolicited publishes
- **WHEN** all CI checks pass on `main`
- **THEN** nothing is published until the owner triggers the release workflow

#### Scenario: The server's patch promise is about its output
- **WHEN** a patch release of `@pensketch/mcp` changes the SVG `render_diagram` returns
- **THEN** the release is misclassified and the change requires a minor instead
