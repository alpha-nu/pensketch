# core-renderer — Delta Specification

## ADDED Requirements

### Requirement: A node without a shape is a box
`shape` SHALL be optional on a node and SHALL default to `box`. The default
exists to shorten what an agent writes: 41 of the 49 nodes in this
repository's shipped figures are plain boxes and every one of them spells the
field out.

The relaxation SHALL be additive. Every diagram valid before this change SHALL
draw byte-identically after it, because a stated `shape: "box"` and an omitted
`shape` SHALL produce the same element.

#### Scenario: The field is omitted
- **WHEN** a node carries no `shape`
- **THEN** it draws exactly what the same node with `shape: "box"` draws, byte for byte

#### Scenario: Nothing existing moves
- **WHEN** every shipped example and golden is rendered after the change
- **THEN** the bytes are unchanged, because no existing diagram omitted the field
