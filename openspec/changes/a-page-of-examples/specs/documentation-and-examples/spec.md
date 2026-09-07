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

Every diagram SHALL be named, and the generator SHALL refuse in both
directions rather than one: a figure it names that no longer ships, and a
shipped diagram it does not place. The second is what keeps a generated page
curated - adding an example stops the build until someone decides where it
goes - and a guard that only checked the first would never once have fired.

`shippedDiagrams()` also returns entries with no key at all. Those SHALL be
skipped only where a named diagram already covers the file they came from,
and SHALL fail the build otherwise, so an unnamed figure from a new source is
found rather than silently dropped.

Every `<svg>` SHALL carry an accessible name. The data holds a `label` for
some diagrams and not others, so the page's own title SHALL stand in where
there is none.

#### Scenario: The page matches what ships
- **WHEN** a diagram changes and the page is not regenerated
- **THEN** CI fails on the tree-clean assertion, the way it does for the goldens and the schema

#### Scenario: A diagram arrives without a name
- **WHEN** the generator meets an entry with no key, from a file no named diagram came from
- **THEN** it fails naming the entry, rather than emitting a figure a reader cannot identify

#### Scenario: A new example is added and nobody places it
- **WHEN** a keyed diagram ships that the page does not name
- **THEN** the generator fails, rather than publishing a page that silently omits it

#### Scenario: Opened from disk
- **WHEN** the page is opened from a `file://` URL with no network
- **THEN** every figure and the hand-drawn face render exactly as they do when hosted
