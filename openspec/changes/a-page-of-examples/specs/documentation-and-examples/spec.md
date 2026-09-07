# documentation-and-examples — Delta Specification

## ADDED Requirements

### Requirement: Every shipped diagram is visible on one published page
The repository SHALL publish a single self-contained HTML page showing every
diagram it ships, rendered by `@pensketch/core` from the same data
`tools/shipped-diagrams.mjs` already serves to the checker and to the MCP
resource generator.

The page SHALL be generated, never hand-written, so it cannot claim a diagram
the repository no longer draws. It SHALL be self-contained: no network
request, no build step, no framework, and correct when opened from a `file://`
URL.

Every diagram SHALL be named. `shippedDiagrams()` returns entries without a
key, and the generator SHALL fail rather than print an untitled figure.

#### Scenario: The page matches what ships
- **WHEN** a diagram changes and the page is not regenerated
- **THEN** CI fails on the tree-clean assertion, the way it does for the goldens and the schema

#### Scenario: A diagram arrives without a name
- **WHEN** the generator meets an entry with no key
- **THEN** it fails naming the entry, rather than emitting a figure a reader cannot identify

#### Scenario: Opened from disk
- **WHEN** the page is opened from a `file://` URL with no network
- **THEN** every figure and the hand-drawn face render exactly as they do when hosted
