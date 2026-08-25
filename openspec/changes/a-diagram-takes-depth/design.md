# Design: a-diagram-takes-depth

## D1. The pair, and where it lives

The owner chose a boolean plus a value over a single numeric field, and named
them: `extrude` turns depth on, `depth` says how much. Placement follows the
`hops` precedent, the one diagram-wide switch this system already has: the
diagram-wide pair rides `DrawOptions` beside `hops` and `seed`, and the
per-member fields ride the data. Resolution is the `hop` idiom verbatim:

    on   = node.extrude ?? options.extrude ?? false
    d    = node.depth   ?? options.depth   ?? DEPTH

The override cuts both ways (owner, 2026-08-24): an extruded diagram can
flatten one node, a flat diagram can extrude one. A `depth` on a node whose
extrusion is off is a field that does not apply and is ignored, under the
line the validation requirement already draws; a `depth` that extrusion will
actually use must be a positive finite number or `draw` throws, as `bow`
already does.

Groups never extrude. A group bounds a set; it is not an object, and a slab
frame with a hatched flank drawn across its members' edges would be noise
pretending to be depth. The pair on a group is a field that does not apply:
`draw` ignores it, the published schema refuses it on a group as it already
refuses `hatch` and `accent` there, and the checker never sweeps a group's
own box, while members' swept boxes still count against the group's flat
frame.

React needs nothing: `hops` never became a `PenSketch` prop (its props are
`animate`, `diagram`, `seed`, `theme`), so the precedent is that draw options
are not react surface, and per-node fields flow through `diagram` untouched.

## D2. The geometry: one silhouette algorithm, three shapes

The extrusion vector is `(d, -DEPTH_RISE * d)` — up-right, light fixed
top-left like every other aesthetic in the system. `DEPTH_RISE = 0.75` and
`DEPTH = 12` are named exports in `constants.ts`; the ratio is an aesthetic
constant and not runtime-configurable, the magnitude is data.

Every pen shape is already emitted as an outline polyline. A segment carries a
face exactly when its outward normal dots positive with the extrusion vector.
The facing chain is offset by the vector and drawn as **one** polyline between
the two silhouette points, plus the two connectors — all ordinary double-pass
strokes, no second way of drawing. Shading: the strip swept by the contiguous facing sub-chain whose outward
normals have a **positive x component** is hatched muted at `HATCH_GAP`
through the clip arm — one call over one region, which the goldens will
freeze, so it is stated: not one hatch per quad. On a box this degenerates
to:

| face | drawn (normal · (1, -.75) > 0) | shaded (normal.x > 0) |
|---|---|---|
| top, normal (0,-1) | yes (.75) | no |
| right, normal (1,0) | yes (1) | yes |
| bottom, left | no | — |

which is exactly the slab the five hero figures shipped. A diamond shades
both right faces only when taller than 0.75 of its width; the common wide
diamond has one facing run wrapping its top seam and one shaded face, which
the wrap test pins. A pill's ideal outline (arcPoints at full radii, denser
than 26 chords past ~215 px wide) resolves under the same rule with no case
of its own. Convex outlines only, which is every shape the pen has. The
winding is read off the outline's signed area rather than assumed, so a
mirrored dimension extrudes outward like any other — and a zero-area
outline has no winding, no outward, and takes no faces at all.

The front face keeps everything it has today: wash, `hatch: true` shading,
label. Within the node phase the hand order is wash, front outline, faces,
face shading, the front's own `hatch: true`, label — so an animated reveal
raises each slab whole. The phase
order in "Diagram render order is normative" does not move.

## D3. Anchors move to the silhouette

An anchor on an extruded side moves by the full extrusion vector — the flat
anchor plus `E`: `t` to `(x + w/2 + d, y - .75d)`, `r` to
`(x + w + d, y + h/2 - .75d)`. One rule, both sides, and it lands on ink for
all three shapes: the box's back-edge midpoint, the diamond's offset apex,
the pill's offset arc to the sampling tolerance flat anchors already carry.
`l` and `b` sit on the front plane and do not move. Without this, every
left-to-right diagram self-occludes — hero-1's spine arrows had to be
hand-routed around exactly this. `anchor` reports the same points `draw`
uses, and the checker walks the same ones.

## D4. Determinism

When extrusion is off — for the diagram and every node — the depth path
draws nothing and consumes **zero** rng values, so existing output is
byte-identical and the parity goldens stand untouched. That is the same
contract braces and `arc` shipped under, and it gets the same scenario.
Turning extrusion **on** reshuffles the seeded jitter downstream of each
node: same seed, different wobble. Inherent, documented, not fixed.

## D5. The reference stays frozen

The owner's first answer ("A: the reference gains depth") was taken on an
incomplete framing and was re-decided on 2026-08-24. The core spec already
legislates this case: "A primitive the port adds where the reference has
none ... SHALL be assembled from those same passes rather than from a second
way of drawing, and `reference/renderer.html` SHALL NOT be edited to acquire
it: it is the ground truth the port is measured against, and a target that
moves measures nothing." `arc` is the ratified precedent; depth is the same
shape of addition, one level up: not a new pen member but new behavior
assembled from normed members. Fidelity flows through `stroke` and `hatch`;
unit tests pin the face geometry; the flat-diagram scenario pins parity.

## D6. The checker measures the sweep

An extruded node's footprint is the swept box
`(x, y - .75d, w + d, h + .75d)`. Every rule that measures a node against a
box uses it; the sweep stands for the faces, which are not modeled
stroke-by-stroke. `check` accepts the same options pair and reads the same
node fields. The motivating defect is concrete: hero-5's TOOL SCHEMA box
ended at x = 1190 in a 1200-wide viewBox, its face reached 1202, the render
clipped it, and the owner caught it by eye a day before this design was
written. `out-of-bounds` over the swept box catches it mechanically.

## D7. The byte cost, measured, and the two raises taken

Measured with `npm run size` (min+gzip). "Primitive" is task 1.1 as landed;
"rehearsal" is the whole core-side surface — draw's pair and its resolution,
the moved anchors, the validation rule, the checker's sweep — built on top of
it to be priced and reverted after the numbers were read.

| entry | before | primitive | rehearsal | budget |
|---|---|---|---|---|
| `@pensketch/core` | 4381 | 4734 | 4882 | 5120, unmoved |
| `@pensketch/core/check` | 3391 | 3391 | 3500 | **3648, from 3520** |
| `@pensketch/core/server` | 4379 | 4727 | 4868 | **4992, from 4480** |
| `@pensketch/react` | 519 | 519 | 519 | 2048, unmoved |
| `@pensketch/animation` | 663 | 663 | 663 | 768, unmoved |

The raises follow the house arithmetic — measured need plus 100 B of gzip
headroom, taken up to the next multiple of 64: 4868 + 100 = 4968 → 4992,
and 3500 + 100 = 3600 → 3648. `./check` moves although 3500 fits 3520: that
20 B margin is measured over a rehearsal of groups that had not landed —
over an estimate, not over code — and the requirement's one step means the
raise rides the same decision as the server's or waits to be taken at a
failing gate, which is forbidden. One step for the whole change: if groups
2–3 land materially over their rehearsal, the arithmetic was wrong and the
number is re-decided with the reason recorded where it is declared, not
nudged.

What the rehearsal contained, reconstructed (T-52) — the bytes themselves
are unrecoverable, which repeats the measurement-outlives-its-prototype
failure and is recorded as such: in `draw`, the options pair, per-node
resolution through an `edgeDepth` helper at the edge call sites, a minimal
validation throw, `anchor` taking a resolved depth and shifting `t`/`r`,
and the pair forwarded into the shape options; in `check`, one swept-node
map at entry, group nodes excluded, standing in for every box rule
wholesale. NOT in the rehearsal: the winding normalization T-51 later
landed (+38 core, +34 server, measured), T-56's label-rule split, and
per-rule anchor walks — the group 2 and 3 gates are the re-measurement,
and the tripwire above is armed.

Decision taken under the owner's session delegation of 2026-08-25. The
budget commit precedes the first commit that needs the room, so no commit in
this change's history holds a red size gate. (An earlier draft of this
design misquoted the server budget as 4300 — the number the spec carried
before `order`; the figure this change found enforced and moved from is
4480.)

## D8. The constants, calibrated at both ends

`DEPTH = 12` at `DEPTH_RISE = 0.75`, frozen after rendering both ends
(2026-08-25, via the standalone figure renderer against the built tree).
On a **box** the slab reads at hero scale (1200 × 600, 60-90 px nodes) and
at small scale (700 × 150, 40 px nodes) alike; depth 8 at the small end
reads lighter but 12 is still clean, so one default serves and the value
stays data for anyone who wants less.

The other two shapes calibrate differently, and the record is the point:

- A **pill**'s geometry is correct and reads as a proper coin — at depth
  proportional to the shape (30-45 on a 220 × 90 pill). At the default 12
  the offset chain hugs the whole upper arc a stroke-width away and reads
  as a scribbled double outline, not depth.
- A **diamond**'s faces are slivers at every probed depth (12, 24, 36):
  its edges dot weakly against the extrusion vector, so the strip reads as
  a folded corner. Honest rhomboid geometry, least convincing of the three.

The probes, recorded so the renders can be regenerated and rejudged
(`content/tools/figure.mjs`, scratch spec, seeds 71/73/79): hero scale
1200 × 600 — rect 220 × 80, pill 220 × 90, diamond 160 × 120, all d = 12;
small scale 700 × 150 — rect 140 × 40, pill 140 × 40, diamond 80 × 60 at
d = 12 and d = 8; proportional — pill 220 × 90 at d = 30 and 45, diamond
160 × 120 at d = 24 and 36. The renders go in front of the owner at the
group boundary.

Decision under the owner's session delegation: the geometry ships for all
three shapes as the delta states, the default stays box-calibrated, and the
per-shape guidance lands in the field tables at task 5.1 — a box extrudes
at any scale, a pill wants a depth near a third of its height, a diamond
prefers flat: the probes support nothing stronger. Two refinements were considered and NOT
taken, each a constant aimed at one probe's failure: thresholding the
facing test to kill sliver faces, and per-shape default scaling. If either
is wanted it is a deliberate follow-up with these renders as evidence.
