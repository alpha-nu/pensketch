# Design: mcp-server

Technical decisions for `@pensketch/mcp`. The delta spec states the
requirements; this file fixes the tool and resource surface, the transport,
and records the three decisions the owner settled.

## D1 — Tools

```
check_diagram(diagram, viewBox?, options?)       -> { findings: Finding[], errors: number, warnings: number }
render_diagram(diagram, viewBox, seed?, theme?)  -> { svg: string }
render_png(diagram, viewBox, seed?, theme?, scale?) -> image content
```

`check_diagram` is `@pensketch/core/check` with an input schema and a count
summary. The summary exists so a caller can branch on "is this clean" without
reading the array.

`render_diagram` returns SVG text — for writing to a file, diffing, or handing
to a human.

`render_png` returns an image, because SVG does not give sight: a caller
handed `<path d="M40 90 C41.2 88.7…">` is reading a few thousand numbers, not
looking at a picture.

The two rendering tools answer different questions, and the descriptions say
so. **`render_png` is trustworthy about structure** — overlapping boxes, an
arrow pointing at nothing, a lane left empty — and **is not trustworthy about
text fit**, because the font it draws with is not the font the reader will
see (D3). `check_diagram` is the authority on fit and clearance; its estimate
is calibrated against the documented stack, and the PNG's is not.

`render_png` SHALL bound its own output. Images are returned base64-encoded
and land in the caller's context window, so `scale` defaults to 1 and the
rendered pixel dimensions are capped; a caller asking for more is refused
rather than quietly handed a quarter-megabyte of base64.

Tool descriptions carry the two facts an agent gets wrong first, because a
description is read before any resource is fetched: **coordinates are yours,
nothing is laid out for you**, and **text is never measured, so a box does not
grow to fit its label**.

## D2 — Resources

| uri | content | source |
|---|---|---|
| `pensketch://spec` | the agent-facing spec: type surface, hard rules, the constants that matter | `AGENTS.md` |
| `pensketch://schema` | JSON Schema for `Diagram` | the generated schema |
| `pensketch://example/{pipeline,lifecycle,oauth}` | the three shipped diagrams, as data | `examples/` |
| `pensketch://constants` | the frozen constants and their values | `@pensketch/core` |

Every one is served from something that already exists for another reason. The
server publishes; it does not restate. A resource that drifts from the file it
mirrors is the failure mode to design out, so each is read at build time from
its single source, and a test asserts the served bytes match that source.

The examples are resources rather than prose because that is what actually
taught the fastest: rebuilding this repository's examples, one complete worked
diagram with real coordinates was worth more than the field tables, because it
carried proportion — that a box is about 150×52, that rows sit about 80 apart,
that a connector crossing the 34 px gap between rows leaves no room for a
label beside it.

## D3 — Rendering without a browser

### SVG, in core

`draw` touches exactly seven DOM members, all reached through
`svg.ownerDocument`:

```
createElementNS · appendChild · setAttribute · textContent
firstChild · removeChild · querySelector
```

That this list is complete is not an observation to re-check by hand — a
source-scanning test already fails the build if package source reaches for a
global `document`, and a second test renders into an `<svg>` from an
independently constructed DOM.

So the shim is about fifty lines: an element with attributes, children and
text, plus a serializer. No jsdom, no browser, no native code, which is what
lets it run wherever JavaScript does.

It lives in **`@pensketch/core/server`** as `renderToString(diagram, options)`,
not in this package. It is a zero-dependency pure function over public types,
and the argument that put `check` in core applies unchanged: burying it behind
a server means the only way to reuse it is to install a server. Static site
generators, CI badge renderers and test helpers want it too. The subpath
mirrors `react-dom/server`, which is the convention readers already know.

Serialization SHALL match the attribute ordering and escaping already used by
the golden serializer, so that SVG produced this way and SVG produced by a
browser can be compared directly — and a test SHALL do exactly that against a
checked-in golden, because a second renderer that quietly disagrees would
break the byte-parity contract silently.

### PNG, in the server

`@resvg/resvg-wasm` rasterizes. It draws text only with fonts handed to it as
`fontBuffers`, so the server embeds one.

**WebAssembly rather than the native binding.** `@resvg/resvg-js` is faster,
but ships per-platform native binaries as optional dependencies, and this
package is fetched by `npx`
on machines nobody has tested — an unusual platform, a restricted network, a
locked-down CI box. A native install failure there produces a server that will
not start, which is a bad outcome for a tool whose entire job is to be
available when an agent reaches for it. One universal artefact is worth the
speed.

**It cannot be the real one.** The documented stack is `Chalkboard SE`,
`Bradley Hand`, `Segoe Print`, `Comic Sans MS` — proprietary Apple and
Microsoft system faces, none redistributable. The server therefore embeds an
open-licence handwriting face, and **the font SHALL be selected by
measurement**: the candidate whose mean glyph-advance factor sits closest to
the documented stack's measured 0.462 wins, so the substitution distorts text
metrics as little as it can.

`loadSystemFonts` SHALL be `false`, always. The tempting alternative — let the
server pick up the user's real Chalkboard SE, which on a Mac it would find —
is rejected deliberately: it would make the same call return different images
on different machines, in a project whose entire identity is same input, same
bytes. Determinism beats fidelity here, and the tool description says the text
is a stand-in.

The embedded face SHALL be subset to the glyphs a diagram can contain. There
is no platform ceiling to meet, but the whole package is fetched by `npx` on
first use and a face nobody needs in full is latency the user pays for.

## D4 — Transport

**stdio only.** A `bin` entry, so `npx @pensketch/mcp` works in any client
that spawns a process:

```
claude mcp add pensketch -- npx -y @pensketch/mcp@<version>
```

or the equivalent `mcpServers` JSON in Claude Desktop, Cursor, VS Code or Zed.

Documentation SHALL pin a version in that invocation. `-y` alone fetches
whatever is latest, which is the wrong default for something a client spawns
unattended. Documentation SHALL also state that Node must be on `PATH` in the
client's environment, because a GUI-launched client often has a minimal one
and that is the most common failure report for npx-distributed servers.

The implementation is nonetheless arranged as a **server factory plus a thin
transport entry**, which is the layout the SDK's own examples use. That costs
nothing now and is what makes an HTTP transport additive later rather than a
rewrite — see the Non-goals in the proposal for why it is not being built.

### The SDK, established rather than assumed

Both layouts are published and current, so the choice is real:

| | `@modelcontextprotocol/sdk` **1.30.0** | `@modelcontextprotocol/server` **2.0.0** |
|---|---|---|
| runtime dependencies | 17 — express, hono, cors, jose, ajv, express-rate-limit, pkce-challenge, eventsource… | 2 — `@modelcontextprotocol/core`, `zod` |
| shape | one package, deep subpath imports | split packages |

**`@modelcontextprotocol/server` at `^2.0.0`.** Owner decision, 2026-08-07,
caret rather than exact. Publishing stdio-only makes the monolith's HTTP
stack — two web servers, CORS, JWT, rate limiting — weight an `npx` user
downloads and no code here ever calls.

Read off the installed package rather than off an example, because most
material still in circulation shows the 1.x layout and would have compiled
into something subtly different:

- `@modelcontextprotocol/server` → `McpServer`, `Server`, `InMemoryTransport`,
  the HTTP transports, the protocol constants.
- `@modelcontextprotocol/server/stdio` → `serveStdio`, `StdioServerTransport`.
- `serveStdio(factory: McpServerFactory, options?)` takes a **factory**,
  `(ctx) => McpServer | Server | Promise<…>` — the split this design already
  wanted, handed over by the SDK rather than imposed on it.
- `registerTool(name, { inputSchema: z.object({…}) }, handler)`. Note the
  shape: 2.x wants a zod **object**, where 1.x took a bare map of field
  schemas. An example written against 1.x compiles here and validates
  nothing.
- The low-level `Server` accepts raw JSON Schema, which is the door to
  reusing the schema this project already generates rather than restating a
  diagram's shape in zod.

Every tool stays a pure function of its arguments — no network, no filesystem,
no state. With nothing to host that is not a security argument, it is a
correctness one: it is what makes the tools deterministic, testable without
fixtures, and safe to run inside any sandbox. **This is a requirement, not a
description**, so a later tool that reads a URL has to argue for itself rather
than slip in.

## D6 — Decisions taken, and why

**O1 — the DOM shim is promoted to core**, as `@pensketch/core/server`
exporting `renderToString`. Owner decision, 2026-08-06. `/server` over
`/string` because it mirrors `react-dom/server` and names the context rather
than the return type, and it gives the package a consistent shape: the subpath
says where you are, the export says what you want — `/check` → `check`,
`/server` → `renderToString`.

**O2 — the server rasterizes**, as a third tool. Owner decision, 2026-08-06.
The honest limits are written into D1 and D3 rather than discovered later:
the PNG is authoritative about structure and not about text fit, because its
font is a stand-in. `check_diagram` remains the authority on fit, and it is
calibrated against the real stack.

**O3 — stdio only, no hosted server.** Owner decision, 2026-08-06. Hosting was
this design's own suggestion rather than a requirement, and it carried a
deploy step, a URL, an authentication question and a platform size ceiling for
the sake of browser-based clients alone. D4 keeps the factory/transport split
so adding it later is an entry point, not a redesign.
