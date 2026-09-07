---
'@pensketch/mcp': minor
---

The server speaks HTTP. `npx @pensketch/mcp http 3000` listens, and
`createGuardedHandler()` from `@pensketch/mcp/http` is the web-standard `fetch`
shape a Worker, a Deno Deploy project or a Bun deployment exports directly.
Stdio is untouched, and the same factory backs both, so no tool can observe
which transport carried its call.

That second claim was made once before without being tested, and was false:
the entry dragged `node:http` behind it and no edge runtime could load it. It
is now two entries. `@pensketch/mcp/http` is the handler and reaches no Node
built-in; `@pensketch/mcp/serve` is the listener and reaches the ones binding a
socket needs. `npm run edge` bundles the first for a worker target and fails on
any built-in that finds its way back in - which is the only way to see it, since
neither of the two breaks it has caught was visible in the source.

A subcommand rather than a second bin, deliberately: `npx <package>` runs a
package's only bin without being told its name, which is what the register line
in every existing config does. A second bin makes that ambiguous and npm
refuses it outright, so `pensketch-mcp` stays the one name and `http` is an
argument to it.

**SVG only over HTTP, and that is the whole design.** `render_png` is not
served there. The rasterizer is synchronous WebAssembly that holds the event
loop for the whole of a raster - 2.4 s measured on a 1760 x 1000 frame at 2x -
and loads its WebAssembly off a filesystem an edge runtime does not have. Under
stdio each client owns a process and that is its own business; in a process
serving many clients it is everybody else's latency.

Absent from the tool list rather than present and refusing, because a
description an agent cannot act on is tokens it paid for. And absent from the
module graph rather than switched off: the tool set is decided by which factory
a transport calls, not by a flag. The flag was the bug - a module holding
`raster: false` still imported the rasterizer it was declining, so the WASM
travelled into every graph that imported the tools.

**Read this before deploying it.** There is no authentication of any kind. The
protocol permits that - authorization is optional in the MCP specification, and
public servers do run this way - but it means anything you expose is reachable
by whoever finds it. It binds `127.0.0.1` by default for that reason, and
anything else wants a proxy in front deciding who may reach it; that proxy is
also what compresses, and the transport deliberately does not. Binding a
non-loopback address requires `allowedHosts`, and `serve` throws rather than
binding without it. Host and Origin are validated on every request: a browser
will send a cross-origin request to `127.0.0.1` on behalf of any page the user
has open.

Throughput is one core's worth of drawing; run more processes. Measured over
loopback, warm, HTTP costs a flat ~1.5 ms on top of a call: `check_diagram`
0.4 ms against 1.6 ms, a small `render_diagram` 0.6 ms against 2.3 ms. Every
diagram this repository ships renders and checks in under 4.2 ms of CPU, the
largest of them - 20 nodes, 16 edges - in 4.18.
