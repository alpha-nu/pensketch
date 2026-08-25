# mcp-server — Delta Specification

> The depth pair crosses the tool boundary the way `hops` did — with one
> deliberate difference: the checker takes it, because depth changes
> findings and hops change none. a-diagram-takes-depth/design.md D1, D6.

## ADDED Requirements

### Requirement: All three tools accept the diagram-wide depth pair
`render_diagram` and `render_png` SHALL accept an optional `extrude` boolean
and `depth` number beside `seed` and `hops`, and pass them to `draw` as the
diagram-wide default, so an agent can raise a whole diagram without setting
the pair on every node it writes. Omitted, they SHALL behave exactly as they
do today.

`check_diagram` SHALL accept the same pair — the deliberate opposite of
`hops`, and for the same reason read forward: `hops` is refused there because
it changes no finding, and `extrude`/`depth` are accepted because they change
the geometry every finding measures. Refusing them would return findings
computed for a drawing the caller is not making.

Per-node `extrude` and `depth` need nothing here: they are member fields,
described by `pensketch://schema`, which the server publishes, which forbids
extras at every level, and which SHALL regenerate to carry them. The test
that holds each tool's declared shape to the published schema SHALL hold for
the new arguments the way it holds for the arrays.

#### Scenario: An agent raises a whole diagram
- **WHEN** `render_diagram` is called with `extrude: true`
- **THEN** the returned SVG draws every node as a slab at `DEPTH`, and the same call without it returns what it returns today

#### Scenario: The checker measures the drawing the renderer will make
- **WHEN** `check_diagram` is called with `extrude: true` on a diagram whose slab would cross the viewBox
- **THEN** it reports `out-of-bounds` for that node, where the same call without the pair reports none

#### Scenario: The pair is honest about its default
- **WHEN** `render_png` is called with `extrude: true` and no `depth`
- **THEN** the raster draws slabs at `DEPTH = 12`, the same drawing `render_diagram` returns for the same arguments
