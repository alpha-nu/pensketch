# core-renderer — Delta Specification

> A shape can take depth: an oblique extrusion assembled from the passes the
> goldens already norm. Where the pair lives, what a face is, where anchors
> move and what the constants are: a-diagram-takes-depth/design.md D1–D5, D8.

## ADDED Requirements

### Requirement: A shape can take depth
`draw()` SHALL accept `extrude?: boolean` and `depth?: number` beside `hops`,
as the diagram-wide default, and every shape node SHALL be able to carry the
same pair. A group never extrudes: it bounds, it is not an object, and the
pair on a group is a field that does not apply — `draw` SHALL ignore it,
while the published schema refuses it on a group the way it already refuses
`hatch` and `accent` there, and that split is stated here so it is read
rather than discovered. For a **shape** node — never a group, whatever
either field says — resolution SHALL be the `hop` idiom exactly: extrusion
is on iff `node.extrude ?? options.extrude ?? false`, and its magnitude is
`node.depth ?? options.depth ?? DEPTH` — so an extruded diagram can flatten
one node and a flat diagram can extrude one.

A shape too small or too degenerate to carry a face SHALL resolve flat,
whatever the pair says: an outline enclosing no area, or a pill whose
sampled outline has collapsed to a chord. The rule SHALL be read off what
the pen actually draws rather than restated from a constant — measured, a
pill carries faces once its **larger** dimension reaches
`3 × ARC_MIN_CHORD / π` (11.4592 px), so an 11.9 × 11.9 pill, under
`ARC_MIN_CHORD` in both dimensions, draws its faces and a 1 × 11.46 pill
draws them too. A box and a diamond carry faces at every non-zero size,
mirrored dimensions included. The pill's bound SHALL be read off the extent
its outline covers and not off the numbers it was written with, so a pill
written from its far corner carries a face exactly when its upright spelling
does: a negative radius traces the same ellipse backwards and SHALL be
sampled as finely, or the sweep collapses to the floor, the outline to a
diameter enclosing nothing, and a mirrored pill silently refuses a depth
every other shape accepts. The anchor follows the ink. A depth that draws no faces
while the anchors move would hand an edge a start point 13 px from the
node's own outline, which is the same defect as an anchor formula that
lands off the silhouette and is refused for the same reason. This is
resolution, not validation: nothing throws, no dimension is judged, and the
rule SHALL exist in exactly one place, read by `draw` and by `check`
alike. `pen.rect`, `pen.pill` and
`pen.diamond` SHALL accept `depth` in their options; no pen member SHALL be
added for it.

The extrusion vector SHALL be `(d, -DEPTH_RISE × d)`, with `DEPTH = 12` and
`DEPTH_RISE = 0.75` as named exports in `constants.ts`; the ratio is an
aesthetic constant and SHALL NOT be runtime-configurable, the magnitude is
data. An outline segment SHALL carry a face exactly when its outward normal
dots positive with that vector. The facing chain SHALL be offset by the
vector and drawn as one polyline between the two silhouette points, plus the
two connectors, plus a **rib** — front vertex to offset vertex — at every
corner interior to the facing run — assembled from the same double-pass
strokes as every other primitive, `reference/renderer.html` untouched, under
the clause "Hand-sketch primitive fidelity" fixed for `arc`. Which vertices
are corners is the caller's fact, not the outline's: a box and a diamond
extrude **faceted**, every vertex a fold, where a pill's sampled arc is one
smooth face — a turn-angle threshold cannot make that call, because
`ARC_MIN_CHORD` floors a mid-size pill's sampling at chords that turn more
sharply than a wide diamond's corner. The first cut of this requirement had
no ribs, and the picture said so before any review did: two faces fused into
one bent strip, a box missing the upper-right edge the approved prototype
drew, a defect the owner caught by eye in the shipped hero.

The band SHALL ride the outline the front was drawn with: a pill deforms
its radii point by point before stroking, and an offset of the bare ideal is
parallel to a curve nobody drew — the drawn front wanders around it, so the
band pinched and bulged against the edge the eye compares it to, and the
owner read its back edge as not parallel. The ideal still decides — the
facing run, the winding, whether a face exists at all — and the deviations
the front was drawn at carry the ink.

Shading SHALL be decided per face — the runs between corners, the whole run
where there are none. A face is shaded when any part of it descends the
screen, in the muted theme color at `HATCH_GAP` through `hatch`'s clip arm,
one call and one clip polygon per shaded face. On a box this is a lit top
face and a hatched right face; on a pill it is the whole band, where the
first cut's sub-chain rule stopped the hatch mid-face with no corner there
to explain the boundary. The front face SHALL keep its wash, its
`hatch: true` shading and its label unchanged.

Within the node phase the hand order SHALL be front outline, faces,
face shading, the front face's own `hatch: true` shading, label — a shape
node draws no wash, that is the group's treatment and a group never
extrudes; the phase order of "Diagram render order is normative" SHALL
NOT change. When a node is extruded, the anchors that move SHALL be the two
sides of the covered rectangle that face the extrusion — its screen-top and
screen-right, the sides an upright spelling names `t` and `r` — each by the
full extrusion vector to the flat anchor plus `E`: upright, `t` to
`(x + w/2 + d, y − DEPTH_RISE × d)` and `r` to
`(x + w + d, y + h/2 − DEPTH_RISE × d)`, which lands on the silhouette's ink
for every shape. The two front-plane sides — `l` and `b` upright — SHALL NOT
move. The side is chosen off the screen geometry of the covered rectangle
and never off its name: the pen reads winding off signed area, so a mirrored
spelling draws the identical picture, and it SHALL move the identical points
— with `w < 0` the side named `l` faces screen-right and moves while named
`r` does not, with `h < 0` named `b` moves and named `t` does not. The
anchor follows the ink here as everywhere: a name moved for a side the
raised run never touches hands an edge a start point 9-15 px inside the
slab, off any drawn ink. `anchor` SHALL report the same points edges attach to **when
handed the depth `draw` resolved**. Its third parameter is a resolved depth,
not a request: `anchor` SHALL apply what it is given and SHALL NOT resolve,
so a caller passing a positive depth for a group — which `draw` never does —
gets a moved point for a frame that never extrudes. That asymmetry SHALL be
stated in the function's own documentation, since the resolution rule is
otherwise private and a caller reading only the signature would take the
flat point for the attachment point.
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
- **THEN** each appends one offset chain between its two silhouette points plus its connectors and ribs, from the same jittered passes — no second way of drawing — the diamond's fold taking a rib at its interior vertex, the pill's smooth band taking none

#### Scenario: A corner takes a rib, a curve does not
- **WHEN** a box and a pill are drawn with extrusion on
- **THEN** the box carries a rib at the corner between its top and right faces, with the top face lit and the right hatched, and the pill carries no rib and one whole hatched band

#### Scenario: An edge meets the slab, not the wall behind it
- **WHEN** an edge leaves side `r` of an extruded node
- **THEN** it starts at the silhouette edge's midpoint, the same point `anchor` reports for that side

#### Scenario: A group never extrudes
- **WHEN** a diagram carrying a group is drawn with `extrude: true`
- **THEN** the group's frame draws flat, and `extrude` or `depth` on the group itself is ignored as a field that does not apply

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
that is not a positive finite number in either of two places: the options
`depth` whenever `options.extrude` is true — whether or not any node goes
on to read it, since a diagram-wide switch pointed at an undrawable value
is a contradiction on its face - and the depth every extruded node asks for,
`node.depth ?? options.depth ?? DEPTH`. That is the magnitude the pair names
and **not** the depth resolution yields: a shape too small to carry a face
resolves flat, and its depth is still judged for what it is, so a 10 × 8 pill
at `depth: 0` throws though it would have drawn flat either way. The number
is validated for what it is, not for the box it lands in. Each message
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
- **WHEN** `draw()` is called with `extrude: true` and a `depth` of `NaN`, `-3` or `Infinity`, on the options or on an extruded node — including a node whose `extrude: true` inherits the invalid options `depth`
- **THEN** it throws naming the field and what it accepts, rather than reading it as absent and drawing the default slab

#### Scenario: A depth that applies to nothing is ignored
- **WHEN** a node carries `depth: 40` and extrusion is off for it and for the diagram
- **THEN** the node draws flat and nothing throws, because the field does not apply

### Requirement: The public API surface is closed
`@pensketch/core` SHALL export exactly: `mulberry32`, `pen`, `draw`, `anchor`,
`defaultTheme`, the frozen `constants` object, and the types in design.md D2
plus `ShapeOptions` — the options `rect`, `pill` and `diamond` take, `depth`
among them — and nothing else. `DEPTH` and `DEPTH_RISE` SHALL sit inside the
frozen `constants` object like every other aesthetic constant, not beside it.
`Pen` SHALL expose exactly `stroke`, `arrow`, `rect`,
`pill`, `arc`, `diamond`, `hatch`, `label`, `wash`, and `rng`. `label` SHALL
accept a `string` (normalized to a one-element array) or a `string[]`.

Every type a caller can write into a diagram SHALL be exported by name,
`DiagramBrace` among them. A field table in a README and a `$defs` entry in the
schema are not a substitute: a caller who factors a brace into a helper needs
to annotate it, and a type that only the schema names cannot be annotated at
all.

#### Scenario: No accidental exports
- **WHEN** the built module's export names are enumerated
- **THEN** they match the design.md D2 surface plus `ShapeOptions` exactly

#### Scenario: The surface opens by exactly one name
- **WHEN** a pen's own members are enumerated
- **THEN** they are the names above and no others, `arc` being the only one its own change added

#### Scenario: A member type is nameable
- **WHEN** a TypeScript caller imports a diagram member's type from the package root
- **THEN** it resolves, for every member the data model accepts
