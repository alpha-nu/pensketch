---
'@pensketch/mcp': patch
---

A fourth bundled example: an ATM as a state machine, at
`pensketch://example/atm`.

The three that were there are all flows — work moving forward through stages.
This one branches. A decision diamond splits it, the failure path is dotted
and routed back up the left margin into the box it came from, and pill
terminals mark where the card ends up. It is the shape most state machines
are, and none of the others showed it.

It also carries the lesson `raw` exists to teach, twice over. An edge joins
two *different* nodes, so "another digit, stay in awaiting PIN" cannot be said
in the data at all — it is drawn by callback, and the callback cannot cross a
JSON boundary.

Which is the other change here. Both diagrams that draw with `raw` now serve a
`rawOmitted` line saying which stroke is missing from the copy a caller
receives and why. Before this, the lifecycle example handed over a picture
with a piece removed and no way to notice; a caller reproducing it faithfully
would have found their diagram short one transition and no reason given. The
generator refuses to build if a diagram grows a `raw` without that line.
