# Proposal: edge-overlap-sees-a-shared-trunk

> `edge-overlap` fires only when two connectors lie on one another along their
> *whole* length. The common defect is a pair that shares a trunk and then
> diverges, and the rule is silent on every one of them.

## Why

**The rule missed the worst thing in this repository's own showcase, and the
gate said nothing.** Measured on `examples/showcase/index.html` before its
routing was reworked:

```
page->root  / react->root    76px shared
mcp->check  / mcp->server    58px
mcp->check  / mcp->schema    58px
mcp->server / mcp->schema    70px
```

262 px of line drawn along other line, in the three places a reader could not
tell what connected to what. `npm run diagrams` reported **0 errors, 0
warnings** on that file, before and after the fix. The defect was found by
looking at a render, which is the thing this checker exists so that nobody has
to do.

**The gap is structural, not a tuning problem.** `along` asks that *every*
sampled point of each path lie near some segment of the other, measured both
ways round. A pair that shares a trunk and then separates has points at the far
end of each that the other never comes near, so the test is false and the rule
is quiet. It was written for an edge and its reverse — two paths that coincide
entirely — and it does that correctly.

**A shared trunk is the same defect as a shared whole.** Two connectors drawn
along each other are one line in the picture and two in the data, and the
drawing looks deliberate either way. Length changes how much of the picture
lies, not whether it does.

## What changes

- **`edge-overlap` SHALL also fire on a shared run**: a stretch where two paths
  lie within the same distance of one another for more than `OVERLAP_MIN` px,
  even though each path leaves the other before it ends.
- **`OVERLAP_MIN` is calibrated against the diagrams this repository ships**,
  both ways: low enough to catch 58 px, high enough that the ten shipped
  diagrams — which are believed good — stay quiet. A rule that cries on a
  correct picture is a rule people switch off.
- **The finding names the shared length**, because "these two overlap" and
  "these two share 76 px" are different amounts of help when the fix is to move
  one line.
- **Still a warning, and still not fired on a crossing.** A pair on one line is
  sometimes meant, and two connectors that cross are a different thing entirely
  — `connectors-hop-at-a-crossing` is what addresses those.

## Impact

- **Affected specs**: `diagram-checker` (modified), `repo-tooling` (a budget
  moves, if the measurement says so).
- **Affected code**: `packages/core/src/check.ts`, `constants.ts`.
- **Byte budget.** `@pensketch/core/check` stands at **3008 against 3072** — 64
  bytes of headroom, the tightest entry in the repository. This rule will not
  fit in 64 B, so the budget moves first, in its own commit, against a measured
  prototype rather than a guess.
- **The shipped diagrams are the acceptance test.** All ten pass today. If the
  new rule fires on any of them, either the threshold is wrong or that diagram
  has a defect nobody had noticed — and which of the two it is has to be
  settled by looking, not by moving the number until the gate goes quiet.
