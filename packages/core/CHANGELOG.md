# @pensketch/core

## 0.3.0

### Minor Changes

- 256122e: Hatching follows the outline it is drawn inside, not the box that outline sits
  in.

  **Rendered output changes.** Any diagram with `hatch: true` on a `pill` or a
  `diamond` renders different bytes — that is the fix, not a side effect. A
  hatched `box` is unchanged down to the byte, and so is every diagram without a
  hatched pill or diamond in it: the box path is untouched code, and none of this
  repository's parity goldens moved.

  Until now `hatch` shaded the node's rectangle whatever outline was drawn round
  it. On a box that is the shape. On a pill it overshot the ellipse by up to
  15.5 px — a third of the height — on the 150 × 50 this repository ships. On a
  diamond it filled all four corners of the box, which is half the box's area and
  none of the shape's. Measured on the ink itself: 82 of 340 sampled points
  outside the pill's outline, 46 of 78 outside the diamond's.

  Now each diagonal is cut to the shape's own outline, and the shading stands
  `HATCH_INSET` clear of it measured perpendicular to the line drawn — not clear
  of the box, which on a wide diamond was a fraction of that: 1.81 px on the
  150 × 76 this repository ships, and nothing at all at 278 × 30, where hatch ink
  lay on the outline. Swept over 5566 sizes from 60 × 30 to 300 × 120, ink now
  comes no closer than 3.21 px on a diamond and 1.85 px on a pill, against the
  3.40 px a box holds.

  `pen.hatch` takes an optional sixth argument, a `clip` polygon, which is how
  `draw` does it and how a `raw` callback can shade inside a shape it traced
  itself:

  ```js
  raw: [
    (p) => {
      const star = [[100, 20], [118, 66], [166, 68], [128, 98], [141, 144],
                    [100, 118], [59, 144], [72, 98], [34, 68], [82, 66]];
      p.stroke([...star, star[0]]);
      p.hatch(34, 20, 132, 124, undefined, star);
    },
  ],
  ```

  Concave is fine, and so is self-intersecting: crossings are paired in order
  along each line, which fills by the even-odd rule. The polygon may repeat its
  first point or not.

  `@pensketch/mcp` reissues because the reference it serves as
  `pensketch://spec`, and the JSON Schema it serves beside it, both describe this.

## 0.2.0

### Minor Changes

- 375b36a: Curved connectors: a self-transition, and a bow off the straight line.

  A documented impossibility is now possible. Until this release a pensketch edge
  joined two _different_ nodes, so "retry, stay where you are" could not be said
  in data at all — the reference said so, and the way round it was a `raw`
  callback drawing the arc by hand. Both of this repository's own examples did
  exactly that, and neither could serve a whole picture to an agent, because
  `raw` holds functions and functions do not cross a JSON boundary.

  An edge naming the same node **and the same side** at both ends now draws a
  loop, sized by two new fields: `out`, how far it projects, and `span`, how far
  apart its two anchors sit. Naming the same node with two _different_ sides
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

  A curve is sampled between two bounds now, not one. `SEG_LEN` was already the
  ceiling — no chord of an arc longer than a leg of a straight line — and
  `ARC_MIN_CHORD` is the floor: 12 px, which is where `pill` already samples.
  Without it, `ARC_STEPS` counted a full turn and knew nothing of the radius, so
  a quarter turn took its share at any size and a small arc came out in 3 px
  chords; `pass` then halved each and threw 2.6 px of jitter across both ends, and
  the drawn line doubled back on itself. Measured on the markup, a brace's corners
  drew gaps down to 0.19 px against a straight leg's 25 and a pill's 6.9. Every
  curve now sits inside the band the reference's own primitives occupy. A full
  sweep at pill sizes is unaffected, and no golden moves.

  `LOOP_OUT` and `LOOP_SPAN` are 30 and 40. They were briefly 60 and 24, read off
  the freehand loop the ATM example used to draw with `raw` — but a circular arc
  through the same two anchors is not that shape, and the pair drew a dart rather
  than a loop. Keep `out` near three quarters of `span` if you set your own.

- fb39562: Braces and brackets: the second thing `raw` could draw and JSON could not.

  A `braces` array marks a span and names it — what a group does, for the two
  cases a rectangle cannot serve: sets that overlap, and a span you want marked
  without enclosing what is inside it.

  ```js
  braces: [
    {
      from: [745, 75],
      to: [745, 228],
      depth: -26,
      lines: ["one build,", "promoted"],
      lx: 785,
      ly: 152,
    },
  ];
  ```

  `from` and `to` are the span in your own coordinates and `depth` is how far the
  tip stands off its midpoint, perpendicular to it — positive to the right of
  travel, the sign convention `bow` carries, so flipping a brace to the other
  side is a minus sign. `kind: 'square'` draws a bracket instead: four points and
  no curve in it. `lines`, `lx`, `ly` and `anchor` are the label, with the
  meaning they carry on an edge, and `draw` throws on `lines` without numeric
  coordinates for the same reason it does there: nothing here measures text.

  A brace and its label stroke in `--ps-pen`, the role that already carries a
  group's border and a group's title.

  **Output moves, and the draw order is the reason.** The phase runs between the
  non-group nodes and the notes, so a brace is drawn over what it spans and under
  the annotation that explains it. That order is part of the rendered bytes, so
  every place that lists the phases has moved with it. A diagram with no `braces`
  renders byte for byte as it did: the phase draws from the seeded sequence only
  when it has something to draw.

  `check` sees a brace as the shape it draws. `out-of-bounds` samples its path,
  so a tip carried past the `viewBox` by its depth is reported where the straight
  line between its endpoints would have sat wholly inside, and a brace's label is
  reported like any other text. `label-collision` searches braces as well as
  connectors — a note drawn across a brace is the same defect as a label drawn
  across an edge — which means a finding now names its subject rather than an
  edge index: `brace 2` where it used to be able to say only `edge 2`.

  `@pensketch/mcp` accepts `braces` at its tool boundary and serves the field in
  `pensketch://schema` and `pensketch://spec`.

## 0.1.1

### Patch Changes

- 702b3b4: The JSON Schema now says _when_ to reach for `size` and `via`, not only what
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
