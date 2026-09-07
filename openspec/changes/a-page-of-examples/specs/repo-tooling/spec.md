# repo-tooling — Delta Specification

## ADDED Requirements

### Requirement: The showcase page is generated and gated
A generator SHALL produce the published page from `shippedDiagrams()`, and a
CI check SHALL hold the committed page to a fresh generation, on the same
terms as the generated resources and schema.

Wherever the visual system is shared between the page and anything else, it
SHALL have one source. A palette copied into a second file is the drift this
repository's generators exist to prevent.

#### Scenario: One palette, one source
- **WHEN** a colour or type stack is changed
- **THEN** every consumer of it changes, because none of them holds its own copy

#### Scenario: A stale page is a failure
- **WHEN** the committed page differs from a fresh generation
- **THEN** CI fails, rather than publishing a page that describes an older repository
