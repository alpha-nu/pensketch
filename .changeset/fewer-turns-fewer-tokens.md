---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

Fewer turns, fewer tokens. Two changes aimed at what an agent pays to draw a
diagram, both measured before and after against the same scenario.

`render_diagram` now returns the layout findings beside the markup. A fix
cycle was two calls - `check_diagram`, then `render_diagram` - and is one.
The markup stays the first content block, so a caller already reading that
index is untouched; the findings are the second. They are measured on the
geometry actually rendered, `extrude` and `depth` included, or they would
describe a drawing nobody made. A diagram `draw` refuses still returns one
block carrying the message, because there is no drawing to report findings
for. `check_diagram` is unchanged and stays: it is what you call for findings
without markup, and before spending a multi-second `render_png`.

`shape` is now optional on a drawn node, and defaults to `box`. 41 of the 49
nodes in this repository's own shipped figures are boxes, and every one of
them spelled the field out - an agent generates that one token at a time. An
omitted `shape` and `shape: 'box'` produce the same bytes, proved by a test
that reverts each of the three read sites in turn.

**Nothing existing changes meaning.** Every diagram written against 0.7
renders byte for byte what it rendered. Minor rather than patch because the
type widened and a tool returns something it did not return before, not
because a caller who changes nothing sees anything move.

Measured on one scenario, three attempts: 4 turns to 3, and 745 tokens per
attempt to 350. Half of that is compact JSON, which the `diagram` description
now asks for and cannot enforce; the rest is the default. The honest half of
the headline is in the change's own `RESULTS.md` - the levers made each pass
cheaper and removed one pass, and did not make a wrong first attempt right.
