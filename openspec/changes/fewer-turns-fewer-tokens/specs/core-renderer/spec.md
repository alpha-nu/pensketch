# core-renderer — Delta Specification

## ADDED Requirements

### Requirement: A node without a shape is a box
`shape` SHALL be optional on a node and SHALL default to `box`. The default
exists to shorten what an agent writes: 71 of the 100 drawn nodes across the
15 figures this repository ships are plain boxes and every one of them spells
the field out. Any figure quoting that share SHALL name the corpus it counted
and the denominator it used, because the two differ - 110 nodes are shipped
and 100 of them are drawn rather than group frames.

The relaxation SHALL be additive. Every diagram valid before this change SHALL
draw byte-identically after it, because a stated `shape: "box"` and an omitted
`shape` SHALL produce the same element.

It costs one diagnostic, and that cost SHALL be stated rather than discovered.
`shape` was the schema's only handle on what makes a group a group, so a node
intended as a group and written without it used to be refused by name and is
now a valid box: drawn over its own members, and reported as two
`node-overlap` errors and an `orphan-node` against nodes that were correctly
placed. Three symptoms, no mention of the cause. Documentation that describes
the group node SHALL say that `shape` is required there, beside the `lines`
requirement it already states.

#### Scenario: The field is omitted
- **WHEN** a node carries no `shape`
- **THEN** it draws exactly what the same node with `shape: "box"` draws, byte for byte

#### Scenario: Nothing existing moves
- **WHEN** every shipped example and golden is rendered after the change
- **THEN** the bytes are unchanged, because no existing diagram omitted the field
