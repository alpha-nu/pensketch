---
'@pensketch/mcp': minor
---

A fifth example, `examples/showcase/`, served as `pensketch://example/showcase`.

This project's own logical architecture, drawn by the renderer it describes:
four groups, thirteen components, fifteen connectors, two braces, two notes.
It exists to be the one picture that reaches for the breadth of the data model
— every drawn shape, `accent` and `hatch`, straight connectors and orthogonal
ones, a self-transition, both kinds of brace, notes whose pointers bow — and to
do it **without `raw`**, so that what it draws is expressible as data and can be
served whole rather than served with a hole and a note explaining the hole.

No package source changes and no rendered byte of any existing diagram moves.
What changes is what `@pensketch/mcp` publishes: one more resource, so an agent
asking for a worked example has a rich one to read rather than four small ones.
