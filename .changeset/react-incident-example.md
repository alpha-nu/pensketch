---
'@pensketch/mcp': minor
---

The React example is an incident now, and the diagram it draws is computed
from application state.

It was the OAuth authorization code flow: four lanes, seven steps, and a seed
control. The seed control demonstrated determinism, which is a property of
`draw` — four buttons on a plain HTML page show the same thing. Nothing on the
page demonstrated what the bindings are actually for, which is a picture
derived from what the application knows.

It now draws an incident at the stage it has reached, and three things about
the picture are computed from that stage: which node carries `accent`, which
edges are `dotted`, and how far the bracket over "customers affected" reaches.
The seed control stays, next to it, so the page says the two apart: the stage
changes the data, and the seed changes which drawing of that data you get. The
diagram is memoized on the stage, because `<PenSketch>` compares `diagram` by
identity — which is the thing a diagram built from state has to get right.

**The served resource is renamed.** `pensketch://example/oauth` is now
`pensketch://example/incident`, and `pensketch://spec` — `docs/agents.md` —
carries the new diagram as its complete worked example, in place of the OAuth
one. The other three example resources are untouched.

The picture uses `kind: 'square'`. A bracket, not a brace, because this span
runs from 150 px to 720 as the incident does: a curly brace turns its corners
at one fixed radius and its tip at another, so widening one grows nothing but
the two straight runs between them. It reads as a brace at 150 px and as an
underline with a bump at 720. Three straight lines look the same at every
width.

Every stage is checked, not just the one that is served: `npm run diagrams`
loads all five, because a picture correct only at stage 3 is a picture this
repository would ship broken four times out of five.
