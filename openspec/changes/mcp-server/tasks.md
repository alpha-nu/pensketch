# Tasks: mcp-server

Execute groups in order. A group is done when the verification commands in
`CONTRIBUTING.md` are green, a self-review of the group's diff has been made,
and every finding is fixed. Items marked **OWNER** are performed by the repo
owner, never the agent.

Blocked on `diagram-checker`: `check_diagram` is that function.

## 0. Decisions the owner settles first

- [ ] 0.1 **OWNER**: O1 — does the DOM shim stay private to `@pensketch/mcp`,
      or is it promoted to `@pensketch/core/string` as `renderToString`?
      design.md D6 states the case both ways
- [ ] 0.2 **OWNER**: O2 — rasterize or not. `check_diagram` is built so that
      seeing is unnecessary; adding raster later is a new tool, not a break

## 1. Package and rendering

- [ ] 1.1 `packages/mcp` manifest: name, `bin`, `exports`, `files`,
      `publishConfig.access`, engines. Extend the manifest test so the
      zero-dependency assertion names the rendering packages rather than
      applying to every workspace
- [ ] 1.2 Reword the dependency invariant in `CONTRIBUTING.md` to name
      `@pensketch/core` and `@pensketch/react`, so the rule keeps meaning what
      it meant
- [ ] 1.3 The DOM shim: the seven members core touches, plus serialization
      matching the golden serializer's attribute ordering and escaping
- [ ] 1.4 Parity test: render a golden fixture through the shim and assert the
      bytes equal the checked-in golden. Same-engine byte parity is the
      project's contract, and a second renderer that quietly disagrees would
      break it silently

## 2. Server surface

- [ ] 2.1 Server factory with `check_diagram`, including the error/warning
      counts, and input schemas
- [ ] 2.2 `render_diagram`, returning SVG through the shim
- [ ] 2.3 Tool descriptions carrying the two traps — coordinates are yours,
      text is never measured — with a test asserting both phrases are present,
      since a description nobody checks is a description that rots
- [ ] 2.4 Resources: spec, JSON Schema, the three examples, constants. Each
      read from its existing single source at build time
- [ ] 2.5 A test per resource asserting served bytes equal source bytes, so a
      resource cannot drift from the file it mirrors
- [ ] 2.6 Purity test: the tools reach no network and no filesystem — a source
      scan in the same spirit as core's determinism test, since this is what
      the unauthenticated hosting rests on

## 3. Transports

- [ ] 3.1 stdio entry and `bin`, verified by spawning the built server and
      completing an initialize / list-tools / call-tool round trip
- [ ] 3.2 Worker `fetch` entry serving Streamable HTTP at `/mcp`, with a test
      asserting the tool and resource surface is identical to stdio's
- [ ] 3.3 Pin the SDK deliberately: the SDK's own docs use the scoped
      `@modelcontextprotocol/server` layout while Cloudflare's MCP example
      still shows the older `@modelcontextprotocol/sdk` one. Verify which the
      Worker path needs at the version chosen, and record it
- [ ] 3.4 `wrangler.toml`, and a deploy script that is never run by CI

## 4. Documentation and release

- [ ] 4.1 `packages/mcp/README.md`: registration for stdio clients with a
      pinned version, the hosted URL, the `PATH` caveat, and the purity
      guarantee that explains why the hosted server needs no credentials
- [ ] 4.2 Root README section pointing at it
- [ ] 4.3 A changeset: **minor** on `@pensketch/mcp`
- [ ] 4.4 **OWNER**: deploy the Worker and record the URL
- [ ] 4.5 **OWNER**: publish, then register it locally and confirm a real
      client lists both tools and every resource

Gate: all verification commands green, `openspec validate mcp-server
--strict` green, a real client completing a `check_diagram` round trip.
