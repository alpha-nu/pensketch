# diagram-checker — Delta Specification

> The checker measures what the renderer draws, and an extruded node is
> bigger than its box. The swept box, the moved anchors and the defect that
> motivates them: a-diagram-takes-depth/design.md D3, D6.

## ADDED Requirements

### Requirement: Extruded geometry is measured extruded
`check` SHALL accept the same `extrude`/`depth` pair in its options that
`draw` accepts, and SHALL read the same per-node fields, resolved by the same
idiom. For a shape node whose extrusion is on, every rule that measures the node's
**ink** — `node-overlap`, `out-of-bounds`, `group-escape` on the member's
side, `label-collision`'s stroke geometry, and every rule that walks its
edges — SHALL use the swept box `(x, y − 0.75d, w + d, h + 0.75d)`, and the
anchors it walks SHALL be the renderer's moved ones: `t` and `r` at the flat
anchor plus the extrusion vector, `l` and `b` unmoved. Every rule that
measures the node's **label** — `text-overflow`, `text-collision` — SHALL
keep the front box, because the label sits on the front face and does not
move: sweeping it would hand `text-overflow` d px of room no glyph can use,
which is claimed slack that spills. A group's own box never sweeps — a group
never extrudes — while its members' swept boxes are what `group-escape`
measures against the group's flat frame. The swept box stands for the faces;
they are not modeled stroke-by-stroke, and no finding SHALL pretend
otherwise.

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

#### Scenario: A label's room does not grow with depth
- **WHEN** an extruded node's label width is measured by `text-overflow`
- **THEN** the room is the front box's, exactly what a flat node of the same box offers

#### Scenario: A member's slab can escape its group
- **WHEN** an extruded member's swept box crosses its group's frame while its flat box does not
- **THEN** `check` reports `group-escape`, measured against the group's flat frame, because the group itself never extrudes

#### Scenario: A flat check is unchanged
- **WHEN** `check` runs on a diagram with no `extrude` and no `depth` anywhere
- **THEN** its findings are exactly what today's checker reports
