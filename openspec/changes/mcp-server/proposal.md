# Proposal: mcp-server

> `@pensketch/mcp` — an MCP server exposing the checker, a renderer, and the
> reference material an agent needs, over stdio and over HTTP.

## Why

An agent writing a pensketch diagram is working blind. It can produce valid
data — the types see to that — and still produce a picture with a connector
through a label, a node half out of its lane, or a caption wider than the box
around it. Nothing in the type system or in `draw` says so, because pensketch
deliberately does no layout.

`diagram-checker` turns that feedback into data. This change puts it where an
agent can reach it, together with the two other things that made the
difference when this repository's own examples were built: **worked examples**,
which taught proportion far faster than field tables did, and **the numbers
that matter** — default sizes, the jitter amplitude, the constants a caller
has to design around.

MCP is the way to hand all three to any agent harness at once, rather than
once per harness.

## What Changes

- **New package** `@pensketch/mcp`, published, run over stdio: `npx
  @pensketch/mcp` registers in any client that spawns a process, which is
  every desktop and editor client. No hosted server — see Non-goals.
- **Three tools**: `check_diagram`, which is `@pensketch/core/check` with a
  schema on it; `render_diagram`, which returns SVG; and `render_png`, which
  returns an image an agent can actually look at.
- **Four resources**: the agent-facing spec, the JSON Schema for `Diagram`,
  the three shipped example diagrams as data, and the frozen constants. All
  four are served from files that already exist in the repository for other
  reasons — the server publishes them, it does not restate them.
- **A new core subpath**, `@pensketch/core/server`, exporting
  `renderToString(diagram, options)`. Rendering without a DOM turns out to
  need about fifty lines, because core touches exactly seven DOM members and
  reaches all of them through `svg.ownerDocument`, which the determinism test
  already enforces. That is a zero-dependency pure function over public types,
  so it goes where the checker went rather than being buried behind a server —
  static site generators, CI badge renderers and test helpers want it too.

## Capabilities

### New Capabilities

- `mcp-server`: the tool and resource surface, transport shapes, the
  no-side-effects guarantee, and the rendering path that needs no browser

### Modified Capabilities

- `core-renderer`: a `renderToString` subpath, so a diagram can be rendered
  where there is no DOM
- `repo-tooling`: a third workspace package, a third core build entry, their
  dependency postures, and the release policy that now covers a package whose
  output is not a rendering

## Impact

- **npm**: one new public package, `@pensketch/mcp`, and a second new subpath
  on `@pensketch/core` — a **minor** on core, which stays dependency-free.
- **Dependency posture changes, and this is the notable one.** `@pensketch/mcp`
  carries the MCP SDK, a schema library, a WebAssembly rasterizer and one
  embedded font. The project invariant recorded in `CONTRIBUTING.md` reads "no
  runtime dependency in either package"; it was written when there were two.
  It SHALL be reworded to name `@pensketch/core` and `@pensketch/react`
  explicitly, so the rule stays true and keeps meaning what it meant: *the
  rendering packages* add nothing to a consumer's lockfile. The MCP server is
  a tool an agent runs, not code that ships inside a web page.
- **Depends on**: `diagram-checker`. `check_diagram` is that function.
- **Hosting**: none. Nothing to deploy, no URL to keep alive, no uptime.

## Non-goals

- **No diagram generation tool.** The agent writes the data; the server checks
  and renders it. A `make_me_a_diagram` tool would put layout in the server,
  which is the project's oldest non-goal.
- **No state.** No sessions, no stored diagrams, no history. Every call is a
  pure function of its arguments.
- **No network or filesystem access from the tools.** A tool that reads a URL
  is a tool whose output depends on something other than its arguments, which
  makes it untestable and non-deterministic — in a project whose whole claim
  is same input, same bytes. It is a requirement rather than a description.
- **No hosted server, for now.** stdio covers every client that spawns a
  process, which is every desktop and editor client. HTTP would buy only
  browser-based agents, and would bring hosting, a deploy step, a URL to keep
  alive, an authentication question and a platform size ceiling with it.
  Adding it later is additive — a second entry against the same server
  factory, which is how D4 is arranged — so nothing here forecloses it.
