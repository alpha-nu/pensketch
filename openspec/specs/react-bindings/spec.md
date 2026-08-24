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
single invocation. No effect SHALL register listeners or timers, and no effect
this package writes SHALL need cleanup.

The drawing effect SHALL stay **synchronous**. Idempotence here rests on
`draw` clearing the element immediately before it fills it, and anything
awaited between the clear and the work that follows it opens a window in which
a second invocation interleaves — which is what makes cleanup necessary, and
what a cancellation flag would then exist to paper over. A caller's `animate`
runs inside this effect and is therefore also expected to be synchronous; the
component cannot enforce that, and SHALL say so rather than promise what it
does not control.

#### Scenario: StrictMode double effect
- **WHEN** `<PenSketch>` mounts inside `<React.StrictMode>`
- **THEN** the svg serializes identically to a non-StrictMode mount

#### Scenario: One stylesheet, because the element was emptied
- **WHEN** an animated `<PenSketch>` mounts inside `<React.StrictMode>`, so the effect runs twice
- **THEN** the svg holds exactly one `<style>` — not because the component counts them, but because `draw` removed the first one before the second was inserted

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

### Requirement: A rendered diagram can draw itself
`PenSketch` SHALL accept `animate`: **a function**, not a flag, applied to the
element after `draw` has filled it, inside the same effect that draws. When it
is present the component SHALL draw with the renderer's `order` option, so the
elements the function decorates are the ones that effect just created.

`@pensketch/react` SHALL declare no relationship with `@pensketch/animation` —
not a dependency, not a peer, not an optional peer — and SHALL NOT name it in
source or in its published types. The consumer imports `animate` and passes it:

```tsx
import { animate } from '@pensketch/animation';
<PenSketch diagram={FLOW} viewBox="0 0 700 150" animate={animate} />
```

The prop's type SHALL be structural — a function taking the element — so that
nothing here resolves the package even for types. A type-only import would put
the specifier into the published `.d.ts`, where a consumer without the package
fails `tsc`, and types are not dependencies, so no package manager would have
warned them.

The reason the core peer's argument does not carry over SHALL be stated where
the two peers are listed. Core is a peer because these bindings *call* it on
every draw and two resolved copies would render one seed two ways. Neither half
holds here: the function arrives from a caller who has already imported it, and
the animation package's rules are a constant, so two copies cannot disagree.
What a peer would buy is one import line the consumer no longer writes. What it
would cost is every consumer of these bindings carrying an animation package
they may never use — and carrying it **invisibly**, because `npm run size`
measures this package's own entry and a peer is external to it. A declared peer
measures 526 bytes here and the same code inlined measures 819; both pass a
2048 budget. The gate rewards the choice that puts more bytes in the consumer's
bundle, which is why this one is decided on the manifest rather than on the
gate.

An **optional** peer with a static import SHALL NOT be used. It is a required
peer wearing a label that says otherwise: measured in two bundlers, a named
static import of an absent optional peer fails the consumer's build outright,
and a namespace import builds and then throws at load. Nothing in this
repository can catch it either, because a workspace symlink resolves the
import in every gate and only a consumer's install has the package missing.

`animate` SHALL be held in a ref and SHALL NOT enter the drawing effect's
dependency array. A function prop is compared by identity, and the natural way
to pass options is an inline arrow — `animate={svg => animate(svg, {...})}` —
which is a fresh identity on every render and would restart the drawing from
blank each time the parent re-renders. That the component already documents
this hazard twice, for `diagram` and `theme`, is the reason to close it here
rather than document it a third time: those two redraw to a pixel-identical
picture and this one is visible. The consequence SHALL be documented — changing
the function's identity does not re-animate.

With `animate` absent, the rendered markup SHALL be byte-identical to what the
component produced before this change, `order` being unset.

#### Scenario: The diagram draws itself
- **WHEN** `<PenSketch animate={animate} />` mounts
- **THEN** the element is drawn with `order` set and its strokes appear over time rather than at once

#### Scenario: The bindings never learn the package's name
- **WHEN** `@pensketch/react`'s manifest, source and published types are searched for `@pensketch/animation`
- **THEN** none of them names it, the prop's type being a function the caller supplies

#### Scenario: A re-render does not restart the drawing
- **WHEN** a parent re-renders an animated `<PenSketch>` with a fresh inline arrow for `animate`
- **THEN** the diagram carries on drawing, rather than clearing and starting again

#### Scenario: Absent means unchanged
- **WHEN** the component renders without `animate`
- **THEN** its markup matches what it produced before, carrying no stylesheet, no `--ps-i` and no `pathLength`

#### Scenario: A redraw re-animates
- **WHEN** `diagram` changes identity on an animated component
- **THEN** the new diagram draws itself too, rather than appearing finished because the stylesheet went with the old children

