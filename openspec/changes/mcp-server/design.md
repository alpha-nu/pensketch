# Design: mcp-server

Technical decisions for `@pensketch/mcp`. The delta spec states the
requirements; this file fixes the tool and resource surface, the transports,
and the two decisions that need the owner rather than the implementer.

## D1 — Tools

```
check_diagram(diagram, viewBox?, options?)  -> { findings: Finding[], errors: number, warnings: number }
render_diagram(diagram, viewBox, seed?, theme?) -> { svg: string }
```

`check_diagram` is `@pensketch/core/check` with an input schema and a count
summary. The summary exists so a caller can branch on "is this clean" without
reading the array.

`render_diagram` returns SVG text. It is the confirmation step for a caller
that *can* see, and for one that cannot it is still useful as something to
write to a file for a human to open.

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
that 34 px is not enough room for a label beside a connector.

## D3 — Rendering without a browser

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
lets the same implementation run on a Worker.

Serialization SHALL match the attribute ordering and escaping already used by
the golden serializer, so that SVG produced by the server and SVG produced by
a browser can be compared directly.

## D4 — Transports

One server factory, two entries, matching the layout the SDK's own examples
use:

- **stdio** — `bin` entry, so `npx @pensketch/mcp` works in any client that
  spawns a process. Registration is `claude mcp add pensketch -- npx -y
  @pensketch/mcp`, or the equivalent `mcpServers` JSON in Claude Desktop,
  Cursor, VS Code or Zed.
- **HTTP** — a Worker `fetch` export serving Streamable HTTP at `/mcp`.

Documentation SHALL pin a version in the `npx` invocation. `-y` alone fetches
whatever is latest, which is the wrong default for something a client spawns
unattended. Documentation SHALL also state that Node must be on `PATH` in the
client's environment, because a GUI-launched client often has a minimal one
and that is the most common failure report for npx-distributed servers.

## D5 — Hosting

Cloudflare Workers. The payload is zero-dependency JavaScript plus the shim,
which is close to the ideal Worker: no native modules, no cold-start weight,
free tier sufficient.

Unauthenticated, deliberately. The server makes no network calls, touches no
filesystem, holds no secrets and keeps no state, so there is nothing to
protect and no reason to make every caller register. **This is a requirement,
not a description** — a future tool that reads a URL or writes a file would
invalidate it, and the spec says so, so that such a tool has to change the
hosting story rather than sneak past it.

## D6 — Open decisions, for the owner

Neither is a deferral; both need a call the implementer should not make alone.

**O1 — where the DOM shim lives.** In `@pensketch/mcp` it is private and free
to change. As a core subpath — `@pensketch/core/string`, exporting
`renderToString(diagram, options)` — it becomes reusable by static site
generators, Astro integrations and CI badge renderers, and semver-bound from
day one. The argument for promoting it is the same one that put the checker in
core: it is a zero-dependency pure function over public types, and burying it
behind a server means the only way to reuse it is to install a server. The
argument against is that server-side rendering is not currently anything the
project claims to support.

**O2 — whether to rasterize.** `check_diagram` exists so that seeing is not
required, and a text-only server stays tiny. If agents should be able to look
at the result anyway, the options are `resvg-wasm` on the Worker — a wasm blob,
no native dependencies — or Cloudflare Browser Rendering, which is a paid
binding. Adding it later is not a breaking change; it is a new tool.
