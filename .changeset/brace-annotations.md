---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

Braces and brackets: the second thing `raw` could draw and JSON could not.

A `braces` array marks a span and names it — what a group does, for the two
cases a rectangle cannot serve: sets that overlap, and a span you want marked
without enclosing what is inside it.

```js
braces: [
  { from: [745, 75], to: [745, 228], depth: -26,
    lines: ['one build,', 'promoted'], lx: 785, ly: 152 },
]
```

`from` and `to` are the span in your own coordinates and `depth` is how far the
tip stands off its midpoint, perpendicular to it — positive to the right of
travel, the sign convention `bow` carries, so flipping a brace to the other
side is a minus sign. `kind: 'square'` draws a bracket instead: four points and
no curve in it. `lines`, `lx`, `ly` and `anchor` are the label, with the
meaning they carry on an edge, and `draw` throws on `lines` without numeric
coordinates for the same reason it does there: nothing here measures text.

A brace and its label stroke in `--ps-pen`, the role that already carries a
group's border and a group's title.

**Output moves, and the draw order is the reason.** The phase runs between the
non-group nodes and the notes, so a brace is drawn over what it spans and under
the annotation that explains it. That order is part of the rendered bytes, so
every place that lists the phases has moved with it. A diagram with no `braces`
renders byte for byte as it did: the phase draws from the seeded sequence only
when it has something to draw.

`check` sees a brace as the shape it draws. `out-of-bounds` samples its path,
so a tip carried past the `viewBox` by its depth is reported where the straight
line between its endpoints would have sat wholly inside, and a brace's label is
reported like any other text. `label-collision` searches braces as well as
connectors — a note drawn across a brace is the same defect as a label drawn
across an edge — which means a finding now names its subject rather than an
edge index: `brace 2` where it used to be able to say only `edge 2`.

`@pensketch/mcp` accepts `braces` at its tool boundary and serves the field in
`pensketch://schema` and `pensketch://spec`.
