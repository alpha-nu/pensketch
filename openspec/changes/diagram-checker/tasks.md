# Tasks: diagram-checker

Execute groups in order. A group is done when the verification commands in
`CONTRIBUTING.md` are green, a self-review of the group's diff has been made,
and every finding is fixed. Items marked **OWNER** are performed by the repo
owner, never the agent.

## 1. Geometry and the finding shape

- [ ] 1.1 `packages/core/src/check.ts` with the D1 types — `Severity`,
      `RuleId`, `Finding`, `CheckOptions`, `check` — and no rules yet, so the
      shape is reviewable before any predicate depends on it
- [ ] 1.2 Internal geometry helpers: label box from
      `(x, y, lines, size, anchor)` honouring `dominant-baseline: middle` and
      `LINE_H`, node box, box intersection, and point-to-segment distance.
      Each gets a unit test with hand-computed expectations, not
      self-referential ones
- [ ] 1.3 Edge path derivation from the exported `anchor` plus `via`, with a
      test asserting the path matches what `draw` renders for a known edge —
      the two must not drift
- [ ] 1.4 Segment inflation by `AMP / 2 + WIDTH / 2`, read from `constants`
      rather than re-declared, with a test that fails if either constant moves
      and the checker does not follow

## 2. The rules

- [ ] 2.1 `duplicate-id` and `orphan-node` — pure id analysis, no geometry
- [ ] 2.2 `node-overlap` and `group-escape`, including the case that must
      *not* fire: a node wholly outside a group
- [ ] 2.3 `out-of-bounds`, and the documented behaviour when no `viewBox` is
      supplied
- [ ] 2.4 `text-overflow` with the D3 estimate, `estimated: true` on the
      finding, and a test pinning the default `glyphWidth` against the
      measured table
- [ ] 2.5 `label-collision` over edge labels and note text, with a regression
      test built from the OAuth example's original coordinates — the ones that
      shipped three struck-through labels — asserting all three are found
- [ ] 2.6 Severity overrides and `off`, and the stable sort. A test asserting
      two runs are deeply equal, and one asserting sort order does not depend
      on rule evaluation order

## 3. Packaging

- [ ] 3.1 `src/check.ts` added to tsup `entry`; `exports` gains `./check` with
      the nested `types`/`import`/`require` shape
- [ ] 3.2 `tools/check-size.mjs` gains the 1536 B budget for the subpath, and
      the existing core budget is asserted unchanged
- [ ] 3.3 Resolution test: import the built subpath as ESM and require it as
      CJS, asserting both expose exactly the D1 surface — the same treatment
      the root entry already gets
- [ ] 3.4 Coverage thresholds extended to the new source, at the same 90%
      lines and branches

## 4. First-party use and documentation

- [ ] 4.1 `tools/check-diagrams.mjs` running the checker over every diagram
      this repository ships — the three examples and the hero — exiting
      non-zero on any `error`
- [ ] 4.2 Wire it into CI after the size check, and into the `CONTRIBUTING.md`
      verification list
- [ ] 4.3 Fix whatever it finds in the shipped diagrams. Findings here are
      binding: the rules are not credible if the project shipping them fails
      its own
- [ ] 4.4 README section documenting `check`, the rule table, and the
      estimation caveat; `packages/core/README.md` likewise
- [ ] 4.5 A changeset: **minor** on `@pensketch/core`. New API, no rendered
      output change — patch is reserved for byte-identical releases and this
      draws nothing

Gate: every verification command green, the checker clean over the
repository's own diagrams, `openspec validate diagram-checker --strict` green.
