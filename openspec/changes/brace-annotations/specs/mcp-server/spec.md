# mcp-server — Delta Specification

> The strict boundary enumerates the members whose insides it does not reach.
> There is a fourth now, and an enumeration one short reads as a decision.

> The requirement below is restated from the text `strict-tool-input` leaves
> behind, not from what is in the main spec today. That change archives first.

## MODIFIED Requirements

### Requirement: The tool boundary refuses what it cannot carry
Every tool's arguments SHALL be validated strictly **at their top level**: a
key the tool does not declare SHALL be refused, naming that key, rather than
accepted and discarded. This SHALL apply to the diagram argument and to the
arguments beside it, and SHALL include `raw`, which the server does not accept
because it holds functions that JSON cannot carry.

It SHALL NOT extend to the fields inside a node, an edge, a brace or a note.
Those are
described by `pensketch://schema`, which the server publishes and which
forbids extras at every level, and restating them at the boundary would be a
second source of truth for a shape that already has one. A caller that
misspells a member field therefore still gets a drawing missing that field's
contribution — the same defect this requirement fixes one level up — and the
schema is what catches it.

The declared top-level keys SHALL be exactly the diagram's own arrays, so that
a field the data model gains and the boundary does not is a refusal a caller
reads rather than a key the server drops. A test SHALL hold the tool's
declared shape to the published schema's top level, so forgetting one is a
failing build rather than a diagram that draws short.

#### Scenario: An unrecognised top-level key is named
- **WHEN** a diagram argument carries a key the tool does not declare
- **THEN** the call is refused with a message naming that key and the fields it should have used

#### Scenario: A member field is not checked here
- **WHEN** a node, edge, brace or note carries a misspelled field
- **THEN** the boundary accepts it and `pensketch://schema` is what rejects it

#### Scenario: A new diagram array cannot be forgotten
- **WHEN** the data model gains a top-level array and the tool's shape is not taught it
- **THEN** the test holding the two together fails, rather than the server silently discarding the field
