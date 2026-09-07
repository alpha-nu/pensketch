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
- [ ] 1.1 `packages/mcp/src/http.ts`: the transport and nothing else, over
      `createMcpHandler(() => createServer())`. No tool, resource or geometry
      knowledge enters this file, the rule `stdio.ts` already holds
- [ ] 1.2 The `node:http` bridge, if group 1.0 asks for one. Hop-by-hop
      headers are the framing trap: a prototype that forwarded them still
      served correctly, so a test asserts the response carries no
      `connection`, `transfer-encoding` or `keep-alive` rather than trusting
      an eye
- [ ] 1.3 `pensketch-mcp-http` bin entry, `files` and `exports` updated
- [ ] 1.4 A test that drives the handler through `fetch` without a socket,
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

- [ ] 4.1 gzip for text responses; **not** for `render_png` (measured 1.3x,
      paid on the loop). A test holds the exclusion, because "compress
      everything" is the obvious wrong default
- [ ] 4.2 README and `pensketch://spec`: how to run it, what it does not do
      (no auth), and the throughput ceiling a deployment inherits
- [ ] 4.3 Byte budgets in `tools/check-size.mjs` for the new entry
- [ ] 4.4 A changeset

## 5. Group boundary

- [ ] 5.1 `/swat` over the whole change
- [ ] 5.2 Every Truthful finding remediated
- [ ] 5.3 **OWNER** publish and tag
