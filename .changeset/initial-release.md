---
'@pensketch/core': minor
'@pensketch/react': minor
---

First release.

`@pensketch/core` renders hand-sketched SVG diagrams from plain data: nodes,
edges and notes as ordinary objects, drawn with a seeded wobble so the same
diagram and seed always produce the same bytes. Zero runtime dependencies,
CSS-variable theming, and an escape hatch that hands you the pen.

`@pensketch/react` adds a `<PenSketch>` component and a `useSketch` hook over
it, safe under StrictMode and on the server.

Both packages name a minor rather than a patch: patch is reserved for releases
that render byte-identically, and there is no earlier rendering to be
identical to.
