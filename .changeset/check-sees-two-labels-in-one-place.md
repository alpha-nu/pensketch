---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

A new rule, `text-collision`, reports two pieces of text written in the same
place — where before nothing compared one piece of text with another at all.

**`check` will report diagrams it passed before, and nothing you draw moves.**
No renderer file changed and every golden regenerates clean, so the rendered
bytes of every diagram are what they were. This is a minor because `check` runs
in CI: on a 0.x version a caret range stops at the minor, so a release that can
turn a green pipeline red must be one you choose rather than one that arrives
on the next install.

Every rule before this one measures text against the *strokes* a diagram draws.
`label-collision` boxes a label and asks whether any drawn path passes through
it, and a node's label and a group's title are ink that is in no path — so
neither was ever compared with anything, and neither was another label. Four
shapes of defect fell in that gap:

- an edge label written through a group's title
- an edge label written through a node's own label
- two edge labels written on one another
- a note written over any of them

The finding names both pieces, in the order they are drawn:

```
node "leaf" lies under edge 0, which will be drawn through it
```

**Which diagrams start reporting.** None of the ten this repository ships —
`npm run diagrams` is 0 errors and 0 warnings across all of them. What starts
reporting is text placed where other text already is, which in practice means
an edge or note label put near the top-left corner of a group, or over a box
whose own label is already there. If you position labels by hand against a
group's title, expect a warning per pair.

**There is no threshold in it.** Two boxes either intersect or they do not, so
unlike `edge-overlap` there is no number to calibrate and none to be talked
into. Near is not a collision.

The finding carries `estimated: true`, because pensketch never measures text —
the boxes rest on the same deliberately over-stated width estimate
`text-overflow` already reports on, and a finding resting on an estimate says
so. `rules: { 'text-collision': 'off' }` switches it off on its own.

`@pensketch/core/check` grows from 3297 to 3390 bytes min+gzip. The root entry
and `@pensketch/core/server` do not move at all — the rule is in the checker,
not in shared code — and it costs no measurable time, because it reuses boxes
the surrounding rules already compute rather than making a pass of its own.

One limitation is worth stating rather than leaving to be found: this compares
the *text* a group or a note carries, not the lines they draw. A label lying
across a group's border, or across a note's arrow, is still not reported, and
no rule compares an edge with a node's outline.

`@pensketch/mcp` reissues because `check_diagram` returns the new findings and
the reference it serves describes the rule.
