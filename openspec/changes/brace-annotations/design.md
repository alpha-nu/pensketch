# Design: brace-annotations

## D1 — A phase, not a field on a note

```js
braces: [
  { from: [260, 40], to: [260, 240], depth: 26,
    lines: ['the client'], lx: 300, ly: 140, anchor: 'start' },
]
```

Four shapes were considered. The other three each fail on something
measurable rather than on taste.

**A field on `DiagramNote`** reads well — a note is already
annotation-with-a-pointer — and it is the only option needing no change at the
MCP boundary. It breaks on the brace that has nothing to say. `x`, `y` and
`lines` are all required on a note, in the type and in the generated schema, so
a text-less brace would be written `{ x: 0, y: 0, lines: [], brace: {...} }`
with two meaningless numbers. Relaxing those three to optional is not free
either: it throws away the static rejection an agent gets today for writing
`line:` instead of `lines:`, in the one artefact this product ships so that a
caller who cannot see the drawing is caught before rendering.

**`shape: 'brace'`** costs four carve-outs in rules the project holds its own
diagrams to. Every brace becomes an `orphan-node`, since no edge names it. A
brace over three boxes is a `node-overlap` with all three — an **error**, so
`npm run diagrams` would go red on any example that used one. It can trip
`group-escape` by crossing a group border, and `text-overflow` if it carries
lines. It also draws in the wrong phase and makes `from: ['mybrace', 'r']`
legal nonsense.

**A `Pen` method alone** is reachable only through `raw`, which is stripped
from what the server serves. That is precisely the limitation this change
exists to lift, so shipping the fix in the form of the defect is not an
option. It would also cost the closed-surface requirement a second amendment
in as many changes.

A phase costs one thing and it is stated plainly in D2.

## D2 — What a phase costs, and why it is affordable

Adding `braces` modifies **Diagram render order is normative** — a requirement
whose whole point is that the order is part of the rendered bytes. That is the
real price, and it is paid once: the phase slots between the non-group nodes
and the notes, so a brace is drawn over what it spans and under the annotation
that explains it, and every existing phase keeps its place. A diagram with no
`braces` renders byte-identically, which is asserted rather than argued.

The other cost is measured, not guessed. A prototype of this shape — the
type, the phase, the point generation, and an `out-of-bounds` rule over the
sampled path — measured **+276 B** on `@pensketch/core/server` and **+270 B**
on `@pensketch/core/check`. Those two entries are the tight ones, and
`arc-connectors` groups 2 to 4 spend from the same budget before this change
starts. **The size gate is therefore a first-class gate here, not a formality
at release**, and if the budget will not take it, the answer is to raise a
published budget deliberately rather than to discover the breach while
shipping.

## D3 — One point list, one stroke

A brace is four quarter-arcs and two runs, and it is tempting to draw it as
six calls. It has to be one.

`pass` emits a leg's final point once, damped to 40% of the jitter amplitude,
and the path continues from it. Across two `stroke` calls the shared point is
drawn twice, independently, one of them at full amplitude — measured over 400
seeds, the two land a mean of **1.07 px** and a maximum of **2.11 px** apart,
against a stroke 1.6 px wide. At a corner that reads as hand-drawn, which is
why `rect` gets away with four independent sides and an overshoot. At a
*tangent* join, where the brace's arc meets its run, it reads as a break.

So `bracePoints` returns one array and `draw` strokes it once. Two `<path>`
elements for a whole brace, like every other primitive.

## D4 — The label is the label, in the words already used for one

`lines`, `lx`, `ly` and `anchor`, and `draw` throws if `lines` is present
without numeric coordinates — the same rule, the same message shape, as an
edge's `label`. Nothing here measures text, so a label cannot be placed
relative to the tip without inventing a size for it. A caller who wants the
text at the tip computes the tip, which is what they did to choose `depth`.

`lines` rather than a single string, because a brace spanning a column of five
rows is exactly where two lines of text want to go, and `DiagramEdge.label`'s
single string is a limitation this need not copy.

## D5 — The geometry, recorded before it is written

From the prototype, and it must reproduce these numbers exactly:

```
x extent    174.0 -> 200.0   (tip asked for at 174)
y extent    40.0 -> 240.0
tip         174.0, 140.0     (the vertical middle)
```

Twenty-four points: a quarter-arc out of each end, two runs toward the middle,
two quarter-arcs meeting at the tip. `kind: 'square'` is four points and no
arc: out, along, back. The corner radius and the default depth become named
constants, documented the way `size` is — a starting point a caller overrides,
never a value computed from anything.

`depth` is a signed perpendicular offset from the midpoint of the span, and
positive is to the right of travel, which is the convention `bow` carries in
`arc-connectors`. A caller who learned one already knows the other, and
flipping a brace to the other side of what it spans is a minus sign.

## D6 — Open, and the owner's to close

Recorded here rather than settled, because each changes what ships.

1. **Does a brace join the paths `label-collision` searches?** It should — a
   note drawn across a brace is the same defect as a label drawn across an
   edge. The obstacle is mechanical: `struckBy` returns an edge index and all
   its call sites interpolate the word "edge" into the message. Making a
   finding able to say `brace 2` is a small refactor that should be decided
   before it is discovered mid-group.
2. **The default depth**, and whether there is one at all. `out` and `span`
   in `arc-connectors` have defaults; `via` has none. A brace with no depth is
   a straight line, so a default is probably right, and 26 px is what the
   prototype used.
3. **Ink or accent.** A brace is an annotation, which argues for
   `theme.accent` with the notes. It is also structural, which argues for
   `theme.ink` with the shapes. Reversible only until it ships.
