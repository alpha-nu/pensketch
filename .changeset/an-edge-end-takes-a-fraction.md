---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

An edge end takes an optional third member: where along its side the anchor
sits, as a fraction. `["a", "r"]` still names the right side's midpoint —
byte-identical to every drawing already made — and `["a", "r", 0.25]` attaches
a quarter of the way along, `0` and `1` being the corners, so a corner anchor
is a fraction rather than a fifth side name. What it buys is fan-in and
fan-out: two arrows arriving at one side used to stack their heads on its
midpoint, and now each names its own point.

The fraction runs from the corner the box is written from, rides the whole
extrusion vector on a side that depth moves, and centres a self-transition's
loop — which is how two loops share one side, and why both ends must name the
same fraction. `draw` refuses anything outside `[0, 1]` naming the edge and
the end; the published schema carries the same bound, so a caller sending
JSON is refused at the boundary in the schema's own words. `check` measures
every rule from the fractional anchors, exactly as it measures from moved
ones.

`@pensketch/mcp` is named because the schema it publishes and precompiles
grew the third member, and its refusals now speak the fraction's bounds.
