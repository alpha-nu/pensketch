---
'@pensketch/mcp': minor
---

The server speaks HTTP. `npx @pensketch/mcp http 3000` listens, and
`createGuardedHandler()` from `@pensketch/mcp/http` is the web-standard
`fetch` shape a Worker, Bun or Deno deployment exports directly. Stdio is
untouched, and the same factory backs both, so no tool can observe which
transport carried its call.

A subcommand rather than a second bin, deliberately: `npx <package>` runs a
package's only bin without being told its name, which is what the register
line in every existing config does. A second bin makes that ambiguous and npm
refuses it outright, so `pensketch-mcp` stays the one name and `http` is an
argument to it.

**SVG only over HTTP, and that is the whole design.** `render_png` is not
served there. The rasterizer is synchronous WebAssembly and holds the event
loop for the whole of a raster - 2.4 s measured on a 1760 x 1000 frame at 2x,
and eight concurrent rasters measured a 1.01x speedup over running them one
after another, which is to say none. Under stdio each client owns a process
and that is its own business. In a process serving many clients it is
everybody else's latency, including the 1.6 ms `check_diagram` calls queued
behind it. The tool is absent from the HTTP tool list rather than present and
refusing, because a description an agent cannot act on is tokens it paid for
and a turn it may spend finding out.

Transport cost is a rounding error next to that. Measured over loopback,
warm: `check_diagram` 0.4 ms over stdio against 1.6 ms over HTTP, and a small
`render_diagram` 0.6 ms against 2.3 ms. A flat ~1.5 ms, whatever the payload.

**Read this before deploying it.** There is no authentication of any kind, so
it binds `127.0.0.1` by default, and anything else wants a proxy in front
deciding who may reach it - that proxy is also what compresses, and the
transport deliberately does not. Binding a non-loopback address requires
`allowedHosts`, and `serve` throws rather than binding without it, because the
rebinding guard would otherwise refuse every request that arrived. Host and
Origin are validated on every one: a browser will send a cross-origin request
to `127.0.0.1` on behalf of any page the user has open, so an unguarded local
endpoint is reachable by every site they visit. Throughput is one core's worth
of drawing; run more processes.

**A diagram is now capped at 500 nodes, 50 edges, and 500 braces or notes, on
both transports.** This narrows an existing contract, so it is the one thing
here a stdio caller can notice: a diagram over those counts worked before and
is refused now.

The two numbers differ because the two costs do, and the first draft of this
release got that wrong. Several of the checker's rules compare every pair, so
the work grows with the square - but a curved edge is sampled into many chords
before each crossing test, so edges cost far more per pair than nodes. 500
overlapping nodes is 67 ms. 500 bowed edges is minutes. A cap of 500 on both,
justified by the node measurement alone, still admitted a request that blocked
the loop longer than the 2416 ms raster this transport declines to serve for
exactly that reason. Measured on a hub with n spokes: 50 bowed edges is 593
ms, 100 is 2.5 s, 200 is 9.8 s. Braces and notes are cheap - 200 of them cost
39 ms - and stay at 500. HTTP additionally caps a request body at 1 MB,
because the item refusal is downstream of parsing.

`require()` of this package now works, and never has: `render.ts` calls
`createRequire(import.meta.url)` and esbuild left that expression in the CJS
output, so both published `require` conditions threw on load. `tsup` gains
`shims`, and the exports gate - the only thing in the repository that loads
`dist/` - gains this package, which it had never been asked about.

The tarball shrinks despite growing: 270 KB packed before, **162 KB** now,
measured 2026-09-07. Four entries each inlining their own copy of the SDK
packed at 566 KB, and as shared chunks at 162 - less than two entries managed,
because the duplication predated the fourth. The CJS shims above account for
1 KB of that, which is what a working `require` costs.
