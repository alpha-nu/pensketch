# diagram-checker — Delta Specification

## ADDED Requirements

### Requirement: The checker does not carry the renderer's refusals
`check` reports what a drawing would look like. It SHALL NOT be assumed to
report what `draw` will accept: the two answer different questions, and a
diagram can pass one and be refused by the other. The known case is an edge
or brace carrying a `label` or `lines` without `lx` and `ly` — `draw` throws
naming the edge, `check` has no rule for it and reports "No findings."

This is stated rather than fixed. Closing it means `check` grows a second set
of rules duplicating the renderer's structural validation, which is a decision
about where that boundary sits and not a defect to patch quietly. It is
recorded here because `render_diagram` now returns findings beside its markup,
which makes it easy to read a clean report as a guarantee that the drawing
was made — and on a refusal there is no drawing and no report.

Where documentation tells a caller what `check` covers, it SHALL say what it
does not.

#### Scenario: A diagram the checker passes and the renderer refuses
- **WHEN** a diagram carries an edge with `label` but no `lx`/`ly`
- **THEN** `check` reports no findings and `draw` throws naming that edge

#### Scenario: A refusal carries no findings
- **WHEN** `render_diagram` cannot draw a diagram
- **THEN** it returns the renderer's message alone, and a caller SHALL NOT read the absence of findings as a clean report
