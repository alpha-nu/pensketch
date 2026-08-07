# @pensketch/react

## 0.1.0

### Minor Changes

- 4f36e10: First release.

  `@pensketch/core` renders hand-sketched SVG diagrams from plain data: nodes,
  edges and notes as ordinary objects, drawn with a seeded wobble so the same
  diagram and seed always produce the same bytes. Zero runtime dependencies,
  CSS-variable theming, and an escape hatch that hands you the pen.

  It also ships the JSON Schema for a diagram, generated from its own types, at
  `@pensketch/core/schema.json` — so data can be validated against the version
  installed rather than a copy taken once and left to drift.

  `@pensketch/react` adds a `<PenSketch>` component and a `useSketch` hook over
  it, safe under StrictMode and on the server.

  Both packages name a minor rather than a patch: patch is reserved for releases
  that render byte-identically, and there is no earlier rendering to be
  identical to.
