# react-bindings Specification

## Purpose
TBD - created by archiving change initial-release. Update Purpose after archive.
## Requirements
### Requirement: PenSketch renders a diagram declaratively
`<PenSketch>` SHALL render a bare `<svg>` (spreading rest props, forwarding
its ref, `viewBox` required) and SHALL draw the diagram into it via core
`draw()` in an effect keyed on `[diagram, seed, theme]`. `diagram` and `theme`
SHALL be compared by identity, and the component documentation SHALL state
that callers keep them module-level or memoized.

#### Scenario: Mount draws
- **WHEN** `<PenSketch diagram={FLOW} seed={7} viewBox="0 0 700 150"/>` mounts
- **THEN** the svg contains the rendered diagram

#### Scenario: Seed change redraws
- **WHEN** the `seed` prop changes from 7 to 8 on a mounted component
- **THEN** the svg content is replaced with the seed-8 rendering

#### Scenario: Stable identities do not redraw
- **WHEN** the component re-renders with the same `diagram`/`seed`/`theme` identities
- **THEN** the svg's children are not rebuilt

### Requirement: useSketch exposes the low-level pen
`useSketch(sketch, options)` SHALL return a ref for an `<svg>`; after mount —
and whenever `sketch`, `seed`, or `theme` identity changes — it SHALL clear
the svg and invoke `sketch` with a fresh `Pen` bound to that svg and the
seeded PRNG.

#### Scenario: Custom drawing runs
- **WHEN** a component attaches the returned ref and mounts
- **THEN** the callback receives a working `Pen` and its strokes appear in the svg

### Requirement: Effects are StrictMode-safe
All drawing effects SHALL be idempotent (clear-then-draw), so React
StrictMode's double-invoked effects SHALL produce output identical to a
single invocation. No effect SHALL register listeners or timers; cleanup
SHALL be unnecessary by construction.

#### Scenario: StrictMode double effect
- **WHEN** `<PenSketch>` mounts inside `<React.StrictMode>`
- **THEN** the svg serializes identically to a non-StrictMode mount

### Requirement: Server rendering is safe
On the server, `<PenSketch>` SHALL render the empty `<svg>` without touching
any DOM API, and drawing SHALL happen on client mount — producing no
hydration mismatch, since children are added after hydration.

#### Scenario: renderToString
- **WHEN** `<PenSketch>` is rendered with `react-dom/server`'s `renderToString`
- **THEN** it returns an empty svg element markup and does not throw

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

