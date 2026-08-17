# mcp-server — Delta Specification

> The agent learns one boolean. Everything the recipe would have had to teach —
> the normalisation, the order, the dashed-stroke exception — is inside what
> comes back.

## ADDED Requirements

### Requirement: A rendered diagram can be asked to draw itself
`render_diagram` SHALL accept `animate`, defaulting to `false`. With it set,
what comes back SHALL be one self-contained `<svg>` carrying its own scoped
`<style>`, which draws itself inline in a page, embedded as `<img src>`, or
opened as a file, with nothing else fetched.

The parameter's own description SHALL say what comes back and that it needs
nothing else. A tool schema is what an agent reads before it reads any
resource, so a caller that never opens `pensketch://spec` still learns the
result is complete on its own.

`render_png` SHALL NOT accept `animate`. A raster cannot animate, and this
server refuses what it cannot carry rather than accepting a field it would
ignore.

The degradation SHALL be stated where the feature is documented: on an engine
that does not understand `@scope` the diagram renders finished and static.
An agent handing the markup to a consumer it cannot see needs to know the
failure is a still diagram rather than an empty frame.

#### Scenario: Animated markup stands alone
- **WHEN** `render_diagram` is called with `animate`
- **THEN** the returned markup contains its own `<style>` and references no external file

#### Scenario: The raster refuses it
- **WHEN** `render_png` is called with `animate`
- **THEN** the call is refused by name, rather than returning a still image as though the request had been honoured

#### Scenario: An agent is not asked to write CSS
- **WHEN** a caller reads only the tool schema
- **THEN** it learns that one boolean produces a complete result, with no stylesheet to supply and no attribute to add
