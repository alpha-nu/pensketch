---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

A connector can be drawn as the one that goes over where two cross: the line
underneath is broken where they meet, so a reader can tell which is continuous.

**Rendered output is unchanged unless you ask for it.** `hop` and `hops` both
default to `false`, and a diagram that sets neither draws the same bytes it drew
before — every parity golden in this repository is untouched, including under
the restructure that now collects each edge's path before drawing any of them.
That restructure consumes no seeded numbers, so the order the pen is called in
is the order it always was.

Two ways to ask. `hop: true` on an edge says that edge goes over whatever it
crosses. `hops: true` in the draw options says it of every edge, and an edge's
own `hop` still wins either way — so `hop: false` opts one connector out of a
diagram-wide switch rather than being indistinguishable from leaving it off.

```js
edges: [
  { from: ['check', 'b'], to: ['rules', 't'], via: [[440, 372], [995, 372]] },
  { from: ['server', 'b'], to: ['markup', 't'], hop: true },
]
```

What moves is the *other* line. Nothing is added to the path of the edge going
over; the one underneath stops for `HOP_GAP` — 10 px — and starts again on the
far side. Where both edges of a crossing go over, the one later in `edges` wins,
so layering is a total order on the array and no geometry decides which
relationship is subordinate.

Only a real crossing counts, tested as a strict interior intersection. So a
fan-out is left whole, two connectors drawn along one another are left whole,
and a connector that merely *arrives at* another does not break it — arriving is
not crossing. Detection is a plain pairwise walk with no spatial index: measured
at 0.0017 ms on this repository's largest diagram, a tenth of a percent of the
render it already pays for.

The older convention — a bump on the line going over — is not what this does,
and cannot be. Displacing a line perpendicular to itself moves the apex *along*
whatever it crosses at a right angle, so the bump lands on the line it was meant
to bridge; and `ARC_MIN_CHORD`, which exists so the pen's own jitter cannot turn
a small arc into noise, flattens it into two chords and makes that apex a
vertex. Rendered at four sizes it reads as a junction. Seven shapes went to a
render before the break was chosen.

`check` does not model this. The path it walks is the unbroken one, so
`label-collision` can measure clearance to a stretch of line the renderer cut
away. The error is bounded by `HOP_GAP` and it is stated rather than discovered.

`@pensketch/core` grows by about 429 bytes min+gzip, to 4179. Every consumer
carries it whether or not a diagram sets `hop`: hopping is a behaviour of
`draw`, not an entry point that can be left unimported.

`@pensketch/mcp` reissues because `render_diagram` and `render_png` now accept
`hops` beside `seed`, and because the JSON Schema and the reference it serves
both describe the new field. `check_diagram` does not accept `hops` and refuses
it by name, since it would change no finding.
