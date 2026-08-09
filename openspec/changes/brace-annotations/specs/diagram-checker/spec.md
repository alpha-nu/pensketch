# diagram-checker — Delta Specification

> A brace is drawn, so it can be drawn in the wrong place. The rules that
> already say so should say so about it too.

## ADDED Requirements

### Requirement: A brace is checked as the shape it draws
Every geometric rule SHALL treat a brace as its sampled path rather than as
the straight line between its endpoints, in the same way a self-transition's
loop and a bowed connector are treated. `out-of-bounds` SHALL therefore report
a brace whose tip projects past the `viewBox` even when both its endpoints sit
inside, and SHALL report a brace's label by the same rule it reports any other
text.

Whether a brace joins the paths `label-collision` searches SHALL be decided in
this change and recorded, not left to the implementation: a note drawn across
a brace is the same defect as a label drawn across a connector, and the only
thing standing in the way is that a finding must be able to name a brace
rather than an edge.

#### Scenario: A tip outside the frame is reported
- **WHEN** a brace's depth carries its tip past the `viewBox` while both endpoints sit inside
- **THEN** `check` reports `out-of-bounds`, where the straight line between its endpoints would have sat wholly within

#### Scenario: A finding names the brace
- **WHEN** any rule reports a defect involving a brace
- **THEN** the message and its subjects name that brace, not an edge index that does not exist
