# @pensketch/core

## 0.1.0

### Minor Changes

- 569c797: Adds `renderToString`, on the new subpath `@pensketch/core/server`.

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

- 560fd28: Adds `check`, on the new subpath `@pensketch/core/check`.

  It reports the layout defects neither the types nor the JSON Schema can see:
  two boxes drawn over each other, a label a connector will be drawn through,
  text wider than the box holding it, a node half out of its lane, a node no
  edge names, anything outside the `viewBox`. Seven rules, each raisable,
  lowerable or switchable off, returning findings sorted by severity, then
  rule, then position — so the same diagram always yields the same array.

  It never renders, never touches a DOM, never measures text and never changes
  the diagram: a finding says where the problem is and leaves the fix to the
  caller. Its own entry point, so a page that never imports it ships none of
  it, and the root entry is byte-for-byte the size it was before.

  Minor rather than patch because it adds API. Nothing about the rendered
  output changed — this draws nothing.

  Text is never measured, so two of the rules rest on an estimate of
  `length × fontSize × 0.55`, measured against the documented handwriting stack
  and deliberately wider than every real label in it. It over-states, so it
  warns early rather than missing an overflow, and every finding that depends
  on it carries `estimated: true`.

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
