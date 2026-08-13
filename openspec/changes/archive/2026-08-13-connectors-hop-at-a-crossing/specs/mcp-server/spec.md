# mcp-server — Delta Specification

> One added requirement: the two rendering tools accept the diagram-wide hop
> switch, and the checker refuses it. Nothing existing is modified — this is an
> argument beside the diagram, not a key inside it, so the strict top-level-key
> rule is untouched.

## ADDED Requirements

### Requirement: The rendering tools accept the diagram-wide hop switch
`render_diagram` and `render_png` SHALL accept an optional `hops` boolean
beside `seed` and pass it to `draw` as the diagram-wide default, so that an
agent can ask for hops without setting `hop` on every edge it writes. Omitted,
it SHALL behave exactly as it does today.

`check_diagram` SHALL NOT accept it. `check` does not model hops — the path it
walks is the un-hopped one — so declaring `hops` there would accept an argument
that changes no finding. Left undeclared, the tool's existing strict-key
handling refuses it and names it, which tells a caller that hops are a
rendering concern rather than leaving them to conclude it from a report that
did not change.

Per-edge `hop` needs nothing here: it is a member field, described by
`pensketch://schema`, which the server publishes and which already forbids
extras at every level.

#### Scenario: An agent turns hops on for a whole diagram
- **WHEN** `render_diagram` is called with `hops: true`
- **THEN** the returned SVG draws an arc at each crossing the resolution rules select, and the same call without it returns what it returns today

#### Scenario: The checker names the argument it does not take
- **WHEN** `check_diagram` is called with `hops`
- **THEN** the call is refused with a message naming that key, rather than returning findings computed as though it had been applied

#### Scenario: A per-edge hop needs no tool change
- **WHEN** an agent writes `hop: true` on an edge and calls `render_diagram`
- **THEN** it is accepted through the published schema, with no argument declared beside the diagram for it
