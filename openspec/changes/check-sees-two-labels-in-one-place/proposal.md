# Proposal: check-sees-two-labels-in-one-place

> Every rule in the checker compares text against *strokes*. Nothing compares
> text against text, so two labels written in the same place are drawn on top
> of one another and the gate says nothing.

## Why

**Found by drawing, not by review.** Building an explainer with five panels
through the MCP server, an edge label reading `energy` was written straight
through a group's own title, `a leaf`. Sixteen pixels apart. Every gate passed:
`check_diagram` returned **No findings** on that panel, and it was right to by
its own rules.

```
node "leaf" title box   x 404  y 31   w 42  h 14
edge 0 label box        x 398  y 38   w 44  h 13
```

**The gap is structural, and wider than the case that exposed it.**
`label-collision` boxes an edge, brace or note label and asks whether any
*drawn path* passes through it — `struckBy` walks `drawn`, which holds edge and
brace polylines. Node labels and group titles lay down ink and are in no path.
Neither is another label. So all of these are invisible today:

- an edge label over a group's title, which is the one that was hit
- an edge label over a node's own label, where a connector passes near a box
- two edge labels on top of each other, where two connectors run close
- a note over any of them

**It is the same shape of defect as `edge-overlap`, one rung along.** That rule
exists because two connectors drawn as one line look deliberate. Two labels in
one place look like one label with a smear through it — and the reader cannot
recover either string. `docs/agents.md` already warns that group borders are
not compared, which is a limitation written down rather than fixed.

## What changes

- **A new rule, `text-collision`, SHALL fire when any two pieces of text the
  drawing lays down have overlapping boxes** — node labels, group titles, edge
  labels, brace labels and notes, all against each other.
- **It is a warning, and `estimated`.** Text is never measured here; the box is
  the same over-stated estimate `text-overflow` already reports on, so the
  finding carries the same flag and the same honesty about what it knows.
- **The existing `label-collision` behaviour is untouched.** Text against
  strokes stays exactly as it is; this is the axis that was missing, not a
  redefinition of the one that was there.
- **`docs/agents.md` loses a paragraph it should no longer need** — the note
  saying a label across a group border is not reported.

## Impact

- **Affected specs**: `diagram-checker` (modified), `repo-tooling` (a budget
  moves).
- **Affected code**: `packages/core/src/check.ts` only.
- **Ordering.** `edge-overlap-sees-a-shared-trunk` is still open and its
  `diagram-checker` delta restates the same requirement. This change's delta
  is written against the live baseline as it stands today; it SHALL be
  re-diffed against the archived text before it lands, so the shared-trunk
  paragraph is carried rather than reverted.

## Measured, on a built prototype

Built, measured cold, and reverted — the figures are from a running rule, not
an estimate:

| entry | before | after | |
|---|---|---|---|
| `@pensketch/core/check` | 3297 | **3468** | **+171** |
| `@pensketch/core` | 4179 | 4179 | unmoved |
| `@pensketch/core/server` | 4196 | 4196 | unmoved |

The root entry and `./server` not moving is the check that the rule landed in
the checker rather than in shared code.

**`./check` stands at 3297 against 3392, so 95 B free, and this needs 171.**
The budget moves first, in its own commit, as it did twice for the shared-trunk
rule.

**Calibration is not the risk here that it was for `edge-overlap`.** The
prototype reports **zero findings across all ten diagrams this repository
ships**, and zero across the five panels of the explainer that exposed the gap
once its one real collision was fixed. On the unfixed panel it reports exactly
the defect:

```
text-collision: node "leaf" and edge 0 are written in the same place; move one of them
```

There is no threshold to tune — two boxes either intersect or they do not — so
there is no number to be talked into. What the prototype does not yet answer is
whether the rule should be its own id or a widening of `label-collision`; only
the new-id shape was built, and the difference is a rule id and a defaults
entry. That is the first thing to measure and the owner's call to settle.
