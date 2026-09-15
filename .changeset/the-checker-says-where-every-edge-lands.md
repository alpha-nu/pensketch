---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

`@pensketch/core/check` exports a second name. `anchors(diagram, { extrude,
depth })` returns, per edge, the two points its drawn line actually begins
and ends at - a side fraction walked, an extruded anchor carried onto the
silhouette, a self-transition's two ends spread `span` apart - and `null`
where there is no drawn line to have ends. The ends come off the same
`edgePath` every rule measures, so the numbers agree with the findings by
construction. A caller who cannot see the picture can now verify its
geometry by arithmetic instead of by faith.

Over MCP, `check_diagram` takes `anchors: true` and appends the same numbers
to its report, one line per edge in order, rounded to the two decimals the
drawing itself is serialized at; an edge with no line to resolve says so in
place, so the listing never silently renumbers. Off by default - the default
report's bytes are exactly what they were.
