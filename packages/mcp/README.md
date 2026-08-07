# @pensketch/mcp

> An MCP server for pensketch: check a diagram, render it, and look at it.

Hand-sketched SVG diagrams from plain data — for an agent that has to write
the data without seeing the result.

## Register it

```sh
claude mcp add pensketch -- npx -y @pensketch/mcp@0.1.1
```

Or, for a client configured by file:

```json
{
  "mcpServers": {
    "pensketch": {
      "command": "npx",
      "args": ["-y", "@pensketch/mcp@0.1.1"]
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

## Three tools

| tool | what it does |
|---|---|
| `check_diagram` | Reports overlapping boxes, a label a connector will be drawn through, text too wide for its box, a node half out of its lane, a node no edge names. Draws nothing. |
| `render_diagram` | Returns SVG markup. Deterministic: same diagram, same seed, same bytes. |
| `render_png` | Rasterises it, so it can actually be looked at. |

Run `check_diagram` before rendering and again after moving anything. It is
the only one of the three that answers *does this fit* — see the font note
below for why the picture cannot.

## Seven resources

| uri | what it holds |
|---|---|
| `pensketch://spec` | The whole type surface, the constants worth designing around, every error the renderer throws, and the traps a type system cannot express. Read this first. |
| `pensketch://schema` | JSON Schema for a diagram, generated from the TypeScript types. |
| `pensketch://example/{pipeline,lifecycle,oauth,atm}` | Four complete diagrams with real coordinates — a CI pipeline, an order lifecycle, an OAuth flow, an ATM state machine. The two that draw with `raw` carry a `rawOmitted` line saying which stroke the served copy is missing and why, since functions cannot cross JSON. |
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
