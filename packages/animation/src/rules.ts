// The three selectors are the partition `draw({ order: true })` already made,
// read back off its output: it stamps `pathLength="1"` on every path carrying
// no `stroke-dasharray` and on no other element, so a solid stroke, a dashed
// one and everything that is not a path are told apart by attributes the
// renderer wrote rather than by anything added here.
//
// `:scope>` rather than a bare descendant, for two reasons: the scoping root
// is included in a scope, so an unqualified `:not(path)` would match the
// `<svg>` itself, and every element `draw` emits is a direct child of it.
const SOLID = ':scope>path:not([stroke-dasharray])';
const DASHED = ':scope>path[stroke-dasharray]';
const REST = ':scope>:not(path)';

// Everything after the keyframe name, shared by all three rules so that what
// they differ in is only which reveal they name.
//
// The delay is the second `<time>`, inside the shorthand. Written as a
// separate `animation-delay` declaration it would be reset to zero by this
// shorthand - the shorthand resets every longhand it does not name - and the
// whole drawing would land at once, which looks like a working animation that
// is merely fast.
//
// `--ps-i` is the 0..1 fraction the renderer stamps on each element. It has no
// fallback on purpose. Absent - an older core, an element a bare `pen` drew,
// a caller who did not pass `order` - the `var()` makes this shorthand invalid
// at computed-value time and `animation-name` computes to `none`, which is the
// degradation the keyframes below are arranged around.
//
// Prefixed, and not for tidiness. `--i` is the canonical name for a stagger
// index, so a host page having one of its own is likely rather than exotic -
// and a custom property inherits, so an ancestor's reaches in here. Measured on
// a page whose wrapper sets `--i: 0.5`, with a diagram drawn *without* `order`
// inside it: named `--i` these rules put all 24 of its elements on a single
// 1.75s delay - a blank rectangle for 1.75 seconds, where the degradation above
// promises a finished picture - and named `--ps-i` they leave all 24 alone.
// (A diagram drawn *with* `order` was never at risk under either name: `draw`
// writes the index inline, and inline beats inherited.)
//
// The span is `--ps-dur` less `--ps-stroke`, so the last element starts as
// long before the end as it needs to finish there and `--ps-dur` is the whole
// drawing rather than the part of it before the last stroke.
//
// Clamped at zero, because a caller may ask for a stroke longer than the whole
// drawing. `duration: STEP - 400` is exactly that shape at a small enough step,
// and it is the pattern this project's own React example uses - at an 800ms
// step it asks for a 400ms drawing while the default stroke is 500ms.
//
// Unclamped the span goes negative and the drawing runs backwards from part
// drawn. Measured at `duration: 400, stroke: 500` over a 24-element diagram: 23
// of the 24 took a negative delay, the same 23 were already part drawn at t=0,
// and delay fell as the index rose - the element the renderer numbered last
// started first, at -0.0958s. Clamped, the same call puts all 24 at 0s: the
// drawing lands at once, which is the honest reading of "every element takes
// longer than the whole of it".
const PACE =
  ' var(--ps-stroke,.5s)' +
  ' calc(var(--ps-i)*max(0s,var(--ps-dur,2s) - var(--ps-stroke,.5s)))' +
  ' var(--ps-ease,ease-out) both';

/**
 * The stylesheet, whole and identical for every diagram. What differs between
 * two of them rides on the custom properties `--ps-dur`, `--ps-stroke` and
 * `--ps-ease`, set on each `<svg>`, so two diagrams on one page carry
 * byte-identical blocks and neither can reach the other's timing.
 *
 * Reachable on its own for a caller who is assembling markup rather than
 * holding an element, and who therefore needs to place the `<style>` inside
 * the `<svg>` wrapper themselves. `animateMarkup` is that caller's shortcut;
 * this is what it puts there.
 *
 * The defaults live here, in the `var()` fallbacks, and nowhere else: a
 * drawing takes two seconds, any one element takes half of one to appear, and
 * everything eases out.
 */
export const rules: string =
  // A solid stroke is revealed by dashing it with a single dash exactly as
  // long as itself and sliding the offset home. `pathLength="1"` is what makes
  // "as long as itself" the literal number 1, so one set of keyframes draws a
  // 400 px connector and a 12 px arrowhead barb at the same rate.
  //
  // The dash is only half of what hides it, and the half that is easy to miss
  // is the gap. SVG doubles an odd-length dasharray, so `1` computes to `1 1`:
  // one unit of ink followed by one unit of nothing, on a path declared one
  // unit long. With the offset also at 1 the ink is slid entirely off the
  // start and the gap covers the whole path, so the element inks zero pixels -
  // not a faint line, none. Chrome serialises the computed value as `1px`,
  // which reads as the dash alone and is why the gap goes unnoticed.
  //
  // The second keyframe is at 99% rather than 100%, and that is deliberate.
  // `stroke-dasharray` does not interpolate from `1` to the `none` the element
  // actually has, so it changes discretely - at the point where the interval's
  // *eased* progress reaches 0.5, which is not its half-way point. The easing
  // applies to each keyframe interval, and `ease-out` - cubic-bezier(0,0,.58,1)
  // - crosses 0.5 at 34.25% of the interval's elapsed time. So the flip over
  // the last hundredth lands at 99.343% of the element's own window, measured
  // by binary search rather than derived. The operative conclusion is the same
  // one either way and it is the one worth keeping: ending the slide at 99%
  // leaves the flip inside the last hundredth, by which time the offset is home
  // and the stroke is whole either side of it - and lets the implicit `to`
  // keyframe the engine builds from the element's own values carry both
  // properties. So a finished element is one this stylesheet is no longer
  // touching, the same way an element whose animation never ran is.
  '@keyframes ps-draw{' +
  'from{stroke-dasharray:1;stroke-dashoffset:1}' +
  '99%{stroke-dasharray:1;stroke-dashoffset:0}}' +
  // A dashed stroke must not be revealed that way: its dashes are the drawing,
  // and `pathLength` rescales every distance along the path, `stroke-dasharray`
  // among them, so a `2 7` pattern measured against a total length of one
  // renders as a solid line. It fades in instead.
  //
  // On `stroke-opacity`, never `opacity`: the pen carries its two-pass
  // weighting - a dark pass and a lighter one, which is what reads as pressure
  // - in an `opacity` attribute, and a CSS `opacity` beats it. `stroke-opacity`
  // is a separate channel and multiplies with it, so both survive.
  '@keyframes ps-fade{from{stroke-opacity:0}}' +
  // Text and anything else that is not a path. `opacity` is safe here and only
  // here: `pen.label` writes a `<text>` carrying x, y, text-anchor,
  // dominant-baseline and a style of fill and font-size, and `pen.wash` writes
  // a `<rect>` carrying x, y, width, height, fill and rx. Neither has an
  // `opacity` attribute for a CSS `opacity` to beat, and `stroke-opacity` would
  // do nothing to either, both being filled rather than stroked.
  //
  // It also matches the `<style>` this package puts there, which is the one
  // element `draw` did not write. Nothing comes of it: a `<style>` renders
  // nothing, carries no `--ps-i`, and so takes an `animation` shorthand that is
  // invalid at computed-value time - the same way every unstamped element does.
  '@keyframes ps-write{from{opacity:0}}' +
  // Implicit `@scope`, with no prelude, which binds to the stylesheet's own
  // parent - the drawing this was put in. Unwrapped, a `<style>` inside an
  // inline `<svg>` is document-wide.
  //
  // What the leak reaches is narrower than it sounds, and the narrow statement
  // is the true one. An unrelated SVG carries no `--ps-i`, so the shorthand it
  // matches is invalid at computed-value time and these rules are inert on it -
  // measured with the wrapper gone, a foreign SVG kept its own `4px, 6px`
  // dashes, its `0.6/0.55` opacities and `animation: none`. What the leak does
  // reach is another drawing `draw` stamped: a second diagram on the page,
  // rendered with `order` and deliberately left unanimated, had all 24 of its
  // 24 elements running the reveal.
  //
  // Where `@scope` is not understood the block is dropped whole and the diagram
  // renders finished and static, which is the accepted degradation: a diagram
  // that does not animate is a diagram, where a diagram stuck at its initial
  // state is a blank rectangle. That holds only because nothing below sets a
  // property outside a keyframe - the three `@keyframes` above are the only
  // place any of them appears, and keyframes on their own style nothing.
  '@scope{' +
  `${SOLID}{animation:ps-draw${PACE}}` +
  `${DASHED}{animation:ps-fade${PACE}}` +
  `${REST}{animation:ps-write${PACE}}` +
  // One declaration, and it is sufficient because every starting state is
  // inside a keyframe: with no animation running each property falls back to
  // what the pen emitted, so the picture is already the finished one. A reset
  // per channel would be the danger rather than the safeguard - a blanket
  // `opacity: 1` beats the pen's `opacity` attribute and flattens the lighter
  // of its two passes.
  //
  // The selectors are repeated verbatim rather than replaced by something
  // shorter, so that each is exactly as specific as the rule it switches off
  // and wins on order. A lower-specificity `animation: none` loses to the
  // selector that set the shorthand and the drawing keeps running under
  // `reduce`, which is the same trap as the delay above in the other
  // direction.
  '@media (prefers-reduced-motion:reduce){' +
  `${SOLID},${DASHED},${REST}{animation:none}}` +
  '}';
