# @pensketch/mcp

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
