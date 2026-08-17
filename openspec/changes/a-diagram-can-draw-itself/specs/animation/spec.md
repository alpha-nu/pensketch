# animation — Delta Specification

> A new package. Core says what order a hand would draw in; this says how long
> that takes and what it looks like. The split is that only `draw` can know the
> order, and nothing but taste decides the timing.

## ADDED Requirements

### Requirement: The motion is a package of its own
`@pensketch/animation` SHALL turn an `<svg>` that `draw` filled with
`order: true` into one that draws itself, and SHALL do nothing else. It SHALL
declare `@pensketch/core` as a peer dependency **floored at the minor that
ships `order`** and excluding the next major, and no regular
dependency. The floor is not decoration: a range open across all of `0.x`
admits a core that stamps no `--ps-i` at all, and an install that resolves one is
the version skew this package cannot detect at runtime. The rest of the
reasoning is what `@pensketch/react` already records: a package that
owned its own copy of the renderer would let one application hold two whose
output for the same diagram and seed disagrees, and a package manager resolves
that silently.

The floor SHALL be written the moment it is writable, and not before, because
it is unwritable until the core that carries it exists. Measured: with the
newest published core below the floor, a cold `npm install` fails `ETARGET`
and writes no lockfile at all, leaving `npm ci` nothing to run from — and
`--legacy-peer-deps` produces a lockfile that `npm ci` then rejects for the
same reason. What makes it writable is core carrying the version in the same
tree, where npm satisfies the peer from the workspace link and never asks the
registry. The raise and the release that makes it installable are therefore the
same commit, and a test SHALL assert that pairing — going red in exactly that
commit and never before — rather than asserting the range, which would fail
every release. Changesets SHALL NOT be relied on to make the raise: a floor
one minor below the new version still satisfies it, so
`onlyUpdatePeerDependentsWhenOutOfRange` leaves the range exactly as written.

It SHALL carry a byte budget like every other bundled entry, because a page
that draws diagrams downloads this.

The motion SHALL be CSS. No per-element JavaScript SHALL run during the
drawing: the package writes rules and custom properties once, and the browser
does the rest.

#### Scenario: Core is not bundled twice
- **WHEN** the package's dependencies are enumerated
- **THEN** `@pensketch/core` is a peer excluding the next major, and there is no regular dependency

#### Scenario: The floor arrives with the core that satisfies it
- **WHEN** the core in the tree reaches the minor that ships `order` while the peer range still admits one below it
- **THEN** the suite fails, naming both versions, in the same commit that first makes the raise installable

#### Scenario: Nothing runs per frame
- **WHEN** a diagram is drawing
- **THEN** no callback from this package is executing, the animation being entirely declarative

### Requirement: The stylesheet is injected into the drawing
`animate(svg, options?)` SHALL insert a `<style>` element as the svg's **first
child** and set the timing custom properties on the svg itself. The result
SHALL be self-contained: it animates inline in a page, embedded as
`<img src>`, and opened as a file, with nothing else loaded.

It SHALL be called **after** `draw`, which removes all existing children and
would otherwise take the `<style>` with it. That ordering SHALL be stated where
a caller reads it, because it is not guessable from the signature.

The rules SHALL be a constant, identical for every diagram. What differs
between two diagrams SHALL ride on custom properties set on each root, so that
two diagrams on one page carry byte-identical blocks and neither can override
the other's timing.

A string-side helper SHALL exist for callers holding markup rather than a live
element. It SHALL NOT assume the markup contains an `<svg>` tag: `renderToString`
returns the *contents* of an `<svg>` and the caller supplies the wrapper, so
the rules SHALL be reachable on their own.

#### Scenario: Self-contained output
- **WHEN** an animated diagram is written to a file and opened, and separately embedded as `<img src>`
- **THEN** it draws itself in both, with no external stylesheet or script

#### Scenario: Two diagrams keep their own timing
- **WHEN** one page holds two animated diagrams with different durations
- **THEN** each draws at its own pace, the shared rules reading a custom property from its own root

#### Scenario: A redraw is not silently un-animated
- **WHEN** `draw` is called again on an element that was animated
- **THEN** the `<style>` is gone with the rest of the children, and `animate` must be called again — as its documentation says

### Requirement: The rules are scoped to the diagram they came in
The rules SHALL be wrapped in an implicit `@scope` block, which binds to the
stylesheet's own parent — the drawing it was put in. Unwrapped they would apply
to the **whole document**: a stylesheet inside an inline SVG is not scoped to
that element.

What such a leak reaches is narrower than it first appears, and the narrower
statement is the one worth holding, because the wider one is no longer
falsifiable. An unrelated SVG matches the leaked selector, but carries no
`--ps-i` — and `--ps-i` is what is not there to inherit, so the shorthand it matches
is invalid at computed-value time and the rules are inert on it. That is the
same mechanism the requirement below relies on. Measured with `@scope` stripped:
a foreign SVG's paths kept their own `4px, 6px` dashes and their `0.6/0.55`
opacities, and computed `animation: none`. What the leak *does* reach is
**another drawing `draw` stamped** — a second pensketch diagram on the same
page, rendered with `order` and deliberately left unanimated. Measured, all
**24 of its 24 elements** began running the reveal. That is the neighbour a
test SHALL use, because it is the only one that can fail.

Scoping SHALL NOT be achieved by stamping a class or id on the caller's
element. The element belongs to the caller; `draw` fills it and does not
rename it.

Where `@scope` is not understood the block SHALL be dropped whole, leaving the
diagram **finished and static**. That is the accepted degradation: a diagram
that does not animate is a diagram, where a diagram stuck at its initial state
is a blank rectangle.

#### Scenario: A neighbouring drawing is untouched
- **WHEN** a page holds an animated diagram, a second diagram drawn with `order` and left unanimated, and an unrelated SVG
- **THEN** none of the second diagram's elements is running the reveal, and the unrelated SVG keeps its own dash pattern and opacity

#### Scenario: Nothing is added to the caller's element
- **WHEN** an animated svg's attributes are compared with what the caller wrote
- **THEN** no class or id has been added, only the timing custom properties

#### Scenario: An engine without `@scope`
- **WHEN** the rules cannot be parsed
- **THEN** the diagram renders complete and still, rather than partly or not at all

### Requirement: Every starting state lives inside a keyframe
No property that hides a stroke SHALL be set outside the keyframes. The
starting state SHALL live in the `from` block and the animation SHALL carry
`both` for its fill mode, so that an element with no animation running is an
element the stylesheet has not touched.

This is the clause that makes one degradation out of four. A `--ps-i` that is
absent — because the core resolved is older than `order`, because the element
was filled by a bare `pen`, because the caller forgot `order` — makes the
`animation` shorthand invalid at computed-value time, so `animation-name`
computes to `none`. Whatever was set *outside* the keyframes survives that,
and a `stroke-dasharray: 1` surviving alone on a path declared one unit long
puts the gap over the whole line. Measured in Chrome, against a control of 401
inked pixels: with the starting state outside the keyframes a missing `--ps-i`
renders **0** — a blank frame, the exact outcome the `@scope` clause below
names as unacceptable — and a skewed pair renders a frozen dotted ghost at
**200**. With it inside, all of them render **401**: the drawing the pen
emitted, complete and still.

The reveal SHALL be measured against that, not asserted: a diagram whose
animation does not run for any reason SHALL be pixel-identical to the same
diagram with no stylesheet at all.

#### Scenario: A drawing that cannot animate is a finished drawing
- **WHEN** the animation does not run — the index is absent, the element was never stamped, or the rules were dropped
- **THEN** the diagram renders exactly as it would with no stylesheet present, rather than blank or partly inked

### Requirement: A dashed stroke is revealed by fading, not by drawing
A solid stroke SHALL be revealed by dashing it with a single dash the length of
itself and sliding the offset home, which `pathLength="1"` makes one keyframe
enough for.

A **dashed** stroke SHALL NOT be revealed that way, and SHALL fade in on
`stroke-opacity` instead. Its dashes are the drawing: `pathLength` rescales
every distance-along-path computation, `stroke-dasharray` among them, so a
`2 7` pattern measured against a total length of one renders as a solid line.
Measured on a 400 px line: 90 inked pixels plain, 400 with `pathLength="1"`.

`stroke-opacity` SHALL be the channel, never `opacity`. The pen carries its
two-pass weighting — a dark pass and a lighter one, which is what reads as
pressure — in an `opacity` **attribute**, and a CSS `opacity` beats it.

#### Scenario: Dots survive the animation
- **WHEN** a diagram with a dotted connector is drawing, and after it finishes
- **THEN** that connector's dash pattern is the one the pen emitted, at every moment

#### Scenario: Pressure survives the animation
- **WHEN** the computed opacities of a drawn diagram's paths are collected
- **THEN** both the dark and the lighter pass are present, unflattened

### Requirement: The stagger is inside the shorthand
The per-element delay SHALL be written inside the `animation` shorthand, where
the first `<time>` is the duration and the second the delay.

It SHALL NOT be set by a separate `animation-delay` declaration on a
lower-specificity selector. The shorthand resets every longhand it does not
name, so such a delay is silently returned to zero and the entire drawing
lands at once — which looks like a working animation that is merely fast, and
so is not caught by looking.

#### Scenario: The drawing is staggered, not simultaneous
- **WHEN** a diagram is sampled part-way through its declared duration
- **THEN** some elements have been drawn and some have not

### Requirement: Reduced motion is one declaration
Under `prefers-reduced-motion: reduce` the rules SHALL do nothing but switch
the animation off, and that SHALL be sufficient.

It is sufficient **because** the requirement above puts every starting state
inside a keyframe: with no animation running, every property falls back to the
value the pen emitted, so the picture is already the finished one. Nothing
needs restoring per channel — and a reset that tried would be the danger rather
than the safeguard, since a blanket `opacity: 1` beats the pen's own `opacity`
**attribute** and flattens the lighter of its two passes, which is what reads
as pressure.

The reasoning is the load-bearing half of this requirement, not the rule. A
later hand that sets one hiding property outside a keyframe reintroduces the
whole class silently, and the accommodation stops working without anything
failing.

The switch SHALL be at least as specific as the rules it overrides. A
lower-specificity `animation: none` loses to the selector that set the
shorthand and the drawing keeps running under `reduce` — measured mid-flight at
a `stroke-dashoffset` of 0.345386. This is the same trap as the delay clause
above, in the other direction, and both are stated because neither is visible
by reading.

#### Scenario: Finished at once, and identical to no stylesheet
- **WHEN** a viewer who has asked not to be moved opens the page
- **THEN** the diagram is pixel-identical to the same diagram rendered with no stylesheet at all — the pen's two-pass opacity and every dash pattern intact — because switching the animation off is the whole of the accommodation

#### Scenario: The switch outranks what it switches off
- **WHEN** the reduced-motion block is given a selector less specific than the one that set the animation
- **THEN** the animation keeps running, which is why the specificity is stated rather than left to whoever writes the block
