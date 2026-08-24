# core-renderer — Delta Specification

> One option, and it emits data rather than behaviour. The renderer already
> knows the order a hand would use; this is it saying so.

## ADDED Requirements

### Requirement: The order a hand would draw in can be emitted
`DrawOptions` SHALL accept `order`, defaulting to `false`. With it unset the
rendered bytes SHALL be exactly what they were — no attribute added, no
element moved — so byte parity with `reference/renderer.html` holds and every
golden stands unregenerated. The reference renderer is normative and cannot be
edited, which is why this is opt-in rather than merely off by default.

With `order` set, every element SHALL carry `--ps-i`: how far through the drawing
it is, as a fraction in `[0, 1)`, written into the element's inline `style`
ahead of any style it already carries, so a `<text>` keeps its fill and size.

A fraction rather than a count, so that a page states a total duration once and
every diagram takes it, whatever its element count. A page given integers would
have to know how many elements there are before it could say how long the
drawing should last.

Every path that carries **no** `stroke-dasharray` SHALL also carry
`pathLength="1"`, which normalises it so that one keyframe draws a 400 px
connector and a 12 px arrowhead barb at the same rate. A **dashed** path SHALL
NOT receive it: `pathLength` rescales every distance-along-path computation and
`stroke-dasharray` is one, so the dash pattern would be stretched past the end
of the line and the stroke would render solid.

Nothing SHALL be reordered. The z-order, the seeded sequence, and the elements
themselves are what they were; only the number differs from document order.

`pen` used directly SHALL be uninstrumented. The index is a property of
`draw`'s phases and a pen driven by hand has none.

#### Scenario: Off by default, and byte-identical
- **WHEN** a diagram is drawn without `order`
- **THEN** its markup matches the golden exactly, carrying neither `--ps-i` nor `pathLength`

#### Scenario: Hand order, not document order
- **WHEN** a diagram with a group, three boxes and three connectors is drawn with `order`
- **THEN** every node shape carries a lower `--ps-i` than every connector, and every piece of text carries a higher one than both — while the document order is unchanged

#### Scenario: A dashed stroke is left alone
- **WHEN** a diagram with a dotted connector is drawn with `order`
- **THEN** that connector's paths carry no `pathLength`, and every undashed path carries it

#### Scenario: An existing style is not clobbered
- **WHEN** a `<text>`, which already carries a `style` with its fill and font-size, is stamped
- **THEN** it carries `--ps-i` as well as both of them

#### Scenario: A bare pen is untouched
- **WHEN** a caller drives `pen()` directly
- **THEN** nothing it emits carries `--ps-i` or `pathLength`, whatever `draw` was asked for elsewhere
