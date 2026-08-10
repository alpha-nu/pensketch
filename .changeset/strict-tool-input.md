---
'@pensketch/mcp': minor
---

Refuse a key the tool does not recognise, instead of dropping it.

The server generates its JSON Schema with `additionalProperties: false`,
serves it as `pensketch://schema`, and tells callers to validate against it.
Its own tool boundary then validated with a lenient object, which silently
stripped anything the schema forbids. A diagram carrying a key the server did
not know reached the renderer without it: no error, no diagnostic, and a
caller who cannot see the picture had no way to learn that a piece of it was
missing. The common case was not an exotic field but a misspelled one —
`node` for `nodes` rendered an empty diagram, and `check_diagram` then
reported "No findings." on it, so the one verification step in the product
certified the loss.

Every tool's arguments are now validated strictly **at their top level**, and
the message names what you should have sent:

```
A diagram has no field "node". It takes nodes, edges and notes;
read pensketch://schema for the fields inside each.
```

The schema each tool publishes in its listing declares the same restriction,
so a client validating locally is not told it may send a key the server will
refuse.

**What this does not cover.** Fields inside a node, an edge or a note are
unchanged: `{ nodes: [{ …, line: ['hi'] }] }` is still accepted and still
draws an unlabelled box. Those fields are described by `pensketch://schema`,
and restating them at the boundary would be a second source of truth. Validate
against the schema to catch them.

**What may break.** No diagram's rendered bytes change, but some calls that
returned a picture now return an error. If you send `raw` alongside real nodes,
you used to get the rest of the diagram and will now get a refusal — `raw`
holds functions and never crossed this interface anyway. If you spread a
served `pensketch://example/*` envelope straight into the arguments, its
`title` and `rawOmitted` are now refused; pass `example.diagram` and
`example.viewBox` instead, which is what the resource description now says.

**If you are a client author.** The arguments object beside the diagram is
strict too, so a field your client adds to a tool call for its own purposes
will be refused by name. The protocol's place for that is `_meta`, a sibling
of `arguments` rather than a key inside it, and anything sent there is
untouched. This is worth saying because at least one MCP client has been known
to put scheduling metadata into the arguments payload itself: if a user
reports a refusal naming a key they have never written, that is where it comes
from.
