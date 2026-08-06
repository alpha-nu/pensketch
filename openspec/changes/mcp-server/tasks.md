# Tasks: mcp-server

Execute groups in order. A group is done when the verification commands in
`CONTRIBUTING.md` are green, a self-review of the group's diff has been made,
and every finding is fixed. Items marked **OWNER** are performed by the repo
owner, never the agent.

Blocked on `diagram-checker`: `check_diagram` is that function.

Owner decisions taken 2026-08-06 and recorded in design.md D6: the shim is
promoted to `@pensketch/core/server` as `renderToString`, and the server
rasterizes.

## 1. `@pensketch/core/server`

- [ ] 1.1 `packages/core/src/server.ts`: the DOM shim covering the seven
      members core touches, plus serialization matching the golden
      serializer's attribute ordering and escaping
- [ ] 1.2 `renderToString(diagram, options)` over that shim, with the same
      options `draw` takes
- [ ] 1.3 Parity test against a checked-in golden, and a second asserting
      `renderToString` equals `draw` into a jsdom `<svg>` for the same inputs.
      Byte parity is the contract; a second renderer that drifts would break
      it in silence
- [ ] 1.4 Packaging: tsup `entry`, `exports` gains `./server`, size budget
      1536 B, resolution test as ESM and CJS, coverage thresholds extended
- [ ] 1.5 README and `packages/core/README.md` sections; a **minor** changeset
      on `@pensketch/core`

## 2. The package

- [ ] 2.1 `packages/mcp` manifest: name, `bin`, `exports`, `files`,
      `publishConfig.access`, engines. Extend the manifest test so the
      zero-dependency assertion names the rendering packages rather than
      applying to every workspace, and so `@pensketch/mcp` may not appear in
      either rendering package's dependencies
- [ ] 2.2 Reword the dependency invariant in `CONTRIBUTING.md` to name
      `@pensketch/core` and `@pensketch/react`, so the rule keeps meaning what
      it meant
- [ ] 2.3 Pin the SDK deliberately. Its published layout has moved to scoped
      packages (`@modelcontextprotocol/server`, `serveStdio`) and much of the
      material still in circulation shows the older single-package one, so
      establish which applies at the version chosen and record it rather than
      following whichever example turns up first

## 3. Tools

- [ ] 3.1 Server factory and `check_diagram`, including the error/warning
      counts, with input schemas
- [ ] 3.2 `render_diagram` through `@pensketch/core/server` — no rendering
      logic of its own
- [ ] 3.3 Choose the embedded font **by measurement**: render the repository's
      own labels in each open-licence candidate and take the one whose mean
      glyph-advance factor sits closest to the documented stack's 0.462.
      Record the measurements alongside the choice
- [ ] 3.4 Subset that font to the glyphs a diagram can contain, and record the
      before and after sizes
- [ ] 3.5 `render_png` with `loadSystemFonts: false`, the scale cap, and
      refusal above it. Tests: identical bytes across two runs, and an
      oversized request refused rather than served
- [ ] 3.6 Tool descriptions carrying the traps — coordinates are yours, text
      is never measured, and the PNG's font is a stand-in so `check_diagram`
      owns questions of fit — with a test asserting the phrases are present,
      since a description nobody checks is a description that rots
- [ ] 3.7 Purity test: no tool reaches the network or a filesystem — a source
      scan in the spirit of core's determinism test, since this is what the
      unauthenticated hosting rests on

## 4. Resources

- [ ] 4.1 Spec, JSON Schema, the three examples, constants — each read from
      its existing single source at build time
- [ ] 4.2 A test per resource asserting served bytes equal source bytes, so a
      resource cannot drift from the file it mirrors

## 5. Transport

- [ ] 5.1 Server factory separate from the transport entry, so a second
      transport stays additive. A test constructing the factory directly and
      asserting the full tool and resource surface without any transport
      attached
- [ ] 5.2 stdio entry and `bin`, verified by spawning the built server and
      completing an initialize / list-tools / call-tool round trip
- [ ] 5.3 Report the packed tarball size at build time. The rasterizer alone
      is 2.36 MB of wasm, and an `npx` user waits for all of it on first run

## 6. Documentation and release

- [ ] 6.1 `packages/mcp/README.md`: registration for stdio clients with a
      pinned version, the `PATH` caveat, the purity guarantee, and the font
      substitution with what it does and does not affect
- [ ] 6.2 Root README section pointing at it
- [ ] 6.3 A changeset: **minor** on `@pensketch/mcp`
- [ ] 6.4 **OWNER**: publish, then register it locally and confirm a real
      client lists all three tools and every resource, and that `render_png`
      returns an image the client displays

Gate: all verification commands green, `openspec validate mcp-server
--strict` green, a real client completing a `check_diagram` round trip and
displaying a `render_png` result.
