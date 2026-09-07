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

## Correction, and it changes the headline

The first draft of this file reported **745 tokens per attempt falling to
350, "-53%", of which minification was 50% and the `shape` default 3%.**
Every one of those numbers is withdrawn. None had a source, and `BASELINE.md`
contradicts them on the same page: it measured **703** per attempt, not 745.

The mistake was splicing two different measurements. The ~50% belongs to a
corpus measurement of this repository's own shipped figures, where "pretty"
means `JSON.stringify(diagram, null, 2)`. The baseline agent never wrote that
spelling. It already wrote compactly, so on its diagram the request bought
**three tokens**. The corpus ratio was then applied to a diagram it was not
measured on, and a "before" figure was invented to make it land.

## What was actually measured

Per attempt, on the scenario diagram, from `BASELINE.md`:

| spelling | tokens | against the one above |
|---|---|---|
| as the agent emitted it | 703 | — |
| minified | 700 | **-0.4%** |
| minified, `shape` defaulted | 652 | **-6.9%** |

And on the corpus, which unlike the scenario diagram is preserved and can be
re-measured by anyone, all 15 diagrams `shippedDiagrams()` returns:

| spelling | tokens | against the one above |
|---|---|---|
| `JSON.stringify(d, null, 2)` | 14,804 | — |
| `JSON.stringify(d)` | 7,466 | **-49.6%** |
| the same, every `shape: "box"` dropped | 7,182 | **-3.8%** |

Both tables use `gpt-tokenizer`'s `o200k_base`. The corpus one is reproduced
by this, which is written down here because the last measurement was not and
that is why this section exists:

```js
import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import { shippedDiagrams } from './tools/shipped-diagrams.mjs';
const drop = (d) => JSON.parse(JSON.stringify(d, (k, v) =>
  k === 'shape' && v === 'box' ? undefined : v));
let P = 0, M = 0, D = 0;
for (const { diagram } of await shippedDiagrams()) {
  P += encode(JSON.stringify(diagram, null, 2)).length;
  M += encode(JSON.stringify(diagram)).length;
  D += encode(JSON.stringify(drop(diagram))).length;
}
console.log({ P, M, D });
```

## What each lever is worth

**The turn lever landed exactly as claimed.** Four turns to three, and both
separate `check_diagram` calls gone. One turn per fix cycle, no more, and it
is enforced: `render_diagram` cannot now return markup without findings.

**The `shape` default landed, small and reliable.** 3.8% of the corpus, 6.9%
of the scenario diagram. It is enforced by the type, so it is worth that
whatever the model does.

**The compact-JSON request is the one that has not earned its number.** 49.6%
is real, but it is measured against a machine's pretty-printer, and the only
agent this project has actually watched emit a diagram was already within
0.4% of minified. Nothing enforces it, nothing gates it, and no A/B has been
run against a model that spells JSON differently. Treat 49.6% as the ceiling
for an agent that pretty-prints and 0.4% as the floor for one that does not.
The description is honest that it can only ask; this file should be honest
that asking has not yet been shown to change anything.

## What the levers did not fix

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

## Did the re-run read `pensketch://schema`?

**No, and neither did the baseline.** Caveat 1 of `BASELINE.md` required this
to be stated rather than left to inference. Both runs were driven by an agent
that already knew the data model, so neither paid the 4,774-token cold read.
Both columns are therefore optimistic by the same amount, which is why the
comparison between them survives; neither is a figure to quote at a cold
agent. Lever 3 chose to leave that read to client caching, so nothing in this
change was ever going to move it.

## Contamination, stated

The baseline agent did not know about `lx`/`ly`. The re-run agent did, because
it had just been shown the error. A cold agent re-running this would likely
repeat turn 1. The turn counts above are therefore a floor for the re-run and
honest for the baseline, which flatters the re-run by up to one turn.

## What was not preserved, and the rule that follows

The JSON both runs emitted was not kept, so neither per-attempt figure can be
re-derived — only quoted from `BASELINE.md`, which is why the 745 stood
uncontradicted for as long as it did. A measurement whose subject is thrown
away is a claim. The corpus table above exists because its subject is in the
repository and its script is on this page.
