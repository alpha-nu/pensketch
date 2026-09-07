# Re-run, 2026-09-06, levers 1 and 2 landed

Same scenario as `BASELINE.md`, driven against the locally built server. The
connected MCP client still points at published 0.7.0, so the re-run drove
`dist/stdio.js` directly rather than through the tool boundary.

## What the re-run showed

| turn | call | result |
|---|---|---|
| 1 | `render_diagram` | **throws**: edge 3 has `label` but no `lx`/`ly` |
| 2 | `render_diagram` | SVG 32,674 B **+ 6 warnings** |
| 3 | `render_diagram` | SVG 33,143 B **+ 2 warnings** |

## The comparison, and why it is not a clean 2x

| | baseline | after |
|---|---|---|
| turns to a drawn diagram | 4 (corrected) | 3 |
| separate `check_diagram` calls | 2 | **0** |
| tokens per attempt | 745 pretty | **350** minified + defaulted, **-53%** |
| tokens across 3 attempts | 2,235 | **1,050** |

**Lever 1 landed as measured.** 745 tokens becomes 350: minification is 50%
of it and the `shape` default the remaining 3%. This is the reliable half of
the change, because the default is enforced by the type while the minification
is only requested by a description.

**Lever 2 removes exactly one turn per fix cycle**, which is what it claimed
and no more. The check call disappears; the fix cycles do not.

**The baseline understated the work, twice.** Its attempt 2 was recorded as
clean on 2 warnings. Once the labels were actually placed, the same geometry
reports **6**: three `label-collision`, one `text-collision`, two
`text-overflow`. The three collision rules had nothing to measure while
`lx`/`ly` were missing, so a structurally invalid diagram looked tidier than a
valid one. Turn 3 still leaves 2 label collisions, so this scenario needs a
fourth pass either way.

That is the honest headline: **the levers did not make this diagram cheap,
they made each pass cheaper and removed one pass.** What still costs turns is
that the first attempt was wrong in four ways, and nothing here fixes that.

## Contamination, stated

The baseline agent did not know about `lx`/`ly`. The re-run agent did, because
it had just been shown the error. A cold agent re-running this would likely
repeat turn 1. The turn counts above are therefore a floor for the re-run and
honest for the baseline, which flatters the re-run by up to one turn.
