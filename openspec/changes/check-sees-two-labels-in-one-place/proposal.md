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

Built, measured cold, and reverted twice — first as written, then optimised to
find out whether it could be made to fit the budget it stands under:

| entry | before | first cut | optimised | |
|---|---|---|---|---|
| `@pensketch/core/check` | 3297 | 3468 | **3390** | **+93** |
| `@pensketch/core` | 4179 | 4179 | 4179 | unmoved |
| `@pensketch/core/server` | 4196 | 4196 | 4196 | unmoved |

The root entry and `./server` not moving is the check that the rule landed in
the checker rather than in shared code.

**+171 came down to +93** by folding the node boxing into the loop that already
walks nodes for `text-overflow`, carrying the text as a `[subject, box]` tuple
so the minifier is not holding property names, building each subject string
once where it was being built twice, and — the largest single saving — phrasing
the finding as `lies under …, which will be drawn through it`, which
`check.ts` already emits three times — for an edge label, a brace label and a
note — so gzip carries a fourth for almost nothing.
That phrasing is also the more accurate one: texts are boxed in draw order, so
the second really is drawn over the first.

**It fits, at 3390 against 3392, and it should not be taken.** Two bytes is not
a margin, it is the noise: this repository has already recorded `./check`
gaining **2 B of gzip on identical code** when esbuild renamed some locals
(`tools/check-size.mjs`, the 3872 entry). A budget with two bytes spare is a
gate that goes red on a toolchain bump with no change to the source, and the
requirement it lives under exists to stop budgets being corrected at a failing
gate. So the recommendation is to move it deliberately now: 3390 plus the same
100 B of gzip headroom is 3490, taken up to **3520**.

The alternative is real and cheap to take: ship at 3390/3392, and accept that
the next person to improve a message in this entry does it against a two-byte
ceiling.

**Calibration is not the risk here that it was for `edge-overlap`.** The
prototype reports **zero findings across all ten diagrams this repository
ships**, and zero across the five panels of the explainer that exposed the gap
once its one real collision was fixed. All 364 existing tests pass unedited,
which is the evidence that `label-collision` is untouched. On the unfixed panel
it reports exactly the defect, carrying `estimated`:

```
text-collision: node "leaf" lies under edge 0, which will be drawn through it
```

There is no threshold to tune — two boxes either intersect or they do not — so
there is no number to be talked into.
