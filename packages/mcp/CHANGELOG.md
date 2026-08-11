# @pensketch/mcp

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
