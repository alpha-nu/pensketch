# repo-tooling — Delta Specification

## ADDED Requirements

### Requirement: The HTTP entry carries a byte budget
`tools/check-size.mjs` SHALL carry a budget for the HTTP entry, on the same
terms as every other shipped file: a number with a recorded margin and a
dated reason, not a number chosen to pass.

#### Scenario: The new entry is measured
- **WHEN** the size gate runs
- **THEN** the HTTP entry has its own budget and its own margin, and the gate fails on a regression rather than absorbing it
