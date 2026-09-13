---
'@pensketch/mcp': minor
---

`render_diagram` grows `duration`, `stroke` and `easing` beside `animate` —
refused by name without it, because a timing argument on a still drawing
would be accepted and do nothing. The resolved values are written into the
file: a standalone `.svg` has no parent document to set a custom property on,
so a knob only a host page could turn was no knob at all
(docs/pensketch-feedback-animation-2.md).

The default `duration` scales with the drawing: 70 ms of cadence per stroke,
held between 2 and 6 seconds. The fixed 2 s it replaces was calibrated at
small sizes and never checked at the other end — at 122 strokes it left 12 ms
between starts, which reads as a flash, not as drawing. Small diagrams keep
the timing they always had; the floor is the package default itself.

An animated result's findings block now opens with one line of account —
stroke count, resolved duration, hand order, and the `@scope` support
boundary (Chrome 118+, Safari 17.4+, Firefox 128+) below which the file opens
finished and still — because the caller cannot watch what it just made, and
that line is the only description of the animation there is. The tool
description also now says the result is two content blocks and to save only
the first: the markup and the findings were always separate, and a client
that glues text blocks together writes `</svg>No findings.` into a file by
its own hand, not this server's.
