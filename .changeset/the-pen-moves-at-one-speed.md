---
'@pensketch/animation': minor
---

A solid stroke's duration now scales with its measured length: `--ps-stroke`
times the `--ps-len` the renderer stamps, so the pen crosses a 700 px curve
slower than it flicks a 12 px barb — constant speed, which is what a hand
does, instead of constant duration, which is what read as mechanical. The
floor is a tenth of the stroke time, argued in the stylesheet: a barb's true
ratio at the default half-second is 10 ms, under one frame at 60 Hz, and the
least that still reads as movement is a few. Dashed strokes fade and text is
written, both at the flat stroke time — neither travels, so neither has a
length to spend.

`--ps-len` falls back to 1, so a drawing stamped by an older core runs every
stroke at the full stroke time — exactly what this stylesheet did before the
variable existed. Nothing else moves: same keyframes, same stagger, same
degradation to finished-and-still.
