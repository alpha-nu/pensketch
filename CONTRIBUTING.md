# Contributing to pensketch

## Setup

Node 22 or newer is required. Clone the repository and run `npm ci` at the
root. The repository is an npm workspace: the two published packages live in
`packages/core` and `packages/react`, and a single root install wires them
together, so run every command from the root unless told otherwise.

## The six verification commands

- `npm run lint` - Biome check across the repository. Proves formatting and
  lint rules hold everywhere; Biome is the only formatter and the only linter.
- `npm run typecheck` - `tsc --noEmit` in each package. The build step does
  not typecheck, so this is the only gate that proves the types are sound.
- `npm test` - vitest with coverage. Proves behavior is correct and that each
  package still meets the 90% line and branch coverage thresholds. Those
  thresholds are never lowered to make a run pass.
- `npm run build` - tsup in each package. Proves both packages still produce a
  working ESM build, CJS build, and `.d.ts` declarations.
- `npm run goldens` - regenerates the golden files from the reference
  renderer. `git diff` must be clean afterwards, which proves the reference,
  the generator, and the checked-in goldens have not drifted apart.
- `npm run size` - gzipped size budgets. Proves the minified, gzipped ESM
  entry point stays within budget: 5120 bytes for core, 2048 bytes for react.

All six must pass before a change is complete. CI runs the same six on every
pull request and every push to `main`, so a local failure is a CI failure.

## Golden files

The goldens are generated from the reference renderer only, never from the
ported implementation. Generating them from the port would make the parity
tests compare the port to itself, which proves nothing.

The reference renderer is read-only. It is the ground truth the port is
measured against, so editing it to settle a disagreement moves the target
instead of finding the fault. If you believe the reference is wrong, stop and
raise it.

A golden file changes only when a visual change is intended. Such a commit
carries a before/after PNG pair showing the shift, and a minor changeset
describing what moved.

Never regenerate goldens to make a failing test pass. A failing golden means
the rendered output moved - that signal is the entire reason the test exists,
and regenerating it destroys the evidence. Find out what moved and decide
whether you meant it.

There is one case where the answer is to regenerate. Trigonometry decides
where a stroke wobbles, and the language leaves those functions approximate,
so a JavaScript engine may change a result in the last digit across a major
upgrade. The signature is unmistakable: the goldens and the parity tests fail
together, on a commit that changed no source, and the diff is a handful of
final digits inside path data. That is the engine moving, not the renderer.
Regenerate deliberately, with the before and after images, and say so in the
changeset.

## Patch vs minor

Every user-visible change carries a changeset; create one with
`npx changeset`. Before 1.0 the split is:

- **patch** guarantees byte-identical rendered output on a given JavaScript
  engine. Same input, same seed, same engine, same bytes as the previous
  version.
- **minor** may change rendered output or add API. Its changeset must say that
  output changes and describe what shifts, so anyone snapshot-testing their
  own diagrams knows why their snapshots moved.

Any change to an aesthetic constant, or to the order in which the seeded
random number generator is consumed, changes the rendered bytes. That makes it
a minor, even when the diagram looks identical to the eye. Reordering draw
operations is such a change.

## Project invariants

These hold regardless of what a change is trying to do.

**Neither package takes a runtime dependency.** Development tooling lives at
the repository root; `@pensketch/react` reaches for `@pensketch/core` and the
host's React and nothing else. A new entry under `dependencies` in either
published package is a design decision, not an implementation detail.

**The look is fixed.** The jitter, the double stroke, the corner overshoot and
every constant behind them are the product rather than a set of knobs. They do
not become options. There is no automatic layout, no edge routing, no text
measurement, and no canvas renderer - a diagram's coordinates are the author's
to choose.

**Nothing in package source reads the outside world.** No `Math.random`, no
clock, no timers, no locale-dependent formatting, and no reference to a global
`document` or `window` - elements are created through the target element's own
document. A test enforces this by reading the source, because output rendered
on one machine cannot witness it.

**Code in a README has one source.** The snippets in the root and package
READMEs are copies of the canonical blocks in the change's design document,
and the examples are copies of the same blocks with their import line adapted.
Change the canonical block and propagate, in the same commit; do not edit a
copy in place.

## ASCII source

Source files contain no literal multi-byte characters. Fixture and label
strings use `\uXXXX` escapes for any non-ASCII glyph, which keeps rendered
output independent of file encoding and keeps diffs readable everywhere.

HTML files declare `<meta charset="utf-8">` and may use HTML entities in
markup, but JavaScript and TypeScript strings inside them still use escapes.
