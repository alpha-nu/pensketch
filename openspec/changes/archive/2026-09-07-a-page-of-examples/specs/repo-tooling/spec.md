# repo-tooling — Delta Specification

## ADDED Requirements

### Requirement: The showcase page is generated and gated
A generator SHALL produce the published page from `shippedDiagrams()`, and a
CI check SHALL hold the committed page to a fresh generation, on the same
terms as the generated resources and schema.

Wherever the visual system is shared between the page and anything else, it
SHALL have one source. A palette copied into a second file is the drift this
repository's generators exist to prevent.

A generated page SHALL NOT carry hand-written statements of fact about what it
shows. Counts, shapes and features SHALL be computed from the same data the
figures are drawn from; prose SHALL be confined to what cannot be derived. The
tree-clean assertion proves a page was regenerated and says nothing about
whether its sentences are still true - and a regenerated page carrying a
falsified sentence passes it.

#### Scenario: One palette, one source
- **WHEN** a colour or type stack is changed
- **THEN** every consumer of it changes, because none of them holds its own copy

#### Scenario: A stale page is a failure
- **WHEN** the committed page differs from a fresh generation
- **THEN** CI fails, rather than publishing a page that describes an older repository

#### Scenario: A published page is deployed only from a tree that passed
- **WHEN** a commit fails CI, including on the tree-clean assertion above
- **THEN** nothing is deployed, because the deploy runs on CI's success rather than beside it on the same push
