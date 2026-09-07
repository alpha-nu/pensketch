# Proposal: fewer-turns-fewer-tokens

> Three changes that cost an agent fewer turns and fewer tokens to draw the
> same diagram. None of them is a transport optimisation, which is the point:
> transport is about 1% of an agent flow and reasoning is the rest.

## Why

**Measured, not assumed.** A fixed scenario was run against published 0.7.0
and recorded in `BASELINE.md`: **3 model turns, 3 tool calls, 1,406 tokens**
of diagram emitted across two attempts, because the first attempt overflowed
two labels and the fix needed a second `check` before a render was safe.

**A turn is 50-100x the tool call it carries.** `check_diagram` answers in
0.4 ms over stdio and 1.6 ms over HTTP. The model turn wrapped around it is
seconds. Anything that removes a turn is worth more than anything that
removes milliseconds, and the two are not in competition: these levers pay on
the stdio server shipping today, to every existing user, whether or not the
server is ever hosted.

**The extra turn is designed in.** `render_diagram` returns markup and
nothing else, and `check_diagram`'s description ends *"Run this before
rendering, and again after moving anything"* — an instruction that mandates a
separate turn. The separation is principled and the cost was simply never
priced.

**Pretty-printing doubles the bill.** Across ten shipped figures, 4,832
tokens pretty-printed against 2,454 minified: **-49.2%**. Output tokens are
generated serially, so this is the dominant controllable cost. Defaulting
`shape` to `box` takes another 6.7%; 41 of 49 shipped nodes are plain boxes
and every one of them spells it out.

**An agent cannot write a diagram from the tool schema alone.** Node fields
are `z.array(z.unknown())` on purpose, so the published schema stays the
single source of truth. The consequence is a mandatory read of
`pensketch://schema` (4,774 tokens) or `pensketch://spec` (8,640) before a
first node can be written.

## The three levers, named once

They are named rather than numbered everywhere in this change, because the
numbers went two ways at once: `tasks.md` group 1 is the turns and group 2 is
the tokens, while two other files called the turn lever "lever 2". A reader
who resolved a number against the wrong file got the wrong lever.

- **the turn lever** — `render_diagram` returns findings beside its markup
- **the shape default** — `shape` becomes optional on a drawn node
- **the schema read** — the mandatory `pensketch://schema` read, left to
  client caching

## What changes

- **`render_diagram` reports what it drew.** Findings return with the markup,
  so the common path is emit -> render, not emit -> check -> render. The
  separate `check_diagram` stays, for callers who want findings without
  markup and for a pre-render pass on an expensive raster.
- **`check_diagram`'s description stops mandating a turn**, because it will
  no longer be true.
- **`shape` becomes optional, defaulting to `box`.** Relaxing a required
  field breaks no existing caller.
- **The `diagram` description asks for compact JSON.** Honest about its own
  strength: this is influence, not enforcement. The model chooses its own
  formatting; a description nudges it. It is cheap and it is measured at
  -49% if it lands.

## Non-goals

- **Layout.** `TRAPS.coordinates` stands: pensketch performs no layout and
  routes no edges. Fewer turns, not automatic ones.
- **Prompt caching.** The larger half of the schema read lives in whatever client
  calls the model, setting `cache_control` on its tools block. Nothing in
  this repository can do it.
- **Making `render_png` cheaper.** That is `mcp-speaks-http`'s problem.

## Found while implementing, 2026-09-06

**`check_diagram` green-lights a diagram `render_diagram` refuses.** An edge
carrying `label` without `lx`/`ly` passes the checker with "No findings." and
throws in `draw`. It was found by executing the baseline's turn 3, which the
baseline had only counted. It is pre-existing, it is not caused by anything
here, and the turn lever does not fix it: findings ride along with a *successful*
render, and this render does not succeed.

It belongs in this change's story because it is a turn nobody counted, which
is the currency this whole change is denominated in.

## Owner calls this change needs

1. **Does `render_diagram` returning findings break the tool's contract?**
   The live spec says it "SHALL return SVG text". Adding a second content
   block is a response-shape change to a published API, so it is a minor bump
   and a decision, not a refactor.
2. **Should `check` carry the renderer's structural rules?** Today it reports
   layout and `draw` throws on structure, so a diagram can pass one and fail
   the other. Closing it means `check` grows rules that duplicate `draw`'s
   refusals, which is a boundary decision, not a bug fix.
3. **The `pensketch://schema` read: pay it, cache it, or inline it?** Inlining
   a minimal node shape into the tool schema would remove a mandatory read
   and 4,774 tokens, at the cost of the second-source-of-truth this codebase
   deliberately refused. A test could hold the two together, as one already
   holds the tool list to the schema's top level. This is the owner's
   principle to trade, not the agent's.
