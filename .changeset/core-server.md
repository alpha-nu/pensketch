---
'@pensketch/core': minor
---

Adds `renderToString`, on the new subpath `@pensketch/core/server`.

Renders a diagram to SVG markup with no DOM anywhere: no browser, no jsdom,
no global `document`. `draw` and `pen` between them touch seven members of
the DOM, and element creation already goes through the target's own document
rather than a global one, so a shim of about fifty lines is enough — and
still zero dependencies.

It is the same renderer, not a second one: it draws through `draw` into that
shim. A test asserts its output is identical, element for element, to `draw`
writing into a real DOM for the same diagram and seed, because a second
renderer that quietly disagreed would break the byte-parity promise in
silence.

What comes back is the contents of an `<svg>`, not the element — the caller
supplies the wrapper, and with it the `viewBox` and the accessible name,
exactly as `draw` requires an element to fill.

Minor rather than patch because it adds API. Nothing about the rendered
output changed.
