# diagram-checker — Delta Specification

> The checker measures what the renderer draws, and an extruded node is
> bigger than its box. The swept box, the moved anchors and the defect that
> motivates them: a-diagram-takes-depth/design.md D3, D6.

## ADDED Requirements

### Requirement: Extruded geometry is measured extruded
`check` SHALL accept the same `extrude`/`depth` pair in its options that
`draw` accepts, and SHALL read the same per-node fields, resolved by the same
idiom. For a node whose extrusion is on, every rule that measures the node
against a box — `node-overlap`, `out-of-bounds`, `group-escape`,
`label-collision`, `text-collision`, `text-overflow`'s placement and any rule
that walks its edges — SHALL use the swept box
`(x, y − 0.75d, w + d, h + 0.75d)`, and the anchors it walks SHALL be the
renderer's moved ones: `r` and `t` at the silhouette edge midpoints, `l` and
`b` unmoved. The swept box stands for the faces; they are not modeled
stroke-by-stroke, and no finding SHALL pretend otherwise.

The motivating defect shipped in this repository: a slab whose box ended
10 px inside the viewBox carried its deep face 2 px outside it, the render
clipped the face, and the eye — not the checker — caught it. `out-of-bounds`
over the swept box is that eye made mechanical.

When extrusion is off for the diagram and every node, findings SHALL be
identical to today's, byte for byte.

#### Scenario: A face crossing the viewBox is out of bounds
- **WHEN** an extruded node's box ends inside the viewBox but `x + w + d` falls outside it
- **THEN** `check` reports `out-of-bounds` for that node, where the flat box alone would have passed

#### Scenario: Slabs that touch only in depth still overlap
- **WHEN** two extruded nodes' boxes are disjoint but their swept boxes intersect
- **THEN** `check` reports `node-overlap` naming both

#### Scenario: An edge is walked from the moved anchor
- **WHEN** a rule measures an edge leaving side `r` of an extruded node
- **THEN** the path it walks starts at the silhouette edge's midpoint, the same point `draw` attaches the edge to

#### Scenario: A flat check is unchanged
- **WHEN** `check` runs on a diagram with no `extrude` and no `depth` anywhere
- **THEN** its findings are exactly what today's checker reports
