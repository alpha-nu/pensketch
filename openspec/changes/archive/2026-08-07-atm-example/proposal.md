# Proposal: atm-example

> A fourth runnable example — a state machine that branches — and an honest
> account, in what the server serves, of what `raw` takes away.

## Why

The three bundled examples are all flows: work moving forward through stages.
None of them branches, and branching on a decision is the shape most state
machines are. An agent learning the server produced an ATM diagram that was
clean on the checker's first run, which is both evidence the reference teaches
what it claims and a better example than anything written to be an example.

It also drags a long-standing quiet failure into the light. `raw` holds
functions, JSON cannot carry them, and the resource generator has always
stripped them. So the lifecycle example has been serving a state machine whose
self-transition is silently absent: a caller reproducing the served data
faithfully gets a picture one loop short, with nothing to say why.

## What changes

- `examples/state-machine/` — the ATM, in its own self-contained page, drawn
  from data except for the keypad loop that the data model has no word for.
- `pensketch://example/atm` joins the served resources, taking them to seven.
- Every served example that draws with `raw` carries a `rawOmitted` line
  naming the stroke a caller will not receive and why. The generator refuses
  to build if a diagram grows a `raw` without one.

## Impact

- **Affected specs**: `documentation-and-examples`
- **Affected code**: `examples/state-machine/index.html`,
  `tools/shipped-diagrams.mjs`, `tools/generate-resources.mjs`,
  `tools/check-stdio.mjs`, `packages/mcp/README.md`, the mcp resource tests
- **Not affected**: the renderer, the checker, the schema. No rendered byte of
  any existing diagram moves.
