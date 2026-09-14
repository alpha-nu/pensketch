---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

Two new checker rules, both warnings, both born from a probe that drew a
defective picture and got "No findings." back.

`clipped-ink` is the near-miss band of `out-of-bounds`: every finding
measures ideal geometry, but ink is jittered around it — up to half the
wobble amplitude sideways, and a box's sides overrun their corners — so a
node that stops within the pen's own reach of the frame (5.3 px, read off
the constants that set it) draws strokes the frame clips while the ideal
box reads as inside. It measures the swept box, so a slab extruding into
the band is caught too, and a node already past the frame stays
`out-of-bounds` alone.

`brace-opens-away` reads direction where every other rule reads distance:
which side a brace's tip lands on is the sign of `depth`, so one cross
product tells whether the label sits with the tip or across the span from
it — a brace opening away from its own words is geometrically valid and
visually backwards. A label on the span itself takes no side.

`RuleId` grows by two; a `default` arm that ignores unknown ids reads this
release as it read the last one. `@pensketch/mcp` is named because its
findings output changes for diagrams these rules catch.
