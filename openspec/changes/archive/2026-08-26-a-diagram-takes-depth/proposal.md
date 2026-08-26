# Proposal: a-diagram-takes-depth

> Every shape can become a slab: an oblique extrusion drawn from the same
> double-pass strokes as everything else, with a hatched side face for
> shading. A boolean turns it on for a whole diagram, a number says how deep,
> and every node can override either, both ways.

## Why

**The primitive already exists; it lives in the wrong place.** The five hero
figures for the ontologies launch post (`content/ontologies/hero/hero.mjs`)
fake depth today: a `slab()` helper hand-rolled inside four separate `raw`
callbacks, because raw callbacks close over nothing and there is nowhere
lower to put it. Four copies of the same twelve lines is the tell that the
pen owes its callers a primitive. The owner directed the feature on
2026-08-23 after reviewing those figures.

**Depth is drawn, not filtered.** There is no bevel-and-emboss filter in this
system and there will not be: the hand-drawn idiom fakes depth the way a
draftsman does, with an offset outline, two connectors and hatching on the
side faces. That assembles entirely from `stroke` and `hatch`, the passes the
goldens already norm — which is what makes the feature possible without
touching the reference.

## What changes

- **The pen.** `rect`, `pill` and `diamond` accept `opts.depth`. One convex
  silhouette algorithm serves all three; a box degenerates to a top face and
  a shaded right face.
- **The renderer.** `draw` accepts `extrude?: boolean` and `depth?: number`
  beside `hops`, as the diagram-wide default; every node may carry the same
  pair and override either way, `node.extrude ?? options.extrude ?? false`,
  exactly the idiom `hop` set at `draw.ts:216`. `t` and `r` anchors move to
  the silhouette when a node is extruded. One validation rule is added for a
  `depth` that cannot be drawn.
- **The checker.** Every rule that measures a node measures the swept box,
  and anchors move as the renderer moves them. The motivating defect shipped
  in this repository the day before this proposal: hero-5's TOOL SCHEMA slab
  had its deep face clipped by the viewBox, the owner caught it by eye, and
  `check` as it stands could not have.
- **The MCP server.** `render_diagram`, `render_png` **and** `check_diagram`
  accept the pair beside `seed` — the checker takes it where it refuses
  `hops`, because depth changes findings and hops change none. The published
  schema regenerates with the node fields.
- **Docs and release.** The field tables, `docs/agents.md`, the generated
  schema and MCP resources regenerate; core takes a minor; packages exposing
  the pair raise their core dependency floor to the minor that ships it.

## What does not change

- `reference/renderer.html`. The owner re-decided this on 2026-08-24 with the
  constitution in hand: depth follows the `arc` precedent in the
  "Hand-sketch primitive fidelity" requirement — assembled from the same
  passes, the reference untouched, flat output byte-identical to the goldens.
- A diagram that extrudes nothing renders byte-identically to today: the
  depth path draws from the seeded sequence only when invoked.
- No new pen members, no new exports beyond types, no runtime-configurable
  aesthetics: the depth *value* is data, the 0.75 rise ratio is a constant.

## Decisions taken (owner, 2026-08-23/24)

1. Boolean + value pair, not a single numeric field.
2. Bare boolean defaults the value to `DEPTH = 12`.
3. Side faces are shaded, muted hatch at `HATCH_GAP`.
4. Per-node override ships in v1 and cuts both ways.
5. The reference stays frozen (supersedes the earlier "A" answer, which was
   given on an incomplete framing and is void).
6. Field names: `extrude` and `depth`.
