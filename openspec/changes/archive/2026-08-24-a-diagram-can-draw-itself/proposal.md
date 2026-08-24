# Proposal: a-diagram-can-draw-itself

> `draw` already lays every stroke down in the order a hand would use. It
> throws that order away, and no page can recover it — so a diagram that draws
> itself is currently something each consumer re-derives, badly.

## Why

**Found by shipping one.** An explainer built through the MCP server reveals
each panel stroke by stroke, and the effect is good enough to want as a
feature. Reading the page back, the technique it used is wrong in two ways
that neither review nor any gate caught, and both are structural rather than
careless.

**The order is z-order, not hand order.** `draw` emits groups, then *every
edge*, then the node shapes — deliberately, so connectors sit under the boxes
they join. Staggered in document order, a diagram draws every connector into
empty space and then pops the boxes in underneath. A page holding a finished
`<svg>` sees a list of anonymous `<path>` elements; it cannot tell a box side
from a connector without re-deriving this renderer's own geometry. `draw`
knows for free: it is the order it just drew in.

**`pathLength="1"` silently un-dots every dashed stroke.** It rescales *all*
distance-along-path computation, and `stroke-dasharray` is one. Measured in
Chrome on a 400 px line carrying `stroke-dasharray="2 7"`:

| | inked pixels |
|---|---|
| plain | **90** of 400 — exactly the 2⁄9 duty cycle |
| `pathLength="1"` added | **400** of 400 — solid |

Every diagram this repository ships carries dashed strokes — 2 to 14 each,
**66 across the ten**. Nothing throws; the line simply stops being dotted.

**A recipe in the documentation cannot be trusted with either.** The proof is
that this repository wrote one and shipped it broken: the explainer's own six
dotted strokes render solid today. A consuming agent handed the same recipe
would reproduce the same defect. Handed a boolean, it cannot.

## What changes

- **`draw` SHALL accept `order`, default `false`.** When set, every element
  carries `--ps-i` — how far through the drawing it is, as a 0..1 fraction, in
  **hand order** — and every path that is *not* dashed carries
  `pathLength="1"`. Nothing moves in the document: the z-order, the seeded
  sequence and the emitted elements are exactly what they were, so byte parity
  with the read-only `reference/renderer.html` holds and every golden stands.
- **A new package, `@pensketch/animation`,** owns the motion: the `<style>` it
  injects *into* the `<svg>`, the timing, and reduced motion. Core emits data
  and states no opinion about how long anything takes.
- **The CSS is internalised, and scoped with implicit `@scope`.** A `<style>`
  inside an inline `<svg>` is otherwise document-wide — measured: a second,
  unrelated SVG on the page had its paths dashed and offset. Implicit `@scope`
  binds to the `<style>`'s own parent, so nothing is stamped on the caller's
  element and no class is invented.
- **`render_diagram` SHALL accept `animate`**, returning one self-contained
  `<svg>` that animates in a page, as an `<img>`, or opened as a file.
  `render_png` SHALL NOT accept it: a raster cannot animate, and the tool
  boundary refuses what it cannot carry rather than ignoring it.
- **`PenSketch` SHALL accept `animate` — a function, not a flag** — applied
  inside the effect that draws, and `@pensketch/react` SHALL declare no
  relationship with the new package at all.
- **No property that hides a stroke SHALL be set outside the keyframes.** This
  is what makes a diagram that cannot animate a *finished* diagram rather than
  a blank one, and it is the single largest correction a review round made.
- **`examples/photosynthesis` becomes `examples/animation`** and ships, losing
  the hand-rolled prep it currently carries.

## Impact

- **Affected specs**: `animation` (added), `core-renderer`, `mcp-server`,
  `react-bindings`, `repo-tooling`, `documentation-and-examples`.
- **Affected code**: `packages/core/src/{draw,types}.ts`, a new
  `packages/animation/`, `packages/mcp/src/{tools,render}.ts`,
  `packages/react/src/PenSketch.tsx`, `tools/check-size.mjs`,
  `tools/shipped-diagrams.mjs`, `docs/agents.md`, `README.md`.
- **Four packages in one release**, at the owner's decision: core and mcp
  minor, react minor, animation at its first version.

## Measured, on a built prototype

Built against the 0.5.0 tree, measured with `npm run size`, then reverted with
`git checkout`:

| entry | before | with the change | |
|---|---|---|---|
| `@pensketch/core` | 4179 | 4373 | +194, fits 5120 |
| `@pensketch/core/server` | 4196 | **4374** | +178, **fails 4300 by 74** |
| `@pensketch/core/check` | 3390 | 3394 | +4 — noise; `check.ts` imports constants, sample and types, never `draw` |
| `@pensketch/react` | 472 | 472 | unmoved |
| `@pensketch/animation` | — | **546** | the whole package |

`./server` is the binding gate: it bundles its own copy of `draw`, so a
drawing feature lands there whether or not anyone imports it. 4374 plus the
conventional 100 B of gzip headroom is 4474, taken up to **4480**.

On the wire the showcase goes from 47048 to 48393 bytes gzip, **+2.8 %**. The
`pathLength` attribute is a constant string and gzip erases it — +133 B of
that total. The remaining ~1200 B is the index, which is close to
incompressible because every value is distinct. A 0..1 fraction rather than an
integer costs 136 B more and buys a page that sets the total duration once,
for any diagram, without knowing the element count.

**Ten browser checks pass** on the two halves together: the animated diagram
is mid-draw while a second diagram on the same page is untouched, dashed
strokes keep their dashes, the pen's two-pass opacity survives, every shape is
drawn before the first connector, all text comes last, and reduced motion
shows the finished drawing with both the dots and the pressure intact.

**Two mutations confirm those checks are evidence, not decoration.** Stripping
`@scope` fails "the other diagram is untouched" at 9 of 45 elements pending.
Removing the dotted guard fails "dotted stays dotted" at `1px | 1px`. All 375
existing tests pass unedited with the flag off, and `order: false` output
carries neither `--ps-i` nor `pathLength`.

## What the prototype caught, which the spec states as requirements

Three defects that would otherwise have shipped, none of them visible by
reading:

1. **`pathLength` un-dots a dashed stroke**, as above.
2. **The `animation` shorthand resets `animation-delay`.** A delay set in a
   separate, lower-specificity rule is silently returned to zero and the entire
   drawing lands at once. The delay belongs inside the shorthand, where the
   first `<time>` is the duration and the second is the delay.
3. **Reduced motion must reset per channel.** A blanket `opacity: 1` beats the
   pen's own `opacity` *attribute* and flattens every stroke's lighter second
   pass — the thing that reads as pressure.

## What a SWAT round changed

Four architects reviewed the design. Three findings survived verification and
all three are in the specs above.

**The starting state moves inside the keyframes.** As first written, the reveal
set `stroke-dasharray: 1; stroke-dashoffset: 1` as a static declaration and
animated the offset home. A missing `--ps-i` — from a core older than `order`, an
element a bare `pen` filled, or a caller who forgot the option — makes the
`animation` shorthand invalid at computed-value time, so `animation-name`
computes to `none`. The static declaration survives that, and a one-unit dash
with a one-unit offset on a path declared one unit long puts the gap over the
whole line. Measured in Chrome against a control of 401 inked pixels:

| | inked pixels |
|---|---|
| control, no stylesheet | 401 |
| starting state outside the keyframes, `--ps-i` absent | **0** — a blank frame |
| starting state outside, version skew | **200** — a frozen dotted ghost |
| **starting state inside the keyframes**, any of those | **401** |

The spec promised one degradation and the design delivered four. Moving the
starting state into the `from` block with `both` for the fill mode collapses
them to the promised one, and the stylesheet gets *smaller* — 238 B gzip
against 241.

**The per-channel reduced-motion reset is deleted.** It existed to stop a
blanket `opacity: 1` flattening the pen's lighter second pass. With nothing set
outside the keyframes there is nothing to reset: `animation: none` alone yields
the pen's own values, measured at 401 with the `opacity` attribute and every
`2 7` dash pattern intact. Three declarations guarding an input that can no
longer arrive is the belt-and-suspenders this project refuses. What replaces it
is one sentence and the reason it is enough, because that reasoning is what
stops the next hand reintroducing the class.

**`@pensketch/react` declares nothing.** The prop takes the function; the
consumer imports it. Four shapes were measured and each fails on something the
repository already has a rule about:

| shape | why not |
|---|---|
| required peer + static import | 546 B in every consumer's bundle for a prop most never set — more than `@pensketch/react` weighs — and invisible to `npm run size`, which measures the entry and externalises the peer: 526 B declared, 819 B inlined, both passing 2048 |
| optional peer + static import | a required peer wearing the wrong label. Measured in two bundlers: a named import of an absent optional peer fails the consumer's build; a namespace import builds and throws at load. No gate here can catch it — a workspace symlink resolves it in all of them |
| optional peer + dynamic import | works, but makes the drawing effect asynchronous, which is what makes cleanup necessary and costs the requirement saying it is not |
| a `@pensketch/react/animate` subpath | forces `splitting: false` into the react config and inlines a second complete copy of `PenSketch` — 444 B gzip — for anyone importing both entries |

The core peer's argument does not carry over, and that is the finding rather
than a gap: core is a peer because the bindings *call* it and two copies would
render one seed two ways. The motion arrives from a caller who has already
imported it, and its rules are a constant, so two copies cannot disagree.

The animation package's own peer on core is **floored at the minor that ships
`order`** rather than opened across `0.x`, because an open range admits a core
that stamps no `--ps-i` — and that install is exactly the skew nothing here can
detect at runtime.

## What is accepted rather than solved

**`@scope` is verified in Chrome only, and the degradation is reached in
practice today.** Where the at-rule is not understood the whole block is
dropped, so the diagram renders **finished and static** — never half-invisible.
That is stated in `docs/agents.md` and left unguarded on the owner's decision:
a class-based fallback would cost bytes, reintroduce the document-wide leak on
exactly the engines that cannot scope it, and make `draw` mutate the caller's
`class`.

How often that path is taken, rather than an assurance that it is rare.
Support is Chrome 118, Safari 17.4 and **Firefox 146**, which is about 90 % of
traffic — so roughly one visitor in ten sees a still diagram. Firefox is the
live case: 146 shipped in December 2025, and **ESR 140 disables `@scope`
outright by pref**, so every ESR install takes this path regardless of what it
is asked to draw. There is a Mozilla report of exactly that, filed against an
SVG document, and the pref is the reason rather than anything about SVG.

**The residual risk is a coverage gap, not a known divergence.** The concern
worth naming is not the engines that lack `@scope` — it is whether the ones
that have it resolve the *implicit* scoping root the same way when the owner
node is an **SVG-namespaced** `<style>`, because a divergence there is a
document-wide leak rather than a still diagram, and that is not on the
degradation list. Searched rather than assumed: css-cascade-6 §3.5.4 is written
in DOM terms with no namespace carve-out; WPT covers this exact shape in
`css/css-cascade/scope-implicit-003-print.html`, an SVG `<style>` with a
prelude-less `@scope`, and it **passes in Blink and Gecko**; no CSSWG issue,
WebKit bug or Mozilla bug names `@scope` together with SVG or namespaces. What
is missing is WebKit: the file is a print reftest, Safari's runs skip those, and
WebKit ships no expectation for it — so there is no upstream result either way.
Testing it here would mean downloading browsers, which this repository
deliberately does not do.

**A bare `pen` gets nothing.** The index is a property of `draw`'s phases, and
a pen driven directly has no phases. `examples/custom-pen` is unaffected and
uninstrumented.

**`raw` callbacks animate with braces and notes** rather than in a phase of
their own. That is a decision, not a consequence.
