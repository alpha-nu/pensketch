# @pensketch/core

## 0.5.0

### Minor Changes

- 6976630: A new rule, `text-collision`, reports two pieces of text written in the same
  place — where before nothing compared one piece of text with another at all.

  **`check` will report diagrams it passed before, and nothing you draw moves.**
  No renderer file changed and every golden regenerates clean, so the rendered
  bytes of every diagram are what they were. This is a minor because `check` runs
  in CI: on a 0.x version a caret range stops at the minor, so a release that can
  turn a green pipeline red must be one you choose rather than one that arrives
  on the next install.

  Every rule before this one measures text against the _strokes_ a diagram draws.
  `label-collision` boxes a label and asks whether any drawn path passes through
  it, and a node's label and a group's title are ink that is in no path — so
  neither was ever compared with anything, and neither was another label. Four
  shapes of defect fell in that gap:

  - an edge label written through a group's title
  - an edge label written through a node's own label
  - two edge labels written on one another
  - a note written over any of them

  The finding names both pieces, in the order they are drawn:

  ```
  node "leaf" lies under edge 0, which will be drawn through it
  ```

  **Which diagrams start reporting.** None of the ten this repository ships —
  `npm run diagrams` is 0 errors and 0 warnings across all of them. What starts
  reporting is text placed where other text already is, which in practice means
  an edge or note label put near the top-left corner of a group, or over a box
  whose own label is already there. If you position labels by hand against a
  group's title, expect a warning per pair.

  **There is no threshold in it.** Two boxes either intersect or they do not, so
  unlike `edge-overlap` there is no number to calibrate and none to be talked
  into. Near is not a collision.

  The finding carries `estimated: true`, because pensketch never measures text —
  the boxes rest on the same deliberately over-stated width estimate
  `text-overflow` already reports on, and a finding resting on an estimate says
  so. `rules: { 'text-collision': 'off' }` switches it off on its own.

  `@pensketch/core/check` grows from 3297 to 3390 bytes min+gzip. The root entry
  and `@pensketch/core/server` do not move at all — the rule is in the checker,
  not in shared code — and it costs no measurable time, because it reuses boxes
  the surrounding rules already compute rather than making a pass of its own.

  One limitation is worth stating rather than leaving to be found: this compares
  the _text_ a group or a note carries, not the lines they draw. A label lying
  across a group's border, or across a note's arrow, is still not reported, and
  no rule compares an edge with a node's outline.

  `@pensketch/mcp` reissues because `check_diagram` returns the new findings and
  the reference it serves describes the rule.

## 0.4.0

### Minor Changes

- 82579c1: A connector can be drawn as the one that goes over where two cross: the line
  underneath is broken where they meet, so a reader can tell which is continuous.

  **Rendered output is unchanged unless you ask for it.** `hop` and `hops` both
  default to `false`, and a diagram that sets neither draws the same bytes it drew
  before — every parity golden in this repository is untouched, including under
  the restructure that now collects each edge's path before drawing any of them.
  That restructure consumes no seeded numbers, so the order the pen is called in
  is the order it always was.

  Two ways to ask. `hop: true` on an edge says that edge goes over whatever it
  crosses. `hops: true` in the draw options says it of every edge, and an edge's
  own `hop` still wins either way — so `hop: false` opts one connector out of a
  diagram-wide switch rather than being indistinguishable from leaving it off.

  ```js
  edges: [
    {
      from: ["check", "b"],
      to: ["rules", "t"],
      via: [
        [440, 372],
        [995, 372],
      ],
    },
    { from: ["server", "b"], to: ["markup", "t"], hop: true },
  ];
  ```

  What moves is the _other_ line. Nothing is added to the path of the edge going
  over; the one underneath stops for `HOP_GAP` — 10 px — and starts again on the
  far side. Where both edges of a crossing go over, the one later in `edges` wins,
  so layering is a total order on the array and no geometry decides which
  relationship is subordinate.

  Only a real crossing counts, tested as a strict interior intersection. So a
  fan-out is left whole, two connectors drawn along one another are left whole,
  and a connector that merely _arrives at_ another does not break it — arriving is
  not crossing. Detection is a plain pairwise walk with no spatial index: measured
  at 0.0017 ms on this repository's largest diagram, a tenth of a percent of the
  render it already pays for.

  The older convention — a bump on the line going over — is not what this does,
  and cannot be. Displacing a line perpendicular to itself moves the apex _along_
  whatever it crosses at a right angle, so the bump lands on the line it was meant
  to bridge; and `ARC_MIN_CHORD`, which exists so the pen's own jitter cannot turn
  a small arc into noise, flattens it into two chords and makes that apex a
  vertex. Rendered at four sizes it reads as a junction. Seven shapes went to a
  render before the break was chosen.

  `check` does not model this. The path it walks is the unbroken one, so
  `label-collision` can measure clearance to a stretch of line the renderer cut
  away. The error is bounded by `HOP_GAP` and it is stated rather than discovered.

  `@pensketch/core` grows by about 429 bytes min+gzip, to 4179. Every consumer
  carries it whether or not a diagram sets `hop`: hopping is a behaviour of
  `draw`, not an entry point that can be left unimported.

  `@pensketch/mcp` reissues because `render_diagram` and `render_png` now accept
  `hops` beside `seed`, and because the JSON Schema and the reference it serves
  both describe the new field. `check_diagram` does not accept `hops` and refuses
  it by name, since it would change no finding.

- 226356e: `edge-overlap` reports two connectors that share a trunk and then part, where
  before it only reported a pair drawn on top of one another the whole way.

  **`check` will report diagrams it passed before, and nothing you draw moves.**
  No renderer file changed, every golden regenerates clean, and the rendered
  bytes of every diagram are what they were. This is a minor because `check` is
  run in CI: on a 0.x version a caret range stops at the minor, so a release that
  can turn a green pipeline red must be one you choose rather than one that
  arrives on the next install.

  The rule it replaces asked that _every_ sampled point of each path lie near the
  other. A pair that runs together and then separates never satisfies that —
  each has points at its far end the other never comes near, so one failing
  sample made the whole test false. That is not a threshold set too high: the
  quantity being measured was "do these coincide entirely", and a trunk answers
  no. Measured on this repository's own showcase before its routing was fixed,
  262 px of connector was drawn along other connector — 76, 70, 58 and 58 — and
  `npm run diagrams` reported zero warnings on that file, before the fix and
  after it.

  The finding names the length, because "these two overlap" and "these two share
  62 px" are different amounts of help when the fix is to move one line:

  ```
  edges 2 and 3 are drawn along one another for about 62 px; give one of them a bow
  ```

  "About" is meant. The walk is quantised, and a parting path keeps counting
  until it is clear of the ink by `2 * INFLATE`, so a 20 px trunk reports as 24.

  **Which diagrams start reporting.** None of the ten this repository ships —
  `npm run diagrams` is 0 errors, 0 warnings across all of them, and the
  threshold was calibrated against them rather than checked against them
  afterwards. What starts reporting is the shape those diagrams were already
  routed to avoid: two connectors leaving one anchor, or arriving at one, that
  draw as a single line for 40 px or more before going different ways. If you
  have an orthogonal layout where several edges leave one node and turn at a
  shared corner, expect a warning per pair.

  **What stays quiet, deliberately.** A run is measured only for two edges
  sharing exactly one anchor. A pair sharing _both_ is the shape `bow` exists to
  separate — they must meet at each end whatever they do between, so a run there
  says nothing, and the whole-length test still governs them: a bow of 4 is
  reported and 5 is not, exactly as before. A pair sharing _neither_ cannot be
  told from a shallow crossing by proximity alone, since two lines meeting at a
  narrow angle stay within the same distance for an arbitrarily long run — so
  two connectors sharing a corridor without sharing an end are still only caught
  if they coincide the whole way. That is a real blind spot and it is written
  down rather than discovered.

  Two more limits worth knowing. The 40 px threshold is in diagram units while
  the distance that counts as one line is a fixed 4.2 px of ink, so the rule is
  not scale-free: a diagram drawn at twice these proportions will report forks
  this one leaves alone. And two edges leaving one anchor at less than about 6°
  are reported at any scale, because a band that thin takes that long to escape.

  `rules: { 'edge-overlap': 'off' }` switches the whole rule off as it always
  did. There is no separate threshold option — a knob nobody can calibrate
  against their own diagrams reports a different picture to every reader.

  `@pensketch/core/check` grows from 3008 to 3297 bytes min+gzip. The root entry
  and `@pensketch/core/server` do not move at all: the rule is in the checker,
  not in shared code. Cost is unchanged in practice — 0.209 ms against 0.221 on
  the largest diagram here — because a pair that shares no anchor is rejected
  before any measuring. Where it does bite is a hub: the walk is quadratic in the
  fan-out of a single anchor, so 20 edges off one node cost 17 ms and 40 cost
  150, against 0.13 and 0.32 before.

  `@pensketch/mcp` reissues because `check_diagram` returns the new findings and
  the reference it serves describes the rule and its limits.

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
