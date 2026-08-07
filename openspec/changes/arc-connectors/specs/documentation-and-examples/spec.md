# documentation-and-examples — Delta Specification

> The reference calls self-transitions impossible. After this change that is
> false, and it is the sentence an agent is most likely to have believed.

## MODIFIED Requirements

### Requirement: A reference for callers who cannot see the result
The repository SHALL carry documentation addressed to a program generating
diagrams rather than to a person — `docs/agents.md` — covering the whole type
surface, the constants worth designing around, every error the renderer
throws, and the traps a type system cannot express. It SHALL state which
things are permanent design decisions rather than gaps, and SHALL be served
verbatim by `@pensketch/mcp` rather than restated.

Where a stated limitation ceases to be true, the reference SHALL be corrected
in the same change that lifts it, and the correction SHALL say what the
limitation was — a caller that learned the old rule needs to know it has
moved, not merely to find the new text. The trap list SHALL name
self-transitions as expressible in data, and `raw` SHALL be described as the
escape hatch for what the data model still has no word for rather than for
self-transitions specifically.

#### Scenario: The reference is the served reference
- **WHEN** an agent reads `pensketch://spec`
- **THEN** it receives `docs/agents.md` byte for byte, with no separately maintained copy able to drift from it

#### Scenario: A lifted limitation is corrected where it was stated
- **WHEN** a change makes a documented impossibility possible
- **THEN** the trap that stated it is rewritten in that same change, so no released version ships a reference that contradicts its own renderer

#### Scenario: An example stops needing the escape hatch
- **WHEN** an example drew a self-transition through `raw` only because the data model could not state one
- **THEN** it is rewritten to state it, its `rawOmitted` disclosure disappears with the callback, and what the server serves becomes the whole picture rather than the picture minus a stroke
