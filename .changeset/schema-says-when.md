---
'@pensketch/core': patch
---

The JSON Schema now says *when* to reach for `size` and `via`, not only what
they are.

Both descriptions were accurate and useless to a caller deciding whether to
set the field. `size` read "Label font size in px. Default: `13.5`." — true,
and no help at all to a model that has just seen an example set it on every
box. It now says that it shrinks the text and never the box, so it answers one
question only: a label `check` reports as `text-overflow` that cannot be
shortened or widened instead.

`via` read "Corner points between the two anchors." It now carries the rule
that makes this library surprising — the points are walked in order and used
exactly as given, nothing is inferred, nothing routes around an obstacle, and
an omitted `via` draws a straight line through whatever is in the way. That
was in the prose reference already; it was not in the field description, which
is what a caller reads at the moment they need it.

The schema is generated from the types, so both changes are JSDoc. Nothing
about validation moves: the same documents are valid and invalid as before.
