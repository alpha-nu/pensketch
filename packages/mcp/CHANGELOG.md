# @pensketch/mcp

## 0.6.0

### Minor Changes

- bbefa67: A diagram can draw itself. `draw` learns one option, and a new package turns
  what that option stamps into motion.

  ```js
  import { draw } from "@pensketch/core";
  import { animate } from "@pensketch/animation";

  draw(svg, diagram, { order: true });
  animate(svg, { duration: 3000 });
  ```

  **Nothing you draw today moves.** `order` defaults to false, and with it unset
  not one byte of the output differs — the z-order, the seeded sequence and the
  elements themselves are what they were, and every golden in this repository
  regenerates clean. Minor rather than patch because the option exists and the
  output changes when it is set, not because anything changed for a caller who
  leaves it alone.

  With `order: true` every element carries `--ps-i`: how far through the drawing
  it is, as a fraction in `[0, 1)`. The number counts in the order a hand would
  draw in — group frames, then node shapes, then connectors, then braces, notes
  and `raw`, and then every piece of text whatever phase drew it — which is
  **not** the order the document is in. Nothing is reordered to achieve that; the
  index is written onto the elements where they already stand. Every path
  carrying no `stroke-dasharray` also gains `pathLength="1"`, which normalises it
  so one keyframe draws a 400 px connector and a 12 px arrowhead barb at the same
  rate. A dashed path is deliberately left alone: `pathLength` rescales every
  distance along a path, `stroke-dasharray` among them, so a normalised dotted
  line would render solid.

  ## `@pensketch/animation`, at its first published version

  That number read back, and nothing else: one frozen stylesheet, 663 B minified
  and gzipped, inserted as the `<svg>`'s own first child. It is CSS — nothing of
  it runs while the drawing is drawing. `animate` takes an element;
  `animateMarkup` takes the contents `renderToString` hands back. `duration`
  (2000 ms), `stroke` (500 ms, any one element) and `easing` (`ease-out`) are the
  whole of the surface, and anything left out keeps the stylesheet's own default,
  so the defaults have exactly one home. Nothing else is added to your element:
  no class, no id.

  Call it **after** `draw`, never before. `draw` removes every child of the
  element it fills, so a `<style>` put there first goes with them and the diagram
  simply appears — and a redraw takes the stylesheet with it and has to be
  animated again.

  ## How it degrades, and it is one way

  The rules sit in an implicit `@scope` block, so they reach only the drawing
  they were put in. Three separate things switch them off:

  - an engine that does not understand `@scope` — Chrome before 118, Safari
    before 17.4, Firefox before 146, and Firefox ESR 140, which understands it
    but ships it disabled by pref — drops the block whole;
  - an element carrying no `--ps-i` — an older core, a `pen` drawing, a caller
    who did not pass `order` — makes the `animation` shorthand invalid at
    computed-value time, so `animation-name` computes to `none`;
  - `prefers-reduced-motion: reduce` turns it off outright.

  All three land in the same place on purpose: the diagram renders **finished and
  still**, pixel-identical to the same diagram with no stylesheet at all — never
  blank, never half-inked. Measured in Chrome against a control of 401 inked
  pixels, every one of those paths renders 401: the drawing the pen laid down,
  dashes and all. What makes that true is that no property which hides a stroke
  is set outside the keyframes — an earlier design that declared the starting
  state statically measured 0 on the same input, a blank frame, and 200 under
  version skew, a frozen dotted ghost.

  `@pensketch/core` is a peer, floored at the minor that ships `order`. A range
  open across all of `0.x` would admit a core that stamps no index, and this
  package cannot detect that at runtime — the diagram would render finished and
  still, with nothing to say why.

  ## `@pensketch/react`: one prop

  ```tsx
  import { animate } from "@pensketch/animation";

  <PenSketch diagram={FLOW} viewBox="0 0 700 150" animate={animate} />;
  ```

  The prop takes the **function**, not a boolean, so this package declares no
  dependency on `@pensketch/animation` and names it nowhere — a page that does
  not want motion carries none of it. It is held in a ref and read when the
  drawing runs, so unlike `diagram`, `seed` and `theme`, changing its identity
  does not re-animate: the natural way to pass options is an inline arrow,
  `animate={svg => animate(svg, { duration: 3000 })}`, and a prop that redrew on
  identity would restart the drawing from blank on every parent render.

  ## `@pensketch/mcp`: one tool parameter

  `render_diagram` gains `animate`, default false. What comes back is a
  self-contained `<svg>` that draws itself inline in a page, embedded as an
  `<img src>`, or opened as a file, with nothing else fetched and no CSS to
  write.

  `render_png` does not take it, and the absence is a refusal rather than an
  omission: a still frame of an animation is just the finished picture, so a
  caller who asks for `animate: true` there is told `render_png has no argument
"animate"` — which is more use than a field accepted and quietly ignored.

### Patch Changes

- Updated dependencies [bbefa67]
  - @pensketch/core@0.6.0
  - @pensketch/animation@0.1.0

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

### Patch Changes

- Updated dependencies [6976630]
  - @pensketch/core@0.5.0

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

- ec365c4: A fifth example, `examples/showcase/`, served as `pensketch://example/showcase`.

  This project's own logical architecture, drawn by the renderer it describes:
  four groups, thirteen components, fifteen connectors, two braces, two notes.
  It exists to be the one picture that reaches for the breadth of the data model
  — every drawn shape, `accent` and `hatch`, straight connectors and orthogonal
  ones, a self-transition, both kinds of brace, notes whose pointers bow — and to
  do it **without `raw`**, so that what it draws is expressible as data and can be
  served whole rather than served with a hole and a note explaining the hole.

  No package source changes and no rendered byte of any existing diagram moves.
  What changes is what `@pensketch/mcp` publishes: one more resource, so an agent
  asking for a worked example has a rich one to read rather than four small ones.

### Patch Changes

- Updated dependencies [82579c1]
- Updated dependencies [226356e]
  - @pensketch/core@0.4.0

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

### Patch Changes

- Updated dependencies [256122e]
  - @pensketch/core@0.3.0

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

- 7fc9bf2: The React example is an incident now, and the diagram it draws is computed
  from application state.

  It was the OAuth authorization code flow: four lanes, seven steps, and a seed
  control. The seed control demonstrated determinism, which is a property of
  `draw` — four buttons on a plain HTML page show the same thing. Nothing on the
  page demonstrated what the bindings are actually for, which is a picture
  derived from what the application knows.

  It now draws an incident at the stage it has reached, and three things about
  the picture are computed from that stage: which nodes carry `accent`, which
  carry `hatch` behind it, and which edges are `dotted`.
  The seed control stays, next to it, so the page says the two apart: the stage
  changes the data, and the seed changes which drawing of that data you get. The
  diagram is memoized on the stage, because `<PenSketch>` compares `diagram` by
  identity — which is the thing a diagram built from state has to get right.

  **The served resource is renamed.** `pensketch://example/oauth` is now
  `pensketch://example/incident`, and `pensketch://spec` — `docs/agents.md` —
  carries the new diagram as its complete worked example, in place of the OAuth
  one. The other three example resources are untouched.

  The flow forks. A `fixed?` diamond either ends the incident — declaring it
  over and writing it up are two nodes, stacked — or sends it back to `mitigate`
  along a bowed edge. That fork is what the brace marks, and it is what lets the
  brace be curly: a brace turns its corners at one fixed radius and its tip at
  another, so widening one grows nothing but the two straight runs between them
  and a wide one reads as an underline with a bump. Down the side of the stacked
  pair this one is 186 px, near the 150-220 the rest of this project's braces are
  drawn at.

  Every stage is checked, not just the one that is served: `npm run diagrams`
  loads all five, because a picture correct only at stage 3 is a picture this
  repository would ship broken four times out of five.

- bf9aa77: Refuse a key the tool does not recognise, instead of dropping it.

  The server generates its JSON Schema with `additionalProperties: false`,
  serves it as `pensketch://schema`, and tells callers to validate against it.
  Its own tool boundary then validated with a lenient object, which silently
  stripped anything the schema forbids. A diagram carrying a key the server did
  not know reached the renderer without it: no error, no diagnostic, and a
  caller who cannot see the picture had no way to learn that a piece of it was
  missing. The common case was not an exotic field but a misspelled one —
  `node` for `nodes` rendered an empty diagram, and `check_diagram` then
  reported "No findings." on it, so the one verification step in the product
  certified the loss.

  Every tool's arguments are now validated strictly **at their top level**, and
  the message names what you should have sent:

  ```
  A diagram has no field "node". It takes nodes, edges, braces and notes;
  read pensketch://schema for the fields inside each.
  ```

  The schema each tool publishes in its listing declares the same restriction,
  so a client validating locally is not told it may send a key the server will
  refuse.

  **What this does not cover.** Fields inside a node, an edge, a brace or a note
  are unchanged: `{ nodes: [{ …, line: ['hi'] }] }` is still accepted and still
  draws an unlabelled box. Those fields are described by `pensketch://schema`,
  and restating them at the boundary would be a second source of truth. Validate
  against the schema to catch them.

  **What may break.** No diagram's rendered bytes change, but some calls that
  returned a picture now return an error. If you send `raw` alongside real nodes,
  you used to get the rest of the diagram and will now get a refusal — `raw`
  holds functions and never crossed this interface anyway. If you spread a
  served `pensketch://example/*` envelope straight into the arguments, its
  `title` and `rawOmitted` are now refused; pass `example.diagram` and
  `example.viewBox` instead, which is what the resource description now says.

  **If you are a client author.** The arguments object beside the diagram is
  strict too, so a field your client adds to a tool call for its own purposes
  will be refused by name. The protocol's place for that is `_meta`, a sibling
  of `arguments` rather than a key inside it, and anything sent there is
  untouched. This is worth saying because at least one MCP client has been known
  to put scheduling metadata into the arguments payload itself: if a user
  reports a refusal naming a key they have never written, that is where it comes
  from.

### Patch Changes

- Updated dependencies [375b36a]
- Updated dependencies [fb39562]
  - @pensketch/core@0.2.0

## 0.1.1

### Patch Changes

- 61e7138: A fourth bundled example: an ATM as a state machine, at
  `pensketch://example/atm`.

  The three that were there are all flows — work moving forward through stages.
  This one branches. A decision diamond splits it, the failure path is dotted
  and routed back up the left margin into the box it came from, and pill
  terminals mark where the card ends up. It is the shape most state machines
  are, and none of the others showed it.

  It also carries the lesson `raw` exists to teach, twice over. An edge joins
  two _different_ nodes, so "another digit, stay in awaiting PIN" cannot be said
  in the data at all — it is drawn by callback, and the callback cannot cross a
  JSON boundary.

  Which is the other change here. Both diagrams that draw with `raw` now serve a
  `rawOmitted` line saying which stroke is missing from the copy a caller
  receives and why. Before this, the lifecycle example handed over a picture
  with a piece removed and no way to notice; a caller reproducing it faithfully
  would have found their diagram short one transition and no reason given. The
  generator refuses to build if a diagram grows a `raw` without that line.

- ce07031: `render_png` draws the diagram again. In `0.1.0` it drew none of it.

  The markup core writes paints with `var(--ps-ink, #232B36)` and friends, which
  a browser resolves and the WebAssembly rasterizer does not — in a presentation
  attribute or a `style` declaration alike, and it does not fall back to the
  fallback either. An unparseable paint takes the property's initial value, and
  those differ by property: `stroke` initially draws nothing, `fill` initially
  draws black. So every line disappeared — box outlines, arrows, group borders,
  all of it — every group wash became a solid black slab, and the labels kept
  drawing in black, close enough to the ink to look deliberate. The result was a
  picture of a structure it did not contain, from a tool whose description calls
  it authoritative about structure.

  It now resolves the palette before rasterizing, taking the literal colours
  from `defaultTheme` rather than a transcription of them, so a palette change
  reaches the PNG on its own. `render_diagram` is untouched and still paints
  with the variables, because its SVG goes to a page that restyles them.

  The image also comes on warm paper (`#FCFAF5`) instead of transparency. A
  transparent PNG of near-black ink is invisible in a client with a dark panel,
  which is the same failure in a different costume, and the wash is five percent
  blue and needs something to sit on.

  Nothing caught this because nothing looked. The suite asserted a PNG signature
  and a byte count, and blank paper satisfies both. It now reads the pixels and
  demands ink of the right hue, which fails on the old code with `0` drawn.

  Also: the `bin` path loses its `./`, which npm silently rewrote on every
  publish while warning that it had been "invalid and removed" — it had not, but
  the warning is alarming and now does not appear. And the README miscounted the
  resources, having folded three examples into one table row.

- a80d3db: The `pensketch://spec` resource now says why its example sets `size`, because
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

- Updated dependencies [702b3b4]
  - @pensketch/core@0.1.1

## 0.1.0

### Minor Changes

- 3d7a2b9: First release of `@pensketch/mcp`, an MCP server for writing diagrams without
  seeing them.

  Three tools. `check_diagram` reports the layout defects neither the types nor
  the schema can catch. `render_diagram` returns SVG through
  `@pensketch/core/server`. `render_png` rasterises it, because an agent handed
  a few thousand path coordinates is not looking at a picture.

  Five resources, each mirroring a file that already exists for another reason:
  the reference written for machine callers, the JSON Schema generated from the
  types, three complete example diagrams with real coordinates, and the frozen
  constants read from the installed renderer. A test asserts the served bytes
  match their sources, so a resource cannot drift from what it describes.

  Every tool is a pure function of its arguments — no network, no filesystem, no
  state between calls — and a test reads the source to keep it that way. The
  server loads two files of its own at startup, the WebAssembly rasterizer and
  the embedded font, both resolved by specifier and never from anything a caller
  sends.

  The PNG draws text in Architects Daughter rather than the handwriting stack
  the SVG names, those faces being proprietary and the rasterizer drawing only
  with fonts handed to it. It was chosen by measurement: of five open-licence
  candidates its glyph advance sits closest to the real stack's. So the image is
  authoritative about structure and not about fit, which the tool descriptions
  say, and `check_diagram` owns the question of fit.

  stdio only. The server factory is separate from the transport, so a second
  transport would be additive rather than a rewrite.

### Patch Changes

- Updated dependencies [569c797]
- Updated dependencies [560fd28]
- Updated dependencies [4f36e10]
  - @pensketch/core@0.1.0
