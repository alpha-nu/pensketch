# core-renderer — Delta Specification

> A shape can take depth: an oblique extrusion assembled from the passes the
> goldens already norm. Where the pair lives, what a face is, where anchors
> move and what the constants are: a-diagram-takes-depth/design.md D1–D5, D8.

## ADDED Requirements

### Requirement: A shape can take depth
`draw()` SHALL accept `extrude?: boolean` and `depth?: number` beside `hops`,
as the diagram-wide default, and every node SHALL be able to carry the same
pair. Resolution SHALL be the `hop` idiom exactly: extrusion is on for a node
iff `node.extrude ?? options.extrude ?? false`, and its magnitude is
`node.depth ?? options.depth ?? DEPTH` — so an extruded diagram can flatten
one node and a flat diagram can extrude one. `pen.rect`, `pen.pill` and
`pen.diamond` SHALL accept `depth` in their options; no pen member SHALL be
added for it.

The extrusion vector SHALL be `(d, -DEPTH_RISE × d)`, with `DEPTH = 12` and
`DEPTH_RISE = 0.75` as named exports in `constants.ts`; the ratio is an
aesthetic constant and SHALL NOT be runtime-configurable, the magnitude is
data. An outline segment SHALL carry a face exactly when its outward normal
dots positive with that vector. The facing chain SHALL be offset by the
vector and drawn as one polyline between the two silhouette points, plus the
two connectors — assembled from the same double-pass strokes as every other
primitive, `reference/renderer.html` untouched, under the clause "Hand-sketch
primitive fidelity" fixed for `arc`. The quads swept by facing segments whose
outward normal has a positive x component SHALL be hatched in the muted
theme color at `HATCH_GAP` through `hatch`'s clip arm. On a box this
degenerates to a top face and a right face with only the right face shaded.
The front face SHALL keep its wash, its `hatch: true` shading and its label
unchanged.

Within the node phase the hand order SHALL be wash, front outline, faces,
shading, label; the phase order of "Diagram render order is normative" SHALL
NOT change. When a node is extruded, its `t` and `r` anchors SHALL move to
the midpoints of the silhouette edges — `r` to `(x + w + d, y + h/2 −
DEPTH_RISE × d)`, `t` to `(x + w/2 + d/2, y − DEPTH_RISE × d)` — and `l` and
`b` SHALL NOT move; `anchor` SHALL report the same points edges attach to.
When extrusion is off for the diagram and every node, the depth path SHALL
draw nothing and consume nothing from the seeded sequence.

#### Scenario: A diagram that extrudes nothing is unchanged
- **WHEN** a diagram carrying no `extrude` and no `depth` is rendered by a version that supports them
- **THEN** it serializes byte-identically to the golden generated from the reference, because the new code draws from the seeded sequence only when it is invoked

#### Scenario: A box becomes a slab
- **WHEN** a node with `shape: 'box'` is drawn with extrusion on
- **THEN** a top face and a right face are appended as double-pass strokes offset by `(d, −0.75d)`, and only the right face is hatched, muted, at `HATCH_GAP`

#### Scenario: A pill and a diamond take the same depth
- **WHEN** a `pill` and a `diamond` are drawn with extrusion on
- **THEN** each appends one offset chain between its two silhouette points plus two connectors, from the same jittered passes — no second way of drawing

#### Scenario: An edge meets the slab, not the wall behind it
- **WHEN** an edge leaves side `r` of an extruded node
- **THEN** it starts at the silhouette edge's midpoint, the same point `anchor` reports for that side

#### Scenario: The override cuts both ways
- **WHEN** a flat diagram carries one node with `extrude: true`, and an extruded diagram carries one node with `extrude: false`
- **THEN** exactly that node is extruded in the first and exactly that node is flat in the second

## MODIFIED Requirements

### Requirement: Invalid diagram data fails fast and specific
`draw()` SHALL throw an `Error` naming the offending item for: an edge
referencing an unknown node id, two nodes sharing an id, a node with an
unknown shape, an edge `label` without numeric `lx`/`ly`, a brace's `lines`
without them, an edge whose `from`
and `to` name the same node but **different** sides, an edge or note combining
`bow` with `via`, a self-transition carrying `via` or `bow`, and a `depth`
that extrusion will actually use — on the options or on a node whose
extrusion is on — that is not a positive finite number. Each message
SHALL carry what the caller needs to fix it without reading the source — the
ids that do exist, the shapes that are accepted, why a label needs coordinates,
that a loop attaches to one side, or what already describes the path a second
field is trying to describe — since the caller may be a program with no view of
the result. The four ways one path can be described twice SHALL produce one
message shape, naming the field that is refused and what already describes the
path. A field that **contradicts** the path actually drawn SHALL throw; a field
that merely does not **apply** to it SHALL be ignored. That is the line between
`via` or `bow` on a loop, which describe corners it will not turn at and a
bulge it will not carry, and `out` or `span` on a straight edge, which describe
a loop that is not being drawn and whose names say so. An empty `via` describes
no corners, contradicts nothing, and SHALL be ignored wherever a filled one
throws. A `bow` that is not a finite number SHALL throw rather than draw, as
`out` and `span` already do, rather than reading as absent and drawing the
straight line. A `depth` on a node whose extrusion is off is a field that does
not apply and SHALL be ignored under the same line. There SHALL be no other
validation, no console warnings, and no silent fallbacks in library code.

#### Scenario: Unknown node id
- **WHEN** an edge references node id `"ghost"` that no node declares
- **THEN** `draw()` throws an `Error` whose message contains the edge index, `"ghost"`, and the ids the diagram does declare

#### Scenario: A repeated id is not resolved silently
- **WHEN** two nodes declare the same `id`
- **THEN** `draw()` throws rather than keeping one of them, since every edge naming that id would otherwise point at a node the author did not mean

#### Scenario: A brace label without coordinates
- **WHEN** a brace carries `lines` and `lx` or `ly` is not a number
- **THEN** `draw()` throws, in the words an edge label is refused in, because the reason is the same one: nothing here measures text

#### Scenario: A depth that cannot be drawn
- **WHEN** `draw()` is called with `extrude: true` and a `depth` of `NaN`, `-3` or `Infinity`, on the options or on an extruded node
- **THEN** it throws naming the field and what it accepts, rather than reading it as absent and drawing the default slab

#### Scenario: A depth that applies to nothing is ignored
- **WHEN** a node carries `depth: 40` and extrusion is off for it and for the diagram
- **THEN** the node draws flat and nothing throws, because the field does not apply
