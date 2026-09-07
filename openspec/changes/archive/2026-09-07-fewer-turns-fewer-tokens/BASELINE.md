# Baseline, measured 2026-09-06, before any lever

Captured against published `@pensketch/mcp` 0.7.0 over stdio, so the re-run
after this change compares like with like. Re-run the scenario verbatim.

## The scenario

> Draw a web request path: browser -> CDN -> load balancer -> app server; the
> app server reads a cache and falls through to a database on a miss; the
> database replicates to a read replica.

Result: 7 nodes, 6 edges, `viewBox [0, 0, 800, 520]`.

## What it cost

| measure | baseline |
|---|---|
| model turns | **4** (emit+check, fix+check, render->throw, fix labels+render) — see correction below |
| tool calls | **3** (`check_diagram` x2, `render_diagram` x1) |
| `check_diagram` rounds to clean | **2** |
| findings, round 1 | 2 warnings, both `text-overflow` |
| findings, round 2 | 0 |
| diagram tokens emitted, pretty-printed | **1,406** (703 per attempt) |
| the same minified | 700 |
| the same, minified + `shape` defaulted | 652 |
| tool schemas resident in context | 2,201 |
| transport per call | 0.4 ms stdio, 1.6 ms HTTP loopback, 89.9 ms at +40 ms/way |

Round-1 findings, verbatim:

```
warning text-overflow at (40, 380): the label on node "replica" needs about 198px and has 184px
warning text-overflow at (540, 40): the label on node "lb" needs about 215px and has 184px
```

## Correction, 2026-09-06, after the levers landed

**The baseline is 4 turns, not the 3 first recorded.** Turn 3 was counted
rather than executed, on the reasoning that `render_diagram` would return
32 KB of SVG and teach nothing. Running it later showed it does not return
SVG at all for this diagram: it throws.

```
check_diagram  -> "No findings."
render_diagram -> Error: edge 3 has label "READ" but lx and ly are not both
                  numbers; labels are placed by hand
```

The three edge labels carried no `lx`/`ly`. `check` does not look for that
and `draw` refuses it, so the diagram passed the checker and failed the
renderer. A fourth turn to place the labels was unavoidable.

Two things follow, and both are worth more than the corrected number.

1. **The caveat earned its place.** "Counted, not executed" was recorded as a
   caveat precisely because an unrun step is an unverified one, and it was
   the unverified step that was wrong.
2. **A gap exists between the two tools, and it is not this change's doing.**
   A caller obeying `check_diagram`'s own former instruction — run this
   before rendering — could still be refused by the renderer. The turn lever
   does
   not close it: folding findings into a successful render says nothing about
   a render that throws. Recorded here as found; whether `check` should carry
   the renderer's structural rules is an owner call, logged in `proposal.md`.

## Caveats, so the comparison stays honest

1. **The baseline is optimistic.** The agent already knew the schema and did
   not read `pensketch://schema`. A cold agent must, which is +4,774 tokens
   and plausibly a fourth turn. The re-run must either replicate that
   advantage or record that it did not.
2. **Turn 3 was counted, not executed** — and that was the mistake the
   correction above records. Left in place rather than rewritten, because a
   caveat that turned out to be load-bearing is worth more standing than
   tidied away.
3. **Wall clock is not measured here**, because generation rate belongs to
   whichever model runs the scenario. Turns and tokens are the measured
   quantities; seconds are derived, and any derived figure must say so.
4. **One scenario is one sample.** It was chosen to resemble the shipped
   figures (7 nodes against a 3-7 median) and it produced the ordinary
   failure, `text-overflow`. It is not a distribution.
