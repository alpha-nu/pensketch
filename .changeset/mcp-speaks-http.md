---
'@pensketch/mcp': minor
---

The server speaks HTTP. `pensketch-mcp-http` listens; `createHandler()` from
`@pensketch/mcp/http` is the web-standard `fetch` shape a Worker, Bun or Deno
deployment exports directly. Stdio is untouched, and the same factory backs
both, so no tool can observe which transport carried its call.

**SVG only over HTTP, and that is the whole design.** `render_png` is not
served there. The rasterizer is synchronous WebAssembly and holds the event
loop for the whole of a raster — 2.4 s measured on a 1760 × 1000 frame at 2×,
and eight concurrent rasters measured a 1.01× speedup over running them one
after another, which is to say none. Under stdio each client owns a process
and that is its own business. In a process serving many clients it is
everybody else's latency, including the 1.6 ms `check_diagram` calls queued
behind it. The tool is absent from the HTTP tool list rather than present and
refusing, because a description an agent cannot act on is tokens it paid for
and a turn it may spend finding out.

**Read this before deploying it.** There is no authentication of any kind, so
it binds `127.0.0.1` by default and anything else wants a proxy in front
deciding who may reach it — that proxy is also what compresses, and the
transport deliberately does not. Host and Origin are validated on every
request: a browser will send a cross-origin request to `127.0.0.1` on behalf
of any page the user has open, so an unguarded local endpoint is reachable by
every site they visit. Throughput is one core's worth of drawing; run more
processes.

Transport cost is a rounding error next to that. Measured over loopback,
warm: `check_diagram` 0.4 ms over stdio against 1.6 ms over HTTP, a small
`render_diagram` 0.6 ms against 2.3 ms. A flat ~1.5 ms, whatever the payload.

The tarball shrinks despite growing: 270 KB packed before, **152 KB** now.
Four entries each inlining their own copy of the SDK packed at 535 KB, and as
shared chunks at 152 — less than two entries managed, because the duplication
predated the fourth.
