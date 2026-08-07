# diagram-checker — Delta Specification

> Layout defect detection over diagram data. Exact API, rule predicates and
> measured constants: design.md.

## ADDED Requirements

### Requirement: A pure checker on its own subpath
`@pensketch/core` SHALL export `check(diagram, options?)` from the subpath
`@pensketch/core/check`, returning an array of findings. It SHALL have zero
runtime dependencies, SHALL NOT render, SHALL NOT touch any DOM, and SHALL
NOT mutate the diagram it is given. Importing the root entry SHALL NOT pull
the checker into a consumer's bundle.

#### Scenario: Callable without a DOM
- **WHEN** `check` is called in an environment with no `document` and no `SVGSVGElement`
- **THEN** it returns findings normally

#### Scenario: The main bundle is unaffected
- **WHEN** a consumer imports only `@pensketch/core`
- **THEN** the root entry's min+gzip size is unchanged and the checker's code is absent

### Requirement: Findings are stable, sorted and machine-readable
Every finding SHALL carry a stable `rule` id, a `severity` of `error` or
`warning`, a one-sentence `message`, an `at` point in the diagram's own
coordinate space, and the `subjects` involved. Findings SHALL be sorted by
severity, then rule, then position, so that the same diagram always yields the
same array and the output can be snapshot-tested.

#### Scenario: Same diagram, same findings
- **WHEN** `check` runs twice over the same diagram and options
- **THEN** both calls return deeply equal arrays in the same order

### Requirement: Seven rules over diagram geometry
`check` SHALL report: `duplicate-id` and `node-overlap` and `out-of-bounds` as
errors; `label-collision`, `text-overflow`, `group-escape` and `orphan-node`
as warnings. Each rule's severity SHALL be raisable, lowerable, or switchable
off through options. `out-of-bounds` SHALL run only when a `viewBox` is
supplied.

#### Scenario: A duplicate id is reported alongside everything else
- **WHEN** two nodes share an `id`
- **THEN** `check` reports `duplicate-id` as an error, naming both, together with every other finding in the diagram — where `draw` throws on the first defect it meets and renders nothing

#### Scenario: A label lying on a connector is caught
- **WHEN** an edge label's box falls within the configured clearance of any edge's path
- **THEN** `check` reports `label-collision` naming the label and the edge it collides with

#### Scenario: Half in a group is a defect, wholly outside is not
- **WHEN** a node's box partially intersects a group's box
- **THEN** `check` reports `group-escape`
- **WHEN** a node's box lies wholly inside or wholly outside every group
- **THEN** no `group-escape` finding is produced

#### Scenario: A rule can be switched off
- **WHEN** options set a rule to `off`
- **THEN** no finding with that rule id is returned

### Requirement: Text width is estimated and findings say so
`check` SHALL estimate text width as `length * fontSize * glyphWidth` rather
than measuring it, SHALL default `glyphWidth` to a value calibrated against
the documented font stack that over-states the width of every label in this
repository's own diagrams, and SHALL mark every finding that depends on the
estimate so a caller can weigh it accordingly.

#### Scenario: An estimated finding is labelled
- **WHEN** `text-overflow` is reported
- **THEN** the finding carries `estimated: true`

#### Scenario: The estimate errs toward warning
- **WHEN** a label's true rendered width is close to its box width
- **THEN** the estimate over-states it, so the caller is warned rather than left with a silent overflow

### Requirement: Edge geometry accounts for the jitter
Edge paths SHALL be derived from the exported `anchor` function and the edge's
`via` points, and each segment SHALL be inflated by half the jitter amplitude
plus half the stroke width before clearance is applied, because the drawn line
does not follow the ideal path.

#### Scenario: A label just clear of the ideal path still collides
- **WHEN** a label sits closer to a segment than the inflated width plus clearance
- **THEN** `label-collision` is reported, even though the label does not touch the ideal path

### Requirement: The checker never repairs
`check` SHALL NOT move, resize, reorder or otherwise alter any part of a
diagram, and SHALL NOT propose replacement coordinates. Automatic layout
remains a project non-goal.

#### Scenario: Reporting, not fixing
- **WHEN** `check` finds an overlap
- **THEN** it returns a finding describing it and the diagram passed in is unchanged

### Requirement: The repository's own diagrams are checked in CI
CI SHALL run the checker over the diagrams this repository ships — the
examples and the README hero — and fail on any `error` finding.

#### Scenario: A shipped example regresses
- **WHEN** a change introduces an overlapping node in an example diagram
- **THEN** CI fails with the finding
