---
'@pensketch/core': minor
---

`order: true` counts gestures, not elements, and measures them. Three changes
to what the stamps say, none to any unstamped byte:

Both passes of one stroke share a single `--ps-i` — the pen traces everything
twice and the lighter pass is what reads as pressure, so a pair is one
movement of one hand and now draws as one. Numbered apart, every line was
visibly drawn and then drawn again, and half of an animation's runtime went
to the redraw.

Each label takes its own phase's place instead of queueing after everything —
the pen writes a label immediately after the thing it names, so a node's
words now land with the node and an edge's with the edges. The old order put
every label in an animation's final stretch: watched at 122 strokes, all the
lettering fit in the last tenth of the runtime and the diagram was unreadable
until it was over (docs/pensketch-feedback-animation-2.md).

Every solid path also gains `--ps-len`, its gesture's length as a fraction of
the drawing's longest, measured off the path itself. It is a measurement, not
a policy: what to do with it belongs to whoever spends the time, which is
`@pensketch/animation`.
