---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

Curved connectors: a self-transition, and a bow off the straight line.

A documented impossibility is now possible. Until this release a pensketch edge
joined two *different* nodes, so "retry, stay where you are" could not be said
in data at all — the reference said so, and the way round it was a `raw`
callback drawing the arc by hand. Both of this repository's own examples did
exactly that, and neither could serve a whole picture to an agent, because
`raw` holds functions and functions do not cross a JSON boundary.

An edge naming the same node **and the same side** at both ends now draws a
loop, sized by two new fields: `out`, how far it projects, and `span`, how far
apart its two anchors sit. Naming the same node with two *different* sides
throws, with a message that says so.

`bow` bends an edge off the straight line between its anchors, in px, measured
to the right of its own direction of travel — so a transition and its reverse
between the same two nodes separate rather than landing on one line. It works
on a note's pointer arrow the same way.

A path is described once. `bow` together with a non-empty `via` throws, and so
does either of them on a self-transition, whose path its side, `out` and `span`
already settle. `bow` that is not a finite number throws rather than silently
drawing a straight line.

**Output moves.** `check` gained an eighth rule and rewrote an existing one:

- `edge-overlap` (warning) reports two edges drawn one on top of the other
  along their whole length, and names the fix. It stays quiet on a crossing.
- `out-of-bounds` now walks the line that actually gets drawn. A loop and a bow
  are sampled, so a curve leaving the frame is reported where it leaves rather
  than passing because both its anchors are inside. It reports the first point
  outside rather than every one, and no longer says "turns at" — a curve turns
  nowhere.

`pen.arc(cx, cy, rx, ry, from, to, opts)` is exported for a curve that is not a
connector. Angles are radians, and it samples to a polyline like everything
else: no curve command reaches the markup.

`LOOP_OUT` and `LOOP_SPAN` are 30 and 40. They were briefly 60 and 24, read off
the freehand loop the ATM example used to draw with `raw` — but a circular arc
through the same two anchors is not that shape, and the pair drew a dart rather
than a loop. Keep `out` near three quarters of `span` if you set your own.
