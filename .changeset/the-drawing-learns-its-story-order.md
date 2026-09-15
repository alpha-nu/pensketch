---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

`order` takes a second value. `order: 'flow'` stamps the same `--ps-i`
numbers in a different order: instead of every shape and then every
connector, the count walks the graph - a start node with its label, each
edge it leaves by, the node that edge reaches, one branch to its end before
the next - so a flowchart draws itself in the order its story runs rather
than scenery first and plot after. Group frames still count first,
annotations still count last, and nothing in the document moves: the
z-order, the seeded sequence and the bytes of `order: true` are exactly
what they were.

The walk is deterministic by construction: roots are the nodes no edge
enters and at least one leaves - a self-transition counts as leaving, not
entering - in `nodes` order; the walk is depth-first with outgoing edges in
`edges` order; an edge into a node already drawn is stamped without
re-entering it; and whatever a cycle or an island keeps from the walk joins
where its declaration falls. Same data, same numbers, no geometry in any
tie.

Over MCP, `render_diagram` takes `sequence: "flow"` beside `animate`,
refuses it by name on a still drawing as it refuses the timing arguments,
and the animated account line says which order the file draws in.
