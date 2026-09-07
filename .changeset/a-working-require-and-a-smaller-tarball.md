---
'@pensketch/mcp': minor
---

Three fixes to how this package is built and what it will accept. No tool
changes behaviour, and nothing an existing client does needs revisiting.

`require()` of this package now works, and never has. `render.ts` calls
`createRequire(import.meta.url)` and esbuild left that expression in the CJS
output, so both published `require` conditions threw on load. `tsup` gains
`shims`, and the exports gate - the only thing in the repository that loads
`dist/` - gains this package, which it had never been asked about. That gate is
why the next one cannot come back.

The tarball is a little over half what it was: 284 KB packed before, **152 KB**
now,
measured 2026-09-07. The two entries each inlined their own copy of the SDK;
as shared chunks they do not. Code splitting is what buys that, and it is
allowed here because no entry of this package is measured against a byte
budget. Dated rather than gated, for the same reason.

**A diagram is now capped at 500 nodes, 50 edges, and 500 braces or notes.**
This narrows an existing contract, so it is the one thing here a caller can
notice: a diagram over those counts worked before and is refused now.

The two numbers differ because the two costs do. Several of the checker's rules
compare every pair, so the work grows with the square - but a curved edge is
sampled into many chords before each crossing test, so edges cost far more per
pair than nodes. 500 overlapping nodes is 67 ms. 500 bowed edges is minutes.
Measured on a hub with n spokes: 50 bowed edges is 593 ms, 100 is 2.5 s, 200 is
9.8 s. Braces and notes are cheap - 200 of them cost 39 ms - and stay at 500.

Nobody hand-writes 500 nodes, so what a cap catches is a generated diagram. An
agent that gets an immediate refusal naming the number can act on it; a call
that simply takes a minute is a turn it can neither spend nor explain.
