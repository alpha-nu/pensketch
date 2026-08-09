# Proposal: strict-tool-input

> The server publishes a schema that forbids unknown fields, then accepts them
> and throws them away. An agent gets back a picture with a piece missing and
> nothing that says so.

## Why

**The product contradicts itself, in the released version.**
`tools/generate-schema.mjs` sets `additionalProperties: false`, and the
generated `diagram.schema.json` carries it at the top level and on every
member. `@pensketch/mcp` serves that file as `pensketch://schema` and tells
callers to validate against it. Its own tool boundary then validates with a
plain `z.object`, which **strips** what it does not recognise.

Driven through the real server, a diagram of `{ nodes: [...], braces: [...] }`
reaches the handler as `{ nodes: [...] }`. No error, no diagnostic, no
`isError`. And the `inputSchema` the server publishes to clients carries no
`additionalProperties: false` of its own, so a client-side validator will not
flag it either. The key vanishes with nothing anywhere saying so.

**It is the failure this server was built to prevent.** The whole argument for
`@pensketch/mcp` is that a caller who cannot see the result needs the tool to
be honest with it — which is why `raw` is disclosed as `rawOmitted` in the
resources rather than quietly dropped. At the tool boundary the same data loss
happens silently, including for `raw` itself.

**A typo is the common case; a new field is the expensive one.** `node:`
instead of `nodes:` renders an empty diagram today rather than an error naming
the key. And the next field added to `Diagram` will be silently discarded by
every released server until its client updates — which turns a data-model
addition into a debugging session about why a shape did not appear.

## What changes

- **`z.strictObject` for every tool input**, so an unrecognised key is refused
  by name instead of dropped. That covers the diagram argument and the
  arguments beside it.
- **`raw` is refused rather than stripped.** It is already documented as not
  accepted; now saying so is the behaviour rather than only the description.
- **A test that the refusal names the key**, because "invalid input" sends a
  caller back to a schema it already believed it had followed.

## Impact

- **Affected specs**: `mcp-server`
- **Affected code**: `packages/mcp/src/tools.ts`, its tests
- **Version**: a **minor** for `@pensketch/mcp`. Input that was accepted is now
  refused. Nothing that was rendered changes, because the discarded keys never
  reached the renderer — that is the defect.
- **Not affected**: the rendering packages, the schema (already correct), and
  every diagram that was valid, which stays valid.
