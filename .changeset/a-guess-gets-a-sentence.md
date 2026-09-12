---
'@pensketch/mcp': minor
---

A guessed diagram gets a sentence instead of a stack trace. Every diagram is
now validated against the published schema before anything draws — the same
document `pensketch://schema` serves, precompiled, so the refusals and the
contract cannot drift — and a miss is refused with every defect named at
once: `nodes[0] has no field "text" - words go in "lines", an array of
strings`, `edges[0].from must be array - an edge end is ["nodeId", "side"],
like ["a", "r"]`, `edges[0].from[1] must be one of "t", "b", "l", "r"`.
Before this, the natural first guesses at the data model — string edge ends,
a node labelled `text` — either crashed as `TypeError: undefined is not
iterable` or drew a diagram of silently empty boxes, and a caller in a
client with no resource access reverse-engineered the schema by failing
eight times (docs/pensketch-feedback.md, the session that motivated all of
this).

The same validator stands in front of `check_diagram`, `render_diagram` and
`render_png`, which closes a real hole: the checker used to bless raw
coordinate pairs the renderer then refused, so a clean check was not a
guarantee. It is now.

New tool: `get_schema`. The same document as the `pensketch://schema`
resource, as a tool, because many MCP clients cannot read resources at all
and a description that says "read the schema resource" is a dead end there.
The tool descriptions also now carry a minimal complete diagram, say that
`render_png` is stdio-only where they mention it, and say what to do with
returned SVG markup — many clients display none of it.

Validation is precompiled Ajv, standalone: no `new Function` at runtime, so
the `/http` entry still bundles for worker targets, and `npm run edge`
holds it there.
