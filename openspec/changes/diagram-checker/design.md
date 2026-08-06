# Design: diagram-checker

Technical decisions for `@pensketch/core/check`. The delta spec states the
requirements; this file fixes the exact API, the rule predicates, and the two
numbers the rules turn on — both of which were measured rather than chosen.

## D1 — API

```ts
export type Severity = 'error' | 'warning';

export type RuleId =
  | 'duplicate-id'
  | 'node-overlap'
  | 'out-of-bounds'
  | 'label-collision'
  | 'text-overflow'
  | 'group-escape'
  | 'orphan-node';

export interface Finding {
  rule: RuleId;
  severity: Severity;
  /** One sentence, naming the fix where there is an obvious one. */
  message: string;
  /** Where to look, in the diagram's own coordinate space. */
  at: Point;
  /** What is involved: `node "gate"`, `edge 3`, `note 0`. */
  subjects: string[];
  /** Present when the finding rests on the text-width estimate (D3). */
  estimated?: true;
}

export interface CheckOptions {
  /** `[minX, minY, width, height]`. Without it, `out-of-bounds` does not run. */
  viewBox?: readonly [number, number, number, number];
  /** Gap a label's box must keep from a stroke, in px. Default 4. */
  clearance?: number;
  /** Glyph advance as a fraction of font size. Default 0.55 — see D3. */
  glyphWidth?: number;
  /** Gap a label must keep inside its node's box, in px. Default 8. */
  padding?: number;
  /** Raise, lower or disable individual rules. */
  rules?: Partial<Record<RuleId, Severity | 'off'>>;
}

export function check(diagram: Diagram, options?: CheckOptions): Finding[];
```

Findings are returned sorted by severity, then by rule id, then by `at` — so
the same diagram always produces the same array, which makes the output
snapshot-testable in exactly the way rendered SVG already is.

`check` is pure: it does not render, does not touch a DOM, does not mutate the
diagram, and returns before any element exists.

## D2 — The rules

| id | predicate | default |
|---|---|---|
| `duplicate-id` | two nodes share an `id` | **error** |
| `node-overlap` | two non-group node boxes intersect | **error** |
| `out-of-bounds` | a node box, label anchor or waypoint lies outside the `viewBox` | **error** |
| `label-collision` | a label's box (D4) comes within `clearance` of any edge's inflated path (D4) | warning |
| `text-overflow` | the widest estimated line exceeds `w - 2 * padding` | warning |
| `group-escape` | a non-group node box *partially* intersects a group box | warning |
| `orphan-node` | a non-group node no edge names | warning |

Two of these deserve their reasoning recorded.

**`duplicate-id` is an error because `draw` is silent about it today.** The
lookup is `for (const n of nodes) byId.set(n.id, n)`, so the second node wins
and every edge naming that id points at it. The picture is wrong in a way no
error message explains.

**`group-escape` tests partial intersection, not containment.** A node fully
outside a group is simply in another lane; a node fully inside is contained.
Only the half-in case is unambiguously a mistake, so that is the whole rule —
no guessing about which group a node "belongs" to.

`orphan-node` is the one rule that fires on legitimate diagrams — a legend
box, a standalone annotation. It is a warning and can be switched off, and it
stays because a node nothing points at is far more often a typo in an edge's
`from`/`to` than a deliberate island.

## D3 — Text width is estimated, and the default is measured

pensketch never measures text, and neither does this. Measuring means a font,
a canvas or a DOM, and therefore a dependency, which the package does not
have. `check` estimates:

```
width ≈ text.length * fontSize * glyphWidth
```

The default `glyphWidth` of **0.55** is not a guess. Every label in this
repository's own diagrams was rendered in the documented handwriting stack and
measured with `getComputedTextLength`:

| | factor |
|---|---|
| 16 real labels, mean | 0.462 |
| 16 real labels, min (`"lint"`) | 0.359 |
| 16 real labels, max (`"push"`) | 0.515 |
| `"WWWWWWWWWW"` | 0.988 |
| `"iiiiiiiiii"` | 0.250 |

0.55 clears the widest real label by about 7%, which makes the estimate
**deliberately conservative**: it over-states width, so it warns early rather
than missing a genuine overflow. That is the right bias for a caller that
cannot see the result — a false warning costs one edit, a miss costs a broken
picture nobody notices.

Text that is mostly capitals is under-estimated; a caller drawing
`"WWWWWWWWWW"` should raise the factor. Any finding that depends on this
carries `estimated: true` so a caller can weigh it differently.

## D4 — Geometry

**Label boxes.** `pen.label` writes `dominant-baseline: middle`, so the
label's `y` is the vertical *centre* of the text, not its baseline. A label of
`n` lines at size `s` therefore occupies:

```
height = (n - 1) * s * LINE_H + s        // LINE_H = 1.28
top    = y - height / 2
left   = x, x - w/2, or x - w            // anchor: start | middle | end
```

**Edge paths.** `anchor` is already exported, so an edge's ideal path is
`anchor(from) → ...via → anchor(to)` — computable without `draw` and without
rendering.

**Inflation.** The drawn line is not the ideal path. Every point is jittered
by up to `AMP / 2` (2.6 / 2 = 1.3 px) and the stroke is `WIDTH` wide (1.6 px).
The checker therefore inflates each segment by:

```
AMP / 2 + WIDTH / 2  =  1.3 + 0.8  =  2.1 px
```

before applying `clearance`. With the default clearance of 4, a 13.5 px
single-line label needs its centre **12.85 px** from an edge before the rule
goes quiet — which is why placing a label 9 px above a connector, as the OAuth
example first did, produced three labels with lines through them.

## D5 — Packaging

- `src/check.ts`, added to tsup's `entry` array.
- `exports` gains `"./check"` with the same nested `types`/`import`/`require`
  shape the root entry already uses.
- `tools/check-size.mjs` gains a third budget: **1536 B** min+gzip. The main
  entry's 5120 B budget is unchanged and unaffected — separate entry,
  `sideEffects: false`, so a consumer who never imports the subpath ships
  nothing extra.
- CI runs the checker over the repository's own diagrams: the three examples
  and the README hero. The project that ships the rules is the first thing
  held to them.

## D6 — What `check` never does

Hard walls, restated here because each is a thing a reasonable person would
otherwise add:

- **It never moves anything.** No auto-layout, no suggested coordinates. The
  finding says where the problem is; the caller decides.
- **It never measures text.** See D3.
- **It never renders.** No DOM, no SVG, no browser.
- **It has no taste.** Empty space, colour and balance are not defects.
