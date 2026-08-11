# Proposal: arc-connectors

> One curved primitive, and the three things it lets a diagram say that it
> currently cannot: a transition back to the same state, two connectors
> between the same pair, and a note pointer that goes round rather than
> through.

## Why

**A state machine cannot say its most ordinary sentence.** An edge joins two
different nodes, so "another digit, stay in awaiting PIN" has no expression in
the data. Two of the four bundled examples need one anyway, and both pay for
it with `raw` — which holds functions, so it cannot cross a JSON boundary, is
invisible to `check`, and is stripped from what `@pensketch/mcp` serves. **An
agent using the server cannot draw a self-transition at all.** It is not a
missing convenience; it is the one shape the product cannot express to its
newest audience, and the audience it built a whole server for.

**The obvious syntax is currently a trap.** `{ from: ['a','t'], to: ['a','r'] }`
does not throw today. It renders a meaningless stub across the node's corner
with an arrowhead on it. The reference calls self-transitions impossible; the
code quietly draws rubbish instead of saying so.

**Two edges between the same pair draw the same line twice.** `A→B` and `B→A`
produce identical geometry, one exactly on top of the other, and no rule
notices.

The drawing side is smaller than it looks. `pill` already parametrises an
ellipse and hands the points to `stroke`; an arc is that loop over part of a
circle instead of all of it. The engine jitters whatever polyline it is given
and interpolates nothing, so a curve is a denser point list and nothing else
changes.

## What changes

- **`pen.arc()`** — a sampled elliptical arc, drawn through the same two-pass
  `stroke` as every other primitive, so it wobbles like the rest of the
  picture.
- **Self-transitions in data** — `from` and `to` naming the same node and the
  same side draws a loop off that side. `out` and `span` give its geometry;
  nothing is inferred and nothing is placed for you.
- **`bow` on an edge** — a perpendicular offset that curves a connector off
  the straight line between its anchors, so two edges between one pair can be
  told apart.
- **`bow` on a note pointer** — the same, for annotation arrows.
- **`edge-overlap`** — a new checker rule, because `bow` is no use to a caller
  who cannot see that two connectors are on top of each other.

## Impact

- **Affected specs**: `core-renderer`, `diagram-checker`,
  `documentation-and-examples`, `repo-tooling`
- **Affected code**: `packages/core/src/{pen,draw,geometry,check,constants,types}.ts`,
  the generated schema, `docs/agents.md`, the two examples that draw a loop
  through `raw`
- **Version**: a **minor** for `@pensketch/core` — this adds API. Every
  existing diagram renders byte-identically: the new code paths run only when
  a caller asks for them, so the seeded sequence is untouched.
- **Not affected**: no layout, no routing, no automatic placement. A loop is
  described by numbers the caller writes, exactly as `via` is.
