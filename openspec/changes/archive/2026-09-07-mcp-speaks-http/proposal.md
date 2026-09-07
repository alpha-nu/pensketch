# Proposal: mcp-speaks-http

> The server gains a second transport, so a hosted instance can answer web
> clients over HTTP. The transport is nine lines. The work is everything that
> stops one blocking call from freezing every other caller, which stdio never
> had to care about because it hands each client its own process.

## Why

**The transport itself is already anticipated.** `createServer()` in
`packages/mcp/src/index.ts` takes no transport and its own comment says
adding a second one "is additive rather than a rewrite". The SDK's
`createMcpHandler(factory)` takes exactly the factory shape `createServer`
already is. A working HTTP server was stood up against the published 0.7.0
build and measured before this proposal was written.

**Transport cost is a rounding error; the rasterizer is not.** Measured over
loopback against stdio, warm, median:

| call | stdio | HTTP | +40ms/way |
|---|---|---|---|
| `check_diagram` | 0.4 ms | 1.6 ms | 89.9 ms |
| `render_diagram` small | 0.6 ms | 2.3 ms | 90.0 ms |
| `render_png` @2x | 80.5 ms | 79.4 ms | 170.5 ms |
| `render_png` large @2x | 2416 ms | 2382 ms | 2457 ms |

HTTP costs a flat ~1.5 ms of protocol overhead regardless of payload size.

**One process serving many clients is the whole risk.** `Resvg(...).render()`
in `render.ts` is synchronous WebAssembly, so it pins the event loop. Eight
concurrent `render_png` @2x measured a **1.01x speedup** over sequential:
fully serialized, over stdio and over HTTP alike. Under stdio that is
invisible, because every client owns a process. Hosted, a single large raster
freezes every other request in flight, including the 1.6 ms `check_diagram`
calls queued behind it. Ceilings per process: ~38/s at @1x, ~12/s at @2x,
**0.41/s** for a large diagram at @2x.

**The existing guard bounds the wrong quantity.** `MAX_PIXELS` caps the
longest side at 4096. Small @4x is 7.14 MP and takes 288 ms; large @2x is
7.04 MP and takes 2416 ms. Same pixels, **8.4x the time** — cost tracks path
geometry, not area, so today's limit permits a 2.4-second call while
claiming to be a limit.

## What changes

- **A transport.** `packages/mcp/src/http.ts` beside `stdio.ts`, holding the
  transport and nothing else, exactly as `stdio.ts` does. A `pensketch-mcp-http`
  bin entry.
- **Rasterization leaves the event loop.** A `worker_threads` pool; each
  worker pays the measured 62 ms WASM+font init once. Cheap calls stop
  queueing behind expensive ones.
- **A cost bound that matches the cost.** A budget over what actually drives
  raster time, plus a wall-clock ceiling, replacing a side-length cap that
  does not predict it.
- **Compression.** gzip for SVG, measured at **2.8x**. Not for `render_png`:
  base64 PNG compresses **1.3x**, which is undoing base64's own inflation,
  and paying CPU for it on the blocked loop is a net loss.

## Non-goals

- **Authentication.** `createMcpHandler` passes `authInfo` through and
  verifies nothing. Whatever fronts a deployment owns that.
- **Retiring stdio.** It stays the default and the published `bin`.
- **Multi-tenancy, quotas, billing.** A single-tenant server is the scope.
- **Replacing base64 image content with resource links.** Worth doing and
  measured at a 33% saving, but it is a protocol-shape decision for its own
  change.

## Owner calls this change needs

1. **Where it deploys**, which decides whether the entry is `node:http`, a
   fetch-handler for an edge runtime, or both. The transport is written
   against the web-standard `fetch` shape either way, so this is a packaging
   question, not a rewrite.
2. **Whether `render_png` is served at all over HTTP.** It is the only
   expensive tool. Serving SVG only would remove the worker pool from this
   change entirely and cut it to roughly a day.
