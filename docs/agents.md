# pensketch for machine callers

Reference for generating pensketch diagrams programmatically — an agent, a
script, anything writing diagram data without a person watching the result.

This is **product documentation for callers**, not instructions for working on
this repository. For that, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## What it is

`draw(svg, diagram, options)` renders a diagram — a plain object of nodes,
edges, braces and notes — as hand-sketched SVG. The wobble comes from a seeded PRNG,
so the same data and seed produce the same bytes every time.

```js
import { draw } from '@pensketch/core';
draw(document.getElementById('flow'), diagram, { seed: 7 });
```

## The seven things that will catch you out

**1. Nothing is laid out for you.** Every `x`, `y`, `w`, `h` and waypoint is
yours. There is no autolayout, no autorouting, no "make this fit". This is a
permanent design decision, not a missing feature.

**2. Text is never measured, so a box never grows to fit its label.** If a
label is too wide it simply overflows. Estimate width as:

```
width ≈ text.length × fontSize × 0.55
```

That factor was measured over this project's own labels in the documented
handwriting stack: mean 0.462, max 0.515. 0.55 over-states slightly, which is
the safe direction. All-capitals text runs near 0.99 and will overflow sooner
than the estimate suggests.

`size` shrinks the text and never the box, so it answers one question only: a
label `check` reports as `text-overflow` that cannot be shortened or given a
wider box. Leave it at the default until the checker names a node, then set it
on the node it named.

**3. A label sitting near a connector will be drawn through.** Labels are
positioned by hand via `lx`/`ly`, and **`ly` is the text's vertical centre**,
not its baseline. The drawn line also wanders from the ideal path by up to
`AMP / 2` = 1.3 px, and the stroke is 1.6 px wide. So a 13.5 px label needs
its centre roughly **13 px** clear of any segment. Nine is not enough — that
mistake shipped in this repository's own examples and put lines through three
labels.

When space is tight, put the text in the box instead of beside the arrow.

**4. A self-transition names the same side twice.** An edge whose `from` and
`to` are both `['s', 'r']` loops off that node's right side; `out` and `span`
size it. Naming the same node with two *different* sides throws — a loop hangs
off one side, and a corner loop is a different shape. Those three fields settle
the whole of its path, so a non-empty `via`, or a `bow`, on one throws as well.

This trap used to say the opposite, and it is the one most likely to be
remembered wrongly. Until this version an edge joined two *different* nodes, a
self-transition could not be stated in data at all, and the way round it was a
`raw` callback drawing the arc by hand — which is where this repository's own
examples drew theirs. If that is the rule you learned, the loop has moved: the
callback comes out, and what replaces it is the same node and the same side
named twice.

**5. `via` points are used exactly as given, in order.** The arrow walks the
legs you describe and nothing is inferred. Orthogonal routing is three points
you supply, not a mode you switch on. A path is described once: `via` together
with `bow` throws, on an edge and on a note pointer alike, rather than one of
them being quietly dropped. An empty array names no corner and describes
nothing, so it is accepted everywhere — write the field always and fill it
sometimes if that is easier to generate.

**6. Draw order is part of the output.** Phases run `nodes` where
`shape === 'group'` → `edges` → the remaining `nodes` → `braces` → `notes` →
`raw`, each array in its own order. Because that is also the order the seeded
sequence is consumed in, **reordering an array changes the rendered bytes**. It
is the z-order too: groups sit behind everything, and a brace is drawn over
what it spans and under the note that explains it. `braces` is new in this
version; a caller who learned the list without it has the rest in the right
places.

**7. `raw` cannot be JSON.** It holds functions. Over any interface that
carries data rather than code — a file, an MCP tool — it is unavailable, and
the JSON Schema rejects it.

It is the escape hatch for whatever the data model still has no word for, and
that list is shorter than it was: the self-transition and the curved connector
have both come out of it. Reach for `raw` when the drawing needs something no
field describes — not because a shape looks unusual.

## Types

```ts
type Point = [number, number];
type Side  = 't' | 'b' | 'l' | 'r';   // top, bottom, left, right edge midpoint

type DiagramNode =
  | { id: string; x: number; y: number; w: number; h: number;
      shape: 'group'; lines: string[] }          // lines REQUIRED: a group is titled
                           // and `shape` REQUIRED: it is the only thing that
                           // makes a group a group. Omit it and you get a box
                           // over your members, valid and silent
  | { id: string; x: number; y: number; w: number; h: number;
      shape?: 'box' | 'pill' | 'diamond';  // default 'box'. Omit it: a box is
                           // what most nodes are, and the bytes are identical
      lines?: string[];    // omit for an unlabelled shape
      size?: number;       // label font px, default 13.5
      accent?: boolean;    // stroke in --ps-pen instead of --ps-ink
      hatch?: boolean;     // diagonal shading inside the outline, inset 4px
      extrude?: boolean;   // draw it as a slab. The node's own flag wins over
                           // the diagram-wide one either way, so `false`
                           // flattens one node in an extruded diagram
      depth?: number };    // how deep the slab stands, px, default 12. A shape
                           // too small to carry a face resolves flat

interface DiagramEdge {
  from: [string, Side];    // node id + which side to leave
  to:   [string, Side];    // same node and same side = a self-transition
  out?: number;            // loop only: how far it projects, default 30
  span?: number;           // loop only: how far apart its anchors sit, default 40
  via?: Point[];           // corners, used verbatim; never with bow, never on a
                           // loop, but [] is accepted anywhere
  bow?: number;            // px off the straight line, right of travel positive
  dotted?: boolean;        // dashes it and recolours it to --ps-accent
  hop?: boolean;           // this one goes over: the line it crosses is broken
                           // where they meet, and this one runs through. Only a
                           // real crossing counts - arrows sharing an anchor, or
                           // drawn along one another, are left whole
  label?: string;          // one line; REQUIRES lx and ly
  lx?: number; ly?: number;
  anchor?: 'start' | 'middle' | 'end';   // default 'middle'
}

interface DiagramBrace {   // a span marked and named, always --ps-pen
  from: Point; to: Point;  // the span, in your own coordinates
  depth?: number;          // px from the midpoint to the tip, right of travel
                           // positive, default 26; past half the span plus 13
                           // the arms overshoot the span's own two ends
  kind?: 'curly' | 'square';   // default 'curly'; 'square' is a bracket
  lines?: string[];        // REQUIRES lx and ly, as an edge's label does
  lx?: number; ly?: number;
  anchor?: 'start' | 'middle' | 'end';   // default 'start'
}

interface DiagramNote {    // free-standing annotation, always --ps-accent
  x: number; y: number;    // y is the vertical centre of the block
  lines: string[];
  anchor?: 'start' | 'middle' | 'end';   // default 'start'
  arrowFrom?: Point; via?: Point[]; arrowTo?: Point;   // arrow needs both ends
  bow?: number;            // px off the straight line, right of travel positive;
                           // never with a non-empty via, as on an edge
}

interface Diagram {
  nodes?: DiagramNode[]; edges?: DiagramEdge[]; braces?: DiagramBrace[];
  notes?: DiagramNote[]; raw?: Array<(pen: Pen) => void>;
}

draw(svg: SVGSVGElement, diagram: Diagram, options?: {
  seed?: number;              // default 1 — picks which drawing you get
  hops?: boolean;             // default false — every arrow goes over the ones
                              // it crosses. An edge's own `hop` wins either way,
                              // so `hop: false` opts one arrow out
  extrude?: boolean;          // default false. Draw every node as a slab; a
                              // node's own `extrude` wins either way, and a
                              // group never extrudes whatever it carries
  depth?: number;             // how deep, px, for every extruded node carrying
                              // no depth of its own. Default 12
  order?: boolean;            // default false — stamp every element with how far
                              // through the drawing it is, so it can be animated
  theme?: Partial<Theme>;
  label?: string;             // sets role="img" + aria-label
}): void;
```

A [JSON Schema](../packages/core/schema/diagram.schema.json) for the data half
ships with the package, so you validate against the version installed rather
than a copy that has drifted:

```js
import schema from '@pensketch/core/schema.json' with { type: 'json' };
```

For a validator that wants a path — or an editor `$schema` reference — it is
`node_modules/@pensketch/core/schema/diagram.schema.json`.

## Numbers worth designing around

| | value | |
|---|---|---|
| `SIZE` | 13.5 | default label font px |
| `TITLE_SIZE` | 14 | group title, not overridable |
| `EDGE_SIZE` | 12.5 | edge label |
| `NOTE_SIZE` | 13 | note text |
| `LINE_H` | 1.28 | line spacing, × font size |
| `WIDTH` | 1.6 | stroke width |
| `AMP` | 2.6 | jitter amplitude — a point wanders ±1.3 |
| `OVERSHOOT` | 4 | how far box corners overrun |
| `HATCH_INSET` | 4 | hatching inset from the node's outline |
| `DEPTH` | 12 | how deep an extruded node stands, when `depth` is not given |
| `DEPTH_RISE` | 0.75 | how far a slab rises per px of depth, not overridable |
| `HOP_GAP` | 10 | the break left in a line where another crosses over it |
| `LOOP_OUT` | 30 | how far a self-transition projects, when `out` is not given |
| `LOOP_SPAN` | 40 | how far apart its two anchors sit, when `span` is not given |
| `BRACE_DEPTH` | 26 | how far a brace's tip stands off its span, when `depth` is not given |
| `TITLE_DX`/`TITLE_DY` | 14 / 18 | group title offset from its corner |
| `SEED` | 1 | default seed |

All 42 are exported as `constants`.

Proportions that read well, from this project's own diagrams: a labelled box
about **150 × 46**, rows about **80** apart, a group title needing about **30 px**
of clear space at the top of its box.

A self-transition is sized to sit inside those. `span` 40 fits within the 46 a
box is tall, so a loop on a left or right side keeps both anchors on the side
rather than past its corners, and `out` 30 fits the roughly 34 px of gap that
rows 80 apart leave. Change them together: `out` near three quarters of `span`
reads as a loop, much less flattens it into a dome, and much more closes it
into a spike growing out of the node's outline. Nothing reports either — it is
the one number here that no rule can check for you.

## Giving a diagram depth

Two fields stand a drawing up into slabs: `extrude` and `depth`, on `draw`'s
options for the whole diagram and on any drawn node for itself. A brace's
`depth` is a different field with a different meaning, the tip's offset from
its span, and nothing extrudes it.

```js
// every node a slab 12 deep, except the two that say otherwise
draw(svg, {
  nodes: [
    { id: 'queue', shape: 'box',     x: 40,  y: 40, w: 150, h: 46, lines: ['queue'] },
    // a third of its height: at the default 12 a pill reads as a double outline
    { id: 'done',  shape: 'pill',    x: 240, y: 40, w: 150, h: 46, lines: ['done'], depth: 15 },
    // a diamond reads as a folded corner at any depth, so this one stays flat
    { id: 'ok',    shape: 'diamond', x: 440, y: 30, w: 150, h: 66, lines: ['ok?'], extrude: false },
  ],
  edges: [
    { from: ['queue', 'r'], to: ['done', 'l'] },
    // `ok` gets one too, or `check` warns `orphan-node` about it - which is
    // the point of running `check` on the examples you copy from
    { from: ['done', 'r'], to: ['ok', 'l'] },
  ],
}, { extrude: true, seed: 7 });
```

Both resolve by the `hop` idiom exactly: `node.extrude ?? options.extrude ??
false` for whether, `node.depth ?? options.depth ?? DEPTH` for how much. The
per-node value cuts both ways, so `extrude: true` raises one node out of a
flat diagram and `extrude: false` flattens one in an extruded diagram.

A shape of depth `d` is redrawn offset by `(d, -0.75 d)`, up and to the right,
joined to its front outline and ribbed at each corner in between; every face
that descends the screen is hatched, so a box keeps a lit top face over a
hatched right one and a pill's whole band is shaded. The light is fixed
top-left, as everywhere else here: that 0.75 is `DEPTH_RISE`, it is a fixed
aesthetic constant, and no option moves it. The angle is the look; the
magnitude is your data.

**A group never extrudes.** `draw` ignores the pair on a group, and the
published schema refuses it there, as it already refuses `hatch` and `accent`.

**Per shape**, calibrated on renders at 1200 × 600 and at 700 × 150: a **box**
reads as a slab at any scale. A **pill** wants a depth near a third of its
height to read as a coin, and at the default 12 it reads as a double outline.
A **diamond** reads as a folded corner at every depth probed, so prefer it
flat.

**A shape too small to carry a face resolves flat.** A pill draws faces once
its *larger* dimension reaches `3 × ARC_MIN_CHORD / π` = **11.4592 px**: a
1 × 11.46 pill draws them, an 11.45 × 11.45 pill does not. "Under 12 px in
both dimensions" is the shorthand, not the rule, and it is false across
[11.4592, 12). A box and a diamond carry faces at every non-zero size. This is
resolution and not validation: the pair is read, nothing throws, no faces are
drawn, and the anchors do not move.

**Anchors move.** When a node extrudes, `t` and `r` move by the whole
extrusion vector, so an edge attaches to the silhouette rather than to the
front box; `l` and `b` stay where they were. In the diagram above the
connector leaves `queue` at (202, 54) rather than at the flat (190, 63).
What moves is the screen side, not the name: a node written with a negative
`w` or `h` draws the same picture and moves the same points, so with `w < 0`
the side named `l` — facing screen-right — moves and `r` does not, and with
`h < 0` named `b` moves and `t` does not.
`anchor(node, side, depth)` applies the depth it is handed and never resolves
one.

**A bad depth is refused where it is read.** `draw` throws before it draws
anything: on the options `depth` whenever the diagram-wide `extrude` is on,
and on the depth every extruded node asks for,
`node.depth ?? options.depth ?? DEPTH`, an inherited options value included.
That is the number the pair names, not the one resolution yields: a shape too
small to carry a face resolves flat and its depth is judged all the same, so a
10 x 8 pill at `depth: 0` throws though it would have drawn flat either way. A `depth` nothing reads is ignored. A `pen` driven by hand throws on
none of them: an absent, zero, negative or non-finite depth draws no faces,
consumes nothing from the seeded sequence, and renders bytes identical to the
call that asked for no depth at all. `check` reports what `draw` throws on, in
the same words, as `undrawable-depth`.

**The cost is linear and nothing bounds it.** About **84 B per px** of depth
(least squares over depths 100 to 1000 on one 150 × 46 box at seed 7), on top
of a fixed **4,558 B** for the faces themselves, which is what the markup
grows by as the depth approaches nought. One box at `depth: 1000` renders 90 kB. No rule caps a depth, and `check` reads its form
rather than its price.

## Errors you will hit, and what they mean

| message | cause |
|---|---|
| `edge N names unknown node "x" in from; known ids are …` | typo in `from`/`to`; the message lists the real ids |
| `two nodes share the id "x"` | ids must be unique — edges name nodes by id |
| `node "x" has unknown shape "y"` | one of `group`, `box`, `pill`, `diamond` — or leave it out, which is a box |
| `edge N has label "…" but lx and ly are not both numbers` | a label is positioned by hand, because text is never measured |
| `edge N names node "x" at both ends but sides "t" and "r"` | a self-transition attaches to one side; name the same side in `from` and `to` |
| `edge N carries bow; its path is already described by via` | a path is described once — drop whichever of the two the arrow is not to take. A note pointer carrying both says `note N` and means the same |
| `edge N carries via; its path is already described by the side it hangs off, out and span` | a self-transition's path is settled by those three, so a corner to turn at contradicts it. `bow` on one is refused the same way and says so |
| `brace N has lines but lx and ly are not both numbers` | the same rule an edge label is held to, for the same reason: nothing measures text, so nothing can place it for you |
| `the options depth is …; a depth is a positive finite number of px` | the diagram-wide `depth`, read whenever the diagram-wide `extrude` is on, whether or not any node goes on to use it |
| `node "x" has depth …; a depth is a positive finite number of px` | that node's own `depth`, where the node extrudes. A node carrying none of its own and inheriting a bad one says `node "x" extrudes at the options depth …` instead, and names the field to fix |

`draw` stops at the first defect it meets, and it is not a transaction. The
element is emptied when drawing starts and filled phase by phase, so a throw
leaves on the page whatever had been drawn before it. A note refused for
carrying `bow` with a non-empty `via` leaves every group, edge and node above
it standing — and its own text too, because a note's lines are drawn before
its pointer is looked at. Not every refusal lands that late, though nothing
about the message says which: the duplicate id and both depth checks are
raised before the first stroke, so a diagram stopped by one of those leaves
the element empty rather than half-drawn. Fix and redraw. Do not read an
element after a throw as though it were empty.

## A complete example

An incident, drawn at the stage it has reached — five stages, a decision that
forks, a self-transition at the defaults, a reverse bowed clear of the outline
it would otherwise be drawn along, and a brace over the pair of things that
happen when it is over. It is the whole of what
[`examples/react/`](../examples/react/) draws, at one of the five stages its
control can put it in; the page around it computes the `accent`, the `hatch`
and the `dotted` flags from where the incident has got to, and nothing else.

Here `dotted` marks what has not happened — the three steps still ahead, and
the escalation and the failed fix, which are drawn at every stage because they
are always possible. `hatch` marks what is behind it. Nothing in the renderer
attaches either meaning; a diagram decides for itself what its dashes and its
shading are for, and this one says so out loud in the file it lives in.

```js
const incident = {
  nodes: [
    // hatch shades inside the outline the shape is drawn with, inset 4px, so
    // a diamond takes it on the same terms as a box does
    { id: 'paged',    shape: 'box',     x: 40,  y: 110, w: 150, h: 46, lines: ['paged'],    hatch: true },
    { id: 'triage',   shape: 'box',     x: 230, y: 110, w: 150, h: 46, lines: ['triage'],   hatch: true },
    { id: 'mitigate', shape: 'box',     x: 420, y: 110, w: 150, h: 46, lines: ['mitigate'], accent: true },
    // taller than the boxes and centred on the same line, so its left and
    // right anchors sit where theirs do
    { id: 'fixed',    shape: 'diamond', x: 610, y: 95,  w: 150, h: 76, lines: ['fixed?'] },
    { id: 'clear',    shape: 'pill',    x: 800, y: 40,  w: 150, h: 46, lines: ['all clear'] },
    { id: 'post',     shape: 'box',     x: 800, y: 180, w: 150, h: 46, lines: ['postmortem'] },
  ],
  edges: [
    { from: ['paged', 'r'],    to: ['triage', 'l'] },
    { from: ['triage', 'r'],   to: ['mitigate', 'l'] },
    { from: ['mitigate', 'r'], to: ['fixed', 'l'], dotted: true },

    // the fork. Both leave the same anchor and turn at the same corner, so
    // their first 20px is one line. `edge-overlap` reports a shared run of
    // 40px or more, and 20 is deliberately under it: a fork is how a
    // decision is drawn, and the threshold is calibrated to leave it alone
    { from: ['fixed', 'r'], to: ['clear', 'l'], via: [[780, 133], [780, 63]],
      label: 'yes', lx: 766, ly: 88, anchor: 'end', dotted: true },
    { from: ['fixed', 'r'], to: ['post', 'l'],  via: [[780, 133], [780, 203]], dotted: true },

    // a self-transition: the same node and the same side named twice. span 40
    // puts both anchors well inside the 150 px side it hangs off, and out 30
    // projects into empty space below the row
    { from: ['triage', 'b'], to: ['triage', 'b'],
      dotted: true, label: 'escalate', lx: 305, ly: 204 },

    // the way back when the answer is no. Straight, this arrow would run along
    // the bottom edge of the box it arrives at and vanish into it. No rule
    // compares an edge with a node's outline: with the bow taken off, `check`
    // finds no fault at all
    { from: ['fixed', 'b'], to: ['mitigate', 'b'], bow: -20,
      dotted: true, label: 'no', lx: 588, ly: 210 },
  ],
  braces: [
    // Vertical, which is what lets it be curly. A brace turns its corners at
    // one fixed radius and its tip at another, so widening one grows nothing
    // but the two straight runs between them and a wide one reads as an
    // underline with a bump. Down the side of the stacked pair this one is
    // 186 px, near the 150-220 the rest of this project's braces are drawn at.
    //
    // depth is measured to the right of travel, and this span travels top to
    // bottom, so right of travel is screen *left*: a positive depth here would
    // point the tip back into the pair and leave the arms facing the label
    { from: [970, 40], to: [970, 226], depth: -26,
      lines: ['when it', 'is over'], lx: 1006, ly: 133, anchor: 'start' },
  ],
};
```

Drawn into `viewBox="0 0 1110 270"`. Three more, complete and runnable, in
[`examples/`](../examples/): a CI pipeline (`vanilla/`), an order lifecycle
whose retry is a self-transition (`custom-pen/`), and an ATM with a
self-transition at the defaults and a transition and its reverse bowed apart
(`state-machine/`).

## Checking your work

You cannot see the result, so do not rely on having looked at it. Three
things look for you, in increasing order of what they can tell:

- **`draw` throws** on unknown ids, duplicate ids, unknown shapes, a label
  without coordinates — a brace's `lines` counts — a self-transition naming two
  different sides, a depth that gets read and is not a positive finite number,
  and a path described twice: `bow` with `via`, or either on a
  self-transition. It stops at the first one.
- **The JSON Schema** rejects malformed data, including misspelled keys.
- **`check` finds the rest** — every trap in the list above — and reports all
  of them at once, without drawing anything:

```js
import { check } from '@pensketch/core/check';

const findings = check(diagram, { viewBox: [0, 0, 880, 340] });
// [{ rule, severity, message, at: [x, y], subjects, estimated? }, ...]
```

| rule | fires when | default |
|---|---|---|
| `duplicate-id` | two nodes share an `id` | **error** |
| `node-overlap` | two nodes' ink shares area: their boxes, or the boxes their slabs sweep | **error** |
| `out-of-bounds` | a box, a point along the line an edge or a brace draws, or a label lies outside the `viewBox` | **error** |
| `undrawable-depth` | a depth that gets read is not a positive finite number | **error** |
| `label-collision` | a label sits within `clearance` (default 4) of a connector or a brace | warning |
| `text-overflow` | the widest line exceeds `w - 2 × padding` (default 8) | warning |
| `group-escape` | a node is half inside a group | warning |
| `orphan-node` | no edge names a node | warning |
| `edge-overlap` | two edges draw as one line: the whole way, or along a run of 40px out of a shared anchor | warning |
| `text-collision` | two pieces of text — a node label, a group title, an edge or brace label, a note — have overlapping boxes | warning |

The three are not a ladder you can climb halfway. **A clean `check` is not a
promise that `draw` will accept the diagram**: they answer different
questions, and the first list above is the one `check` has no rule for. A
diagram with an edge label and no `lx`/`ly` reports "No findings." and is then
refused by the renderer. `render_diagram` returns findings beside its markup,
so a clean report there *does* mean it drew — but a refusal returns the
message alone, with no findings at all.

`out-of-bounds` measures the line that gets drawn rather than the straight run
between the anchors: a loop and a bow are sampled, so a curve that leaves the
frame is caught where it leaves rather than passing on two anchors that are
both inside. Its own two ends are left out, so that a node already reported as
reaching outside the frame is not reported again once per edge attached to it.
That has a cost, and it falls on one shape: a loop whose `span` is wider than
the side it hangs off puts its anchors past the node's corners, so one can
leave the frame while the node is wholly inside it and nothing says so. And it
names the first point outside rather than every one, because a curve leaves in
a run and ten findings about one bulge are one finding.

Where a node extrudes, every rule that measures its **ink** measures the box
its slab sweeps, `(x, y - 0.75d, w + d, h + 0.75d)`: `node-overlap`,
`out-of-bounds` and `group-escape` all read it, and every rule that walks an
edge walks it from the moved anchor, so it follows the line `draw` will
attach. That rectangle stands for the faces rather than tracing them stroke by
stroke, so a shape that does not fill its box is reported further apart than
its ink is. Two 100 × 100 diamonds do that flat already: the worst offset
`node-overlap` still fires at is (99, -99), where **69 px** separates the two
outlines. Depth adds the sweep resolved along that diagonal,
`(d + 0.75d) / √2` = **1.237 d**, so at `depth: 40` the worst reported offset
is (139, -129) and the gap is **119 px**. Distances between the ideal
outlines, which is what a caller can recompute; the drawn strokes wander
`INFLATE` either side of them. The
two label rules keep the **front** box on purpose, because a label sits on the
front face and no slab carries it anywhere: measuring `text-overflow` or
`text-collision` in the swept box would hand a label `d` px of room no glyph
can use.

`undrawable-depth` reports what `draw` would refuse rather than what it would
draw, in the same words the throw uses, as `duplicate-id` does. It reads a
depth's form and never its cost: `check` passes `depth: 20000` on a one-box
diagram in **0.46 ms**, where `draw` on the same diagram takes **38 ms**,
emits **1.7 MB** of markup and allocates **34 MB** of heap.

Findings arrive sorted by severity, then rule, then position, so the array is
stable enough to snapshot. `at` is a point in the diagram's own coordinates,
the place to look. One kind of finding is about the **call** rather than about
the drawing: it names `options` among its subjects and reports the origin as
its `at`, because an option is nowhere in the picture to go and look at.
`undrawable-depth` on the options `depth` is the only one today. Anything
resting on the width estimate carries `estimated: true`.

What it does not know about: no rule compares an edge with a node's outline,
so an arrow drawn straight through a box, or along the edge of one, is not
reported at all — the worked example above carries a `bow` for exactly that
reason and `check` is silent without it. A group's border and a note's arrow
are neither edges nor braces, so `label-collision` does not measure against
either; `text-collision` covers the text they carry, not the lines they draw.
`raw` is invisible to it.
And it never moves anything — there is no autolayout here either.

`edge-overlap` has limits of its own worth knowing before you rely on it. It
measures a shared run only for two edges that share exactly one anchor, so two
connectors routed down the same corridor without sharing an end are not
reported unless they coincide the whole way: proximity alone cannot tell that
pair from a shallow crossing, which stays inside the same distance for an
arbitrarily long run. The 40px threshold is in diagram units while the distance
that counts as "one line" is a fixed 4.2px of ink, so the rule is not
scale-free — a diagram drawn at twice these proportions reports forks that this
one leaves alone. Two edges leaving one anchor at less than about 6° are
reported at any scale, because a band that thin takes that long to escape. And
the length in the message is the path's own arc length, so a connector that
doubles back on itself inside the band has that stretch counted twice.

## Theming

Colours are emitted as `var(--ps-*, fallback)`, so a page restyles a drawn
diagram by redefining variables: `--ps-ink`, `--ps-pen`, `--ps-accent`,
`--ps-muted`, `--ps-wash`. The packages ship no CSS. The sketch look also
depends on a handwriting font being applied to `svg text` by the page.

## Making a diagram draw itself

One boolean is the renderer's whole part in it:

```js
draw(svg, diagram, { seed: 7, order: true });
```

Every element then carries `--ps-i`, how far through the drawing it is, as a
fraction in `[0, 1)`. The number counts in the order a hand would draw in —
group frames, then node shapes, then connectors, then braces, notes and `raw`,
and then every piece of text whatever phase drew it — which is **not** the
order the document is in. Nothing is reordered: the z-order, the seeded
sequence and the elements themselves are what they were, and with `order`
unset not one byte differs from the drawing you would have had.

Every path carrying no `stroke-dasharray` also gains `pathLength="1"`, which
normalises it so a single keyframe draws a 400 px connector and a 12 px
arrowhead barb at the same rate. A dashed path is deliberately left alone:
`pathLength` rescales every distance along a path, `stroke-dasharray` among
them, so a normalised dotted line renders solid. A `pen` driven by hand is
uninstrumented — the index is a property of `draw`'s phases, and a pen has
none.

The motion itself is a separate package, `@pensketch/animation`, peered on
core. It is CSS: nothing of it runs while the drawing is drawing.

```js
import { draw } from '@pensketch/core';
import { animate } from '@pensketch/animation';

draw(svg, diagram, { order: true });
animate(svg, { duration: 3000 });
```

`animate` inserts one `<style>` as the svg's first child and writes the timing
onto the element as custom properties. What comes back is a self-contained
`<svg>` — it draws itself inline in a page, embedded as `<img src>`, and
opened as a file, with nothing else loaded. Nothing else is added to your
element: no class, no id. The options are `duration` (the whole drawing,
default 2000) and `stroke` (any one element, default 500), both in
milliseconds, and `easing` (any CSS `<easing-function>`, default `ease-out`).
Anything left out keeps the stylesheet's own default, so the defaults have
exactly one home.

**Call it after `draw`, never before.** `draw` removes every child of the
element it fills, so a `<style>` put there first goes with them and the
diagram simply appears. For the same reason a redraw takes the stylesheet with
it and has to be animated again.

For markup rather than an element — what `renderToString` hands back —
`animateMarkup(inner, options)` returns the same rules with the same timing in
front of it. It takes and returns the *contents* of an `<svg>`, the caller
supplying the wrapper as they already do.

**How it degrades, and it is one way.** The rules are wrapped in an implicit
`@scope` block so they reach only the drawing they were put in. An engine that
does not understand `@scope` drops that block whole. An element carrying no
`--ps-i` — an older core, a `pen` drawing, a caller who did not pass `order` —
makes the `animation` shorthand invalid at computed-value time, so
`animation-name` computes to `none`. `prefers-reduced-motion: reduce` switches
it off outright. All three land in the same place on purpose: the diagram
renders **finished and still**, pixel-identical to the same diagram with no
stylesheet at all — never blank, never half-inked.
