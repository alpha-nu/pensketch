# Tasks: mcp-speaks-http

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent. Items marked
**OWNER CALL** are decided by the owner and then done by the agent.

Group 1 is blocked on the two owner calls in `proposal.md`. If `render_png`
is not served over HTTP, group 3 is dropped whole and this change is groups
1, 2 and 4.

## 1. The transport

- [x] 1.0 **OWNER CALL** Deployment target and whether `render_png` is
      served over HTTP at all

      **Decided 2026-09-06: SVG only over HTTP.** `check_diagram` and
      `render_diagram` are served; `render_png` stays stdio-only. Groups 2
      and 3 are dropped whole, because with no raster on the wire there is
      no event loop to unblock and no geometry budget to invent. The entry
      is written against the web-standard `fetch` shape with a `node:http`
      bridge, which is the packaging every other target also starts from.
- [x] 1.1 `packages/mcp/src/http.ts`: the transport and nothing else, over
      `createMcpHandler(() => createServer())`. No tool, resource or geometry
      knowledge enters this file, the rule `stdio.ts` already holds

      One exception, and it is about the transport rather than a tool:
      `raster: false`. A source test holds the rest.
- [x] 1.2 The `node:http` bridge, if group 1.0 asks for one

      **Not hand-rolled.** The SDK ships `toNodeHandler` in
      `@modelcontextprotocol/node`, and the docs name it as the way a Node
      framework wraps a handler. It owns the conversion, so the hop-by-hop
      trap this task anticipated is the adapter's problem and not ours.

      What the adapter also ships is the half nobody had planned for:
      `localhostHostValidation` and `localhostOriginValidation`. A browser
      sends a cross-origin request to `127.0.0.1` for any page the user has
      open, so an unguarded local endpoint is reachable by every site they
      visit. That is asserted over a real socket, because it is a security
      property rather than plumbing.

      Cost: one transitive dependency, `@hono/node-server`. `hono` itself is
      an optional peer and is not installed.
- [x] 1.3 `pensketch-mcp-http` bin entry, `files` and `exports` updated
- [x] 1.4 A test that drives the handler through `fetch` without a socket,
      the way `index.ts` is testable without a process

## 2. Cost bounds that predict cost — DROPPED by 1.0

*`render_png` is not served over HTTP, so nothing shared is at risk. The
measured mismatch (7.14 MP in 288 ms against 7.04 MP in 2416 ms) is recorded
in `proposal.md` and stays true; it is simply not this change's problem.*

<details><summary>Original tasks</summary>

- [ ] 2.1 Replace the `MAX_PIXELS` side cap with a budget over what drives
      raster time. The two measured points the model must separate: 720x620
      @4x = 7.14 MP in 288 ms, and 1760x1000 @2x = 7.04 MP in 2416 ms
- [ ] 2.2 A wall-clock ceiling per raster, so an unforeseen shape is refused
      rather than served slowly
- [ ] 2.3 The refusal names the fix, the rule `refuses()` already sets

</details>

## 3. Rasterization off the event loop — DROPPED by 1.0

<details><summary>Original tasks</summary>

- [ ] 3.1 A `worker_threads` pool around `rasterize`; WASM and font init once
      per worker, the 62 ms measured here
- [ ] 3.2 `render.ts` keeps its purity rule: a worker is a process detail,
      not an argument a tool reads
- [ ] 3.3 A test that proves the fix by the measurement that found the
      defect: N concurrent `render_png` against N sequential. Today that
      ratio is 1.01x. A pool of W must move it, and the test asserts the
      movement rather than asserting a pool exists
- [ ] 3.4 A cheap call is not blocked by an expensive one: `check_diagram`
      latency measured while a large raster is in flight

</details>

## 4. Serving and documentation

Two items here are marked `[ ]` with a reason rather than `[x]`, on the
terms groups 2 and 3 already use. Nothing was built for either, and a ticked
box that means "decided not to" reads as "done" to anyone scanning.

- [ ] 4.1 gzip for text responses; **not** for `render_png` — NOT BUILT

      **Not implemented, and the reason is not laziness.** The exclusion this
      task was written to enforce is moot: `render_png` is not served here at
      all, so everything on this wire is text and there is nothing to exclude.

      What is left is whether the transport should compress. It should not.
      The entry binds loopback and tells an operator to put a proxy in front,
      because it has no authentication - and every such proxy compresses
      already. In-process gzip would duplicate that for the recommended
      deployment, spend CPU on the very event loop the SVG-only decision
      exists to protect, and grow the "transport and nothing else" file a
      branch for SSE, which must not be buffered. Priced against the one
      deployment it helps - a bare port on a routable address, which this
      change advises against - it is not worth its own bug surface.

      Stated in the spec, so an operator reads it as a decision rather than
      finding a gap.
- [x] 4.2 README and `pensketch://spec`: how to run it, what it does not do
      (no auth), and the throughput ceiling a deployment inherits

      Both READMEs carry it. **`pensketch://spec` does not, deliberately.**
      That resource is `docs/agents.md`, the data-model reference a caller
      reads before writing a node; it names no tool anywhere and says nothing
      about rasterizing, so a deployment section there would be off-topic
      prose every agent pays for on a read the proposal already calls
      expensive. A caller learns which tools exist from `tools/list`, which is
      accurate per transport by construction.
- [ ] 4.3 Byte budgets in `tools/check-size.mjs` for the new entry — SUPERSEDED

      **Superseded by the live spec, which forbids it.** `@pensketch/mcp`
      SHALL NOT carry a byte budget - it is spawned, never bundled into a
      page - and the HTTP entry is no different. What the spec does require is
      the packed tarball, which the gate reports and which this change moved
      from 270 KB to 165 KB. The delta amends the splitting rule instead.
- [x] 4.4 A changeset

## 5. Group boundary

- [x] 5.1 `/swat` over the whole change
- [x] 5.2 Every Truthful finding remediated

      T-23 to T-32. The blocker was T-23: `render_png` was excluded for
      holding the loop 2.4 s, and `render_diagram` could be made to hold it
      longer and then run out of memory, which made the whole SVG-only
      argument false until a bound existed.
- [ ] 5.3 **OWNER** publish and tag
