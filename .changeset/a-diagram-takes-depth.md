---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

A diagram takes depth. Two fields stand a drawing up into slabs: `extrude`
and `depth`, on `draw`'s options for the whole diagram and on any drawn node
for itself - and the per-node value cuts both ways, so an extruded diagram
can flatten one node and a flat one can raise one. A slab is the outline
redrawn offset up and to the right and joined to it, lit from the top left
with its side faces hatched, and the `t` and `r` anchors follow the ink onto
the silhouette, so a connector attaches to the slab rather than to the front
box behind it.

**A flat diagram renders byte-identically to 0.6.** With `extrude` unset and
no node asking for a depth, not one byte of the output differs - the seeded
sequence, the z-order and the elements are what they were. Minor rather than
patch because the pair exists and the output changes when it is set, not
because anything changed for a caller who leaves it alone.

`check` measures an extruded node as the box its slab sweeps, so every rule
judges the drawing the render will make rather than the flat one, and a new
`undrawable-depth` rule reports what `draw` would refuse, in the same words.

`@pensketch/mcp` at minor because all three tools - `render_diagram`,
`render_png` and `check_diagram` - accept the pair, the checker included.
