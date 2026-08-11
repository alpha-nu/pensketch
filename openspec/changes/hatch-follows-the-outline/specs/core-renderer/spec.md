# core-renderer — Delta Specification

> What `hatch` is cut to. The measurements, the prototype that priced it and
> the three ways the shipped version differs from that prototype:
> hatch-follows-the-outline/design.md.

## ADDED Requirements

### Requirement: Hatching is cut to the shape's outline
`hatch` SHALL rule 45° lines across the rectangle it is given, `HATCH_GAP`
apart, and cut each of them to that rectangle in closed form. Given a clip
polygon it SHALL cut them to that instead — the same lines, cut somewhere
else — leaving the rectangle to say only which lines are ruled.

Cutting to a polygon SHALL solve each of its edges for the line, sort the
crossings along the line and stroke them in pairs, which fills by the even-odd
rule and so admits a concave or self-intersecting outline. Edges SHALL be
walked wrapping round, so a polygon that repeats its first point and one that
does not are the same outline. A crossing SHALL be counted when the line falls
in the half-open interval between the edge's two ends taken low to high,
whichever way round the edge runs: a line crossing through a vertex is then
reported by one of the two edges meeting there, and a line that only touches
one by both or by neither, which is what keeps the crossings in pairs. Reading
that interval from each edge's direction of travel instead reports every vertex
once, which is right for a crossing and wrong for a touch, and one stray
crossing pairs the whole line up wrongly.

`draw` SHALL pass a clip for every shape whose outline is not its box, and none
for a `box`. The clip SHALL stand `HATCH_INSET` inside the outline the node is
drawn with, measured perpendicular to that outline, which is not the same as
the outline inscribed in the box inset by `HATCH_INSET`: on a 150 × 76 diamond
the second leaves 1.81 px and on a 278 × 30 one it leaves nothing at all. A
shape too small to hold the inset SHALL shade nothing rather than shade a
mirrored sliver of itself.

A `box` SHALL keep the closed form. The reference emits a degenerate
zero-length stroke at its first scanline where a contour clip emits nothing —
14 strokes against 13 for `SAMPLER`, 21 against 20 for `BUDGETS` — so routing a
box through the clip would fail parity structurally rather than by rounding,
and `reference/renderer.html` is normative.

#### Scenario: A hatched box is shaded exactly, and identically to before
- **WHEN** a node with `shape: 'box'` and `hatch: true` is drawn
- **THEN** every hatch stroke lies within the node's box inset by `HATCH_INSET`, allowing for the hatch jitter, and the parity goldens are unchanged

#### Scenario: A hatched pill is shaded inside its ellipse
- **WHEN** a node with `shape: 'pill'` and `hatch: true` is drawn
- **THEN** every hatch ink point lies within the ellipse the pill traces, allowing for the jitter

#### Scenario: A hatched diamond is shaded inside its four sides
- **WHEN** a node with `shape: 'diamond'` and `hatch: true` is drawn
- **THEN** every hatch ink point lies within the diamond, and each corner of its box — half the box's area and none of the shape's — is bare

#### Scenario: A vertex the line only touches keeps the crossings paired
- **WHEN** a ruled line meets a clip's vertex without leaving the shape there
- **THEN** the span runs on to the shape's true boundary rather than stopping at that vertex

#### Scenario: A caller's own outline can be shaded
- **WHEN** a `raw` callback strokes a polygon of its own and passes those points to `hatch`
- **THEN** the shading is cut to that polygon, concave notches included

## MODIFIED Requirements

> Restated from the baseline as `arc-connectors` and `brace-annotations` leave
> it, which is what is in the main spec today: both archived on 2026-08-11.
> Only the hatching clause differs.

### Requirement: Hand-sketch primitive fidelity
Every primitive the reference draws SHALL reproduce its behavior exactly:
double-pass strokes (second pass ×.75 width, opacities .92/.5, round caps),
~26 px segmentation with ×.4 endpoint damping, dash pattern `2 7` for dotted,
corner overshoot `4 × rng()` per rect stroke end in the reference's stroke
order, 26-segment pills with radius jitter 3/2 at amplitude 1.4,
closed-midpoint diamonds, 11 px-spaced hatching cut to the rectangle it is given
in the reference's own closed form, per-line `<text>`
labels with `dominant-baseline:middle` and inline fill/size style, and plain
`rx=6` wash rects. A primitive the port adds where the reference has none —
`arc` is the first — SHALL be assembled from those same passes rather than
from a second way of drawing, and `reference/renderer.html` SHALL NOT be
edited to acquire it: it is the ground truth the port is measured against, and
a target that moves measures nothing. All aesthetic constants SHALL live as
named exports in `constants.ts` and SHALL NOT be runtime-configurable in this
release.

#### Scenario: Double-stroke structure
- **WHEN** a single `stroke()` call renders
- **THEN** exactly two `<path>` elements are appended, the second with `stroke-width` equal to ×.75 of the first and opacities .92 and .5 respectively

#### Scenario: Dotted stays dotted only on the shaft
- **WHEN** `arrow()` renders with `dotted: true`
- **THEN** the shaft paths carry `stroke-dasharray="2 7"` and the two arrowhead strokes carry none

#### Scenario: A primitive the reference does not have
- **WHEN** `arc()` renders
- **THEN** it appends the same two jittered `<path>` elements every other primitive appends

#### Scenario: Adding a primitive moves nothing already drawn
- **WHEN** a diagram that calls no arc is rendered by a port that has one
- **THEN** it still serializes byte-identical to the golden generated from the reference, since the new code draws from the seeded sequence only when it is invoked
