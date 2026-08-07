---
'@pensketch/mcp': patch
---

The `pensketch://spec` resource now says why its example sets `size`, because
an agent reading it concluded that boxes take `size: 12`.

They do not. In the full OAuth diagram exactly one of seven steps needs it —
`7. call with bearer` estimates 141px of label inside 139px of box at the
default 13.5, which `check_diagram` reports as `text-overflow` — and the other
six carry it so one row does not draw its labels at two different sizes. The
abbreviated example in the spec shows four of those six and none of the one,
so every occurrence a caller could see was unmotivated, in the document whose
own description tells them to read it first.

Teaching material is read by imitation, so an unexplained attribute is an
instruction. Both the spec and the example it is taken from now state which
node forced it, that the rest are a choice about that diagram rather than a
rule about diagrams, and that `size` is best left alone until the checker
names a node.

No behaviour changes and no diagram moves a pixel.
