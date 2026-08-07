# @pensketch/mcp

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
