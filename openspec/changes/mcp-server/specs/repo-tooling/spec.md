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
internal ranges current).

#### Scenario: Publishable as public
- **WHEN** `npm publish --dry-run` runs in any package after a build
- **THEN** the resolved access is public and the tarball contains `dist`, `README.md`, and license metadata only

#### Scenario: The rendering packages stay dependency-free
- **WHEN** `@pensketch/core` or `@pensketch/react` gains a runtime dependency
- **THEN** the manifest test fails, regardless of what `@pensketch/mcp` depends on

#### Scenario: The server never leaks into the browser packages
- **WHEN** `@pensketch/mcp` appears in the dependencies of either rendering package
- **THEN** the manifest test fails

### Requirement: Releases are owner-triggered with a visual semver clause
Publishing SHALL happen only via a `workflow_dispatch` release workflow using
changesets with npm provenance and an `NPM_TOKEN` secret. Version semantics
pre-1.0: **patch** guarantees byte-identical rendered output; **minor** may
change rendered output or add API, and its changeset SHALL say so and describe
what shifts; every user-visible change SHALL carry a changeset; the
implementing agent SHALL never publish, tag, or push. For `@pensketch/mcp`,
which renders nothing of its own, the byte-identity clause SHALL be read as
applying to the SVG its `render_diagram` tool returns.

#### Scenario: Visual change is classified
- **WHEN** a commit alters any aesthetic constant or PRNG consumption order
- **THEN** it includes regenerated expectations, a before/after PNG pair, and a minor changeset describing the visual shift

#### Scenario: No unsolicited publishes
- **WHEN** all CI checks pass on `main`
- **THEN** nothing is published until the owner triggers the release workflow

#### Scenario: The server's patch promise is about its output
- **WHEN** a patch release of `@pensketch/mcp` changes the SVG `render_diagram` returns
- **THEN** the release is misclassified and the change requires a minor instead
