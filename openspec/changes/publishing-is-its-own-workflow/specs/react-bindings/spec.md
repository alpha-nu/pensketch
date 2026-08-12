# react-bindings — Delta Specification

> The compatibility clause this change adds to `repo-tooling` says a core minor
> may remove API. `@pensketch/react` peers on any `0.x` of core, so the two
> rules meet here. The range stays; the reason it stays is written down.

## MODIFIED Requirements

> Restated from the baseline in full, its one scenario carried word for word.
> Two paragraphs are added and nothing is removed.

### Requirement: Dependency shape is minimal
`@pensketch/react` SHALL declare no regular dependency, and exactly two peer
dependencies: `@pensketch/core` (any `0.x`) and `react` (`^18 || ^19`) — no `react-dom`,
nothing else. Core is a peer rather than a dependency because the bindings
render through it: owning a copy would let one application hold two renderers
whose output for the same diagram and seed disagrees, and a package manager
resolves that silently. As a peer, an incompatible pairing fails at install
time instead.

The core peer SHALL stay open across core minors even though a minor may now
remove a published name. A semver range cannot say "compatible until a name
goes": narrowing it to a caret would refuse every future core minor in advance,
on the chance that one of them removes something — and it would refuse them
automatically, `onlyUpdatePeerDependentsWhenOutOfRange` bumping and rewriting
these bindings on each core minor for a range change that alters nothing they
call. What the bindings actually reach for is `draw` and `pen`, two of the six
names the closed public surface holds to an exact list, and a removal is a
deliberate, named event rather than a drift.

The range being open SHALL NOT be read as the bindings being untested against
the core they ship beside: CI typechecks and runs the bindings suite against
the core in the same tree on every push, so a removal that reached them fails
there, in the commit that removed it, rather than at a consumer's install. The
range is a floor and a ceiling on the majors, and the suite is what holds the
minors.

#### Scenario: Manifest audit
- **WHEN** the published `package.json` is inspected
- **THEN** `dependencies` is absent and `peerDependencies` contains exactly `@pensketch/core` and `react`

#### Scenario: A core minor does not bump the bindings
- **WHEN** `@pensketch/core` takes a minor that the bindings' peer range already admits
- **THEN** `@pensketch/react` is neither rewritten nor released, because a range that still holds is not a change
