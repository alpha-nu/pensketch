# Proposal: brace-annotations

> A brace over three boxes saying "all of this is the client". It is the one
> annotation a reader draws by hand on a printout, and the one shape this data
> model still has no word for.

## Why

**Grouping without enclosing.** `shape: 'group'` draws a titled region behind
its members, which says these things are a unit *and* they sit together in a
rectangle. A brace says the first without the second: it spans whatever the
caller points it at, from outside, and does not claim the space between. Three
rows of a stack, two of five steps, one column of a matrix — none of those is a
box, and today each is either a group that lies about the shape or nothing.

**It is the second thing `raw` can draw and JSON cannot.** `arc-connectors`
exists because a self-transition could only be drawn through a callback, which
holds functions, cannot cross a JSON boundary, is invisible to `check`, and is
stripped from what `@pensketch/mcp` serves. A brace is in exactly that
position now, and for the same reason: an agent using the server cannot draw
one at all. Lifting one limitation and leaving its twin is a decision, so this
change makes it deliberately rather than by omission.

**The geometry is already solved.** It was prototyped while specifying
`arc-connectors` and recorded in that change's design document: four
quarter-arcs and two runs, twenty-four points, exact. A square bracket is four
points and needs no arc at all. What was missing was the primitive underneath
it, and `arc-connectors` group 1 has shipped it.

## What changes

- **`braces` as a phase** — a top-level array beside `nodes`, `edges` and
  `notes`, drawn between the shapes and the notes: over what it spans, under
  the annotation that explains it.
- **`DiagramBrace`** — two endpoints, a depth, a kind, and an optional label
  with its own coordinates, in the words `DiagramEdge` already uses for one.
- **`bracePoints`** — one point list through one `stroke`, so the wobble runs
  continuously from end to end.
- **`kind: 'square'`** — the bracket, which needs no arc, and which a caller
  can technically draw today through `raw` and therefore not at all over JSON.
- **The checker sees it**, so a brace outside the frame is reported like
  anything else outside the frame.

## Impact

- **Affected specs**: `core-renderer`, `diagram-checker`,
  `documentation-and-examples`
- **Affected code**: `packages/core/src/{types,draw,sample,check,constants}.ts`,
  the generated schema, the MCP tool's accepted shape, `docs/agents.md`, both
  READMEs
- **Version**: a **minor** for `@pensketch/core` and `@pensketch/mcp` — this
  adds API. Every existing diagram renders byte-identically: a diagram with no
  `braces` consumes nothing from the seeded sequence for them.
- **Depends on**: `arc-connectors` (for `arcPoints`, and because the render
  order it leaves behind is what this extends) and `strict-tool-input`
  (without it, a `braces` key the server has not been taught is silently
  discarded, and this change would appear to work while drawing nothing).
- **Not affected**: no layout, no routing, no text measurement. A brace spans
  the two points it is given, and its label sits where the caller puts it.
