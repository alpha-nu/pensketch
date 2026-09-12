# @pensketch/mcp

> An MCP server for pensketch: check a diagram, render it, and look at it.

Hand-sketched SVG diagrams from plain data — for an agent that has to write
the data without seeing the result.

## Register it

```sh
claude mcp add pensketch -- npx -y @pensketch/mcp@0.9.0
```

Or, for a client configured by file:

```json
{
  "mcpServers": {
    "pensketch": {
      "command": "npx",
      "args": ["-y", "@pensketch/mcp@0.9.0"]
    }
  }
}
```

Pin the version. `npx` without one fetches whatever is latest at the moment
your client happens to start, which is a strange way to decide what your tools
do.

**Node must be on the `PATH` your client sees.** A GUI-launched client often
has a minimal environment that does not include the Node you installed with a
version manager, and the symptom is a server that never starts with nothing
useful in the log. If that happens, give the absolute path to `node` as the
command.

## Or serve it over HTTP

```sh
npx -y @pensketch/mcp@0.9.0 http 3000
```

A subcommand rather than a second bin, deliberately: `npx <package>` runs a
package's only bin without being told its name, which is what the register
line above does, and a second bin makes that ambiguous — npm refuses it with
`could not determine executable to run`. `ALLOWED_HOSTS` is how you bind
anything but loopback.

For a client that reaches a server over the network rather than spawning one.
The handler is also importable, as the web-standard `fetch` shape a Worker, a
Deno Deploy project or a Bun deployment exports directly:

```js
import { createGuardedHandler } from '@pensketch/mcp/http';

export default createGuardedHandler({ allowedHosts: ['mcp.example.com'] });
```

That entry reaches no Node built-in, which is what lets an edge runtime load
it, and it is checked by bundling rather than by inspection. The listener is a
separate entry — `import { serve } from '@pensketch/mcp/serve'` — because
binding a socket needs `node:http`, and one entry holding both put that into
the graph of every consumer.

`createHandler()` is the same thing without the Host and Origin checks, for a
deployment already behind something that does them. Reach for it deliberately:
those checks are what stop every page the user has open from reaching the
endpoint.

Read this part before you deploy it.

- **`render_png` is not served over HTTP.** The rasterizer is synchronous
  WebAssembly and holds the event loop for the whole of a raster — 2.4 s
  measured on a 1760 × 1000 frame at 2×. Under stdio each client owns a
  process and that is its own business; in a process serving many clients it
  is everybody else's latency. It is absent from the tool list rather than
  present and refusing, because a tool description an agent cannot act on is
  tokens it paid for. Use stdio when you want pictures.
- **There is no authentication.** None. It binds `127.0.0.1` by default for
  that reason, and anything else needs a proxy in front deciding who may
  reach it. That proxy is also what compresses the responses; the transport
  does not.
- **Binding anything but loopback needs `allowedHosts`,** and `serve()` throws
  without it rather than binding. The rebinding guard would otherwise refuse
  every request for naming a host nobody configured. Whichever name reaches
  *this* server is the one to list: most proxies preserve the client's `Host`
  — Caddy's `reverse_proxy` and Traefik do — while nginx's default
  `proxy_set_header Host $proxy_host` rewrites it to the upstream.
- **Host and Origin are validated on every request.** A browser will send a
  cross-origin request to `127.0.0.1` on behalf of any page the user has open,
  so an unguarded local endpoint is reachable by every site they visit.
- **A diagram is capped at 500 nodes, 50 edges, and a body at 1 MB.** Several
  of the checker's rules compare every pair, so the work grows with the
  square — and the two numbers differ because the two costs do. 500
  overlapping nodes is 67 ms; 500 *bowed* edges is minutes, because a curve is
  sampled into many chords before each crossing test. Measured on a hub with
  n spokes: 50 bowed edges is 593 ms, 100 is 2.5 s, 200 is 9.8 s. 50 keeps the
  expensive shape four times under the 2416 ms raster this transport declines
  to serve for the same reason, and is three times the largest diagram this
  repository ships. Braces and notes are cheap — 200 of them cost 39 ms — and
  stay at 500. The caps apply on stdio too; a bound the project does not run
  against itself is not a bound.
- **The ceiling is one process.** Measured over loopback, HTTP costs a flat
  ~1.5 ms of protocol overhead on top of a call: `check_diagram` 0.4 ms → 1.6
  ms, a small `render_diagram` 0.6 ms → 2.3 ms. Drawing is CPU on the same
  loop, and a capped diagram still costs up to ~120 ms of it, so throughput is
  what one core gives you. Run more processes.
- **There is no rate limiting**, here or in any MCP server surveyed, or in the
  protocol. Whatever fronts this owns it.

Both transports serve identical results: the same factory backs them, and no
tool can observe which one carried its call.

## Four tools

| tool | what it does |
|---|---|
| `check_diagram` | Reports overlapping boxes, a label a connector or a brace will be drawn through, text too wide for its box, a node half out of its lane, a node no edge names. Draws nothing. |
| `render_diagram` | Returns SVG markup, and beside it the layout findings for the drawing it just made. The markup is first and the findings second, so one call both draws and checks. Deterministic: same diagram, same seed, same bytes. |
| `render_png` | Rasterises it, so it can actually be looked at. |
| `get_schema` | Returns the JSON Schema for a diagram — the same document as the `pensketch://schema` resource, as a tool, because many clients cannot read MCP resources at all. |

Every diagram is validated against that schema before anything draws. An
unknown field at any depth, an edge end that is not a `["nodeId", "side"]`
tuple, an anchor letter that is not one of `t b l r` — each is refused by
name with every defect in one reply, instead of drawing an empty box or
surfacing as a `TypeError`. A clean `check_diagram` and a refused
`render_diagram` of the same bytes cannot happen: one validator stands in
front of both.

`render_diagram` answers *does this fit* for the drawing it hands back, so a
fix cycle is one call rather than two. Reach for `check_diagram` when you want
the findings without the markup, or before spending a `render_png` on a
diagram you have not checked — see the font note below for why the picture
cannot answer it for you.

## Eight resources

| uri | what it holds |
|---|---|
| `pensketch://spec` | The whole type surface, the constants worth designing around, every error the renderer throws, and the traps a type system cannot express. Read this first. |
| `pensketch://schema` | JSON Schema for a diagram, generated from the TypeScript types. |
| `pensketch://example/{pipeline,lifecycle,incident,atm,showcase}` | Five complete diagrams with real coordinates — a CI pipeline, an order lifecycle, an incident at the stage it has reached, an ATM state machine, and this library's own architecture, which is the one that reaches for the breadth of the data model in a single picture. All five are whole pictures: none of them draws with `raw` any more, so none carries the `rawOmitted` line that says which stroke a served copy is missing. One that did would. |
| `pensketch://constants` | Every aesthetic constant and its value, read from the installed renderer. |

Each mirrors a file that exists in the repository for another reason, and a
test asserts the served bytes match it. Nothing here is a restatement that can
quietly go stale.

## The font in the PNG is not the font in the SVG

`render_diagram` names the handwriting stack — `Chalkboard SE`, `Bradley
Hand`, `Segoe Print`, `Comic Sans MS` — so a browser draws your diagram in
whichever of those the reader has.

Those faces are proprietary and cannot be redistributed, and the WebAssembly
rasterizer draws text only with fonts handed to it. So `render_png` embeds
**Architects Daughter**, an open-licence face chosen by measurement: of five
candidates, its mean glyph advance sits closest to the documented stack's
(0.4807 against 0.4696), so text occupies about the right width even though
the letterforms differ.

What that means in practice:

- **The PNG is authoritative about structure.** Overlaps, an arrow pointing at
  nothing, an empty lane — trust it.
- **The PNG is not authoritative about fit.** Whether a label fits its box is
  `check_diagram`'s question, and its estimate is calibrated against the real
  stack.
- **Arrows and ticks do not draw.** `→ ← ↑ ↓ ✓ ✗` are absent from the face and
  no subset can add them; a label containing one shows a gap **in the PNG
  only**. The SVG and the checker are unaffected.

The font ships with its licence in `fonts/OFL.txt`.

## The PNG resolves its own colours, and comes on paper

`render_diagram` paints with `var(--ps-ink, …)` and friends, so a page
restyles the drawing — dark mode included — purely by redefining those
variables. The rasterizer resolves custom properties nowhere, and does not
honour the fallback either: an unparseable paint takes the property's initial
value, which draws nothing for `stroke` and black for `fill`. Handed that
markup it produced labels floating on a black slab, which is what `0.1.0`
shipped.

So `render_png` resolves the palette before rasterizing, and draws on warm
paper (`#FCFAF5`) rather than transparency — a transparent PNG of near-black
ink is invisible in a client with a dark panel, which is the same failure
wearing a different hat. `render_diagram` is unchanged and still themable.

## Every tool is a pure function of its arguments

No network, no filesystem, no state between calls. A test reads the source and
fails the build if a tool reaches for any of them. The server loads two files
of its own when it starts — the WebAssembly binary and the font, both resolved
by specifier, never from anything a caller sends — and nothing after that.

This is why the same arguments give the same answer, why the tools need no
fixtures to test, and why the server is safe to run inside a sandbox that
allows it nothing.

## Repository

Full documentation, the renderer itself and its React bindings live at
https://github.com/alpha-nu/pensketch.
