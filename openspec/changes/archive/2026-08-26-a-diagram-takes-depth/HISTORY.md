# History: a-diagram-takes-depth

Every commit in this change, in the order it landed, with what it was for.
Kept alongside the change rather than left to `git log`, because half of
these commits exist to correct the other half and that pattern is the useful
record: what the reviews caught, and what the arithmetic was wrong about.

Regenerate the raw list with:

    git log --reverse --format='%h  %s' f7c7cbd~1..HEAD

## Scaffold

| commit | what |
|---|---|
| `f7c7cbd` | propose the change: proposal, design D1-D8, tasks, four deltas |

## Group 1 — the primitive

| commit | what |
|---|---|
| `86639e0` | 1.3a budgets first: `./check` 3520→3648, `./server` 4480→4992, sized from a whole-feature rehearsal, so no commit ever holds a red gate |
| `1c8856b` | 1.1 the silhouette extrusion on rect, pill and diamond; both strict bounds mutation-killed |
| `50c39e7` | 1.2 the off-path proof: goldens byte-identical, zero rng draws when flat |
| `4586806` | 1.3b the pricing recorded in D7 |
| `5545e1c` | 1.4 the default calibrated at both ends, per shape |

### Group 1 SWAT remediation (T-40..T-56)

| commit | what |
|---|---|
| `e0eb8f9` | the paper groups 2 and 3 would have built from: a delta that would have deleted three scenarios on sync, an unlegislated type export, groups extruding by the letter of the spec, a t-anchor formula that was the midpoint of nothing, a checker rule list that would have handed `text-overflow` phantom room |
| `effce7c` | winding read off the signed area — a mirrored dimension drew faces through the shape — and a `DEPTH` JSDoc that 1.4 had falsified |
| `5d32a79` | records made true: a false 20-vs-2 byte comparison, the rehearsal's content enumerated, the probe geometry written down |
| `fc6263d` | the wash that never was: three hand-order sentences opened with a wash no shape node draws |

## Group 2 — the renderer

| commit | what |
|---|---|
| `4c304a6` | 2.1 the pair rides `draw`; a group ignores it, in tsc and in the strict schema |
| `d4ae10b` | 2.2 anchors move by the full extrusion vector; loops ride them, notes keep their literal points |
| `173da5a` | 2.3 a depth that cannot be drawn refuses to, inherit corner included |
| `29f3b15` | T-D7 `./server` 4992→5120: the specced messages cost 118 B more than the rehearsal priced |
| `f171234` | 2.4 the types closeout, verified rather than rewritten |
| `398f2f4` | 2.5 the interaction probes; none needed a rule |

### Group 2 SWAT remediation (T-58..T-76)

| commit | what |
|---|---|
| `d88ddb5` | the hatch-phase formula I recorded was wrong — depth cancels — so the "aligned width" probe never tested alignment; re-rendered at the real one, verdict survived on real evidence |
| `081bbe1` | two mutants that survived all 481 tests now die: a validation guard dropping the options inherit, and a resolution dropping the group narrowing |
| `0dcd657` | four owner rulings written into the specs (T-57/T-60/T-65/T-66) |
| `37aa310` | the anchor follows the ink; and the rule turned out not to be the obvious one — a pill carries faces at `3·ARC_MIN_CHORD/π`, not under `ARC_MIN_CHORD` both ways |

## Group 3 — the checker

| commit | what |
|---|---|
| `82e0739` | 3.0 the flat-run gate, frozen before any rule could sweep |
| `484ab86` | 3.1+3.2 the sweep for ink rules, the front box kept for label rules, `edgePath` walking moved anchors |
| `71e7c32` | T-D7b `./check` 3648→3968, rehearsed with the messages written rather than stubbed — and it came in 3 B accurate |
| `d729a83` | 3.3 `undrawable-depth`: a depth the renderer refuses is a finding, not a pass |

### Group 3 SWAT remediation (T-77..T-101)

| commit | what |
|---|---|
| `97cc081` | T-92 the root entry moves, 5120→5248 with `./server`: the tripwire's third firing, which nobody caught because a budget that still passes raises no gate |
| `7fa9d47` | three shipped requirements had gone false — nine rule ids for a ten-rule checker, one exception where there are two, `at` promised as a place in the drawing |
| `0fb1074` | the sweep stops withdrawing findings: a mirrored node's ink ran 62 px outside the box the checker measured |
| `8560862` | the records priced, counted and handed over; two owner calls opened |

## Still to come

Groups 4 (tool boundary) and 5 (documentation) run back to back with one
SWAT covering both. Group 6 is the owner's: the core minor, the MCP peer
floor, and the release.
