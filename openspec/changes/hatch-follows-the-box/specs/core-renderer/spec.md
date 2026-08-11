# core-renderer — Delta Specification

> What `hatch` is clipped to, and which shapes that is right for. The
> prototype, the measurement and the budget it does not fit inside:
> hatch-follows-the-box/design.md.

## ADDED Requirements

### Requirement: Hatching is clipped to the box, not to the outline
`hatch` SHALL shade the rectangle it is given, walking 45° lines at
`HATCH_GAP` and clipping each to that rectangle's own edges. `draw` SHALL pass
the node's box inset by `HATCH_INSET` on every side, for every shape, and
SHALL NOT vary that by shape.

Where the outline is not the box, ink SHALL therefore fall outside it, and
each shape's behaviour SHALL be pinned by a test rather than left to the
goldens, which hatch only boxes. On a `box` the shading is exact. On a `pill`
it overshoots the ellipse, worst at the corner of the inset box — 15.5 px on
the 150 × 50 this repository ships. On a `diamond` it fills all four corner
triangles, which is half the box's area.

A change that makes hatching follow a contour SHALL NOT do so by replacing the
clip for a `box`: the reference emits a degenerate zero-length stroke at its
first scanline, a correct clip emits nothing there, and
`reference/renderer.html` is normative.

#### Scenario: A hatched box is shaded exactly
- **WHEN** a node with `shape: 'box'` and `hatch: true` is drawn
- **THEN** every hatch stroke lies within the node's box inset by `HATCH_INSET`, allowing for the hatch jitter

#### Scenario: A hatched pill is shaded past its outline
- **WHEN** a node with `shape: 'pill'` and `hatch: true` is drawn
- **THEN** hatch ink lies outside the inscribed ellipse, furthest at the corner of the inset box rather than at 45°

#### Scenario: A hatched diamond is shaded into all four corners
- **WHEN** a node with `shape: 'diamond'` and `hatch: true` is drawn
- **THEN** hatch ink appears in each of the four corner regions of its box, outside the diamond, and no rule of `check` reports it

## MODIFIED Requirements

### Requirement: Hand-sketch primitive fidelity
Every primitive SHALL reproduce the reference behavior exactly: double-pass
strokes (second pass ×.75 width, opacities .92/.5, round caps), ~26 px
segmentation with ×.4 endpoint damping, dash pattern `2 7` for dotted, corner
overshoot `4 × rng()` per rect stroke end in the reference's stroke order,
26-segment pills with radius jitter 3/2 at amplitude 1.4, closed-midpoint
diamonds, 11 px-spaced hatching clipped to the rectangle it is given, per-line
`<text>` labels with `dominant-baseline:middle` and inline fill/size style,
and plain `rx=6` wash rects. All aesthetic constants SHALL live as named
exports in `constants.ts` and SHALL NOT be runtime-configurable in this
release.

#### Scenario: Double-stroke structure
- **WHEN** a single `stroke()` call renders
- **THEN** exactly two `<path>` elements are appended, the second with `stroke-width` equal to ×.75 of the first and opacities .92 and .5 respectively

#### Scenario: Dotted stays dotted only on the shaft
- **WHEN** `arrow()` renders with `dotted: true`
- **THEN** the shaft paths carry `stroke-dasharray="2 7"` and the two arrowhead strokes carry none
