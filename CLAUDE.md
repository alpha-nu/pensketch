# pensketch — agent operating instructions

You are building `@pensketch/core` and `@pensketch/react`: a tiny,
zero-dependency, seeded hand-sketch SVG diagram renderer, ported from a
working reference implementation.

This repository uses **OpenSpec**. The complete specification lives in
`openspec/changes/initial-release/`:

- `proposal.md` — why and what
- `design.md` — all technical decisions: exact API surface (D2), rendering
  behavior and constants (D3), theming (D4), the golden byte-parity protocol
  (D5), exact config contents (D6), documentation/examples plans and the
  canonical snippets Appendix A (D7)
- `specs/*/spec.md` — the requirements (core-renderer, react-bindings,
  repo-tooling, documentation-and-examples)
- `tasks.md` — the execution checklist; mark items `[x]` as you complete them

Read all of it before writing any code. `reference/renderer.html` is the
normative, **read-only** ground truth. Use `openspec show initial-release`
and run `openspec validate initial-release --strict` after editing any spec
artifact. When the change is fully implemented and released, archive it per
OpenSpec convention.

## Invariants (non-negotiable)

1. **Zero runtime dependencies** in both packages. Dev dependencies are fine
   at the root. `@pensketch/react` depends only on `@pensketch/core`
   (regular) and `react` (peer).
2. **Determinism.** Package source never calls `Math.random`, `Date`,
   `performance`, timers, or locale-dependent APIs. All randomness flows from
   the seeded `mulberry32`. The *order* of PRNG calls is part of the public
   contract — reordering draw operations is a visual change even if it looks
   the same.
3. **The reference is read-only.** Never edit `reference/renderer.html`. If
   you believe it is wrong, stop and present the issue to the owner.
4. **Golden discipline.** Never regenerate goldens to make a failing test
   pass. A golden changes only when a visual change is intended — with a
   before/after PNG pair in the commit and a minor changeset describing the
   shift (design.md D5).
5. **ASCII source.** Fixture and label strings use `\uXXXX` escapes for any
   non-ASCII glyph. HTML files declare `<meta charset="utf-8">` and may use
   entities in markup — but JS strings still use escapes. No literal
   multi-byte characters in source files.
6. **Coverage ≥ 90%** lines and branches per package, enforced in vitest
   config, never lowered.
7. **No scope creep.** The non-goals in design.md D1 are hard walls. No extra
   options, no "while I'm here" features, no defensive guards beyond the
   validation the core-renderer spec lists.
8. **Never publish, never push.** No `npm publish`, no GitHub repo creation,
   no `git push`, no tags. Those are owner actions. Committing locally is
   your job: granular conventional commits (`feat(core): ...`,
   `test(react): ...`), linear history.
9. **Single-source snippets.** README and example code comes verbatim from
   design.md Appendix A (import lines in examples are the only divergence).
   If an API change invalidates a snippet, update Appendix A in the same
   commit and propagate everywhere.
10. **No unrequested documents.** The documentation set is closed by the
    documentation-and-examples spec. Code comments state invariants
    self-contained — never cite task numbers, review rounds, or spec section
    labels.

## Working process

- Follow `tasks.md` groups in order; mark tasks complete as you go. A group
  is done only when its gate passes, a self-review of the group's diff has
  been made, and **every** finding — including "deferrable" ones — is fixed.
- Port style: translate the reference faithfully first (group 2), get parity
  green, and only then refactor within byte-parity — the parity tests are the
  safety net; run them after every refactor step.
- If the spec conflicts with something you discover (a jsdom limitation, an
  unmeetable budget, an API that won't typecheck cleanly), stop and present
  options with tradeoffs to the owner. Do not silently deviate.

## Verification commands (run from repo root)

```
npm run lint          # biome check .
npm run typecheck     # tsc --noEmit in each package
npm test              # vitest run --coverage (both packages)
npm run build         # tsup (both packages)
npm run goldens       # node tools/generate-goldens.mjs (then git diff must be clean)
npm run size          # dist size budgets: core <= 5120 B, react <= 2048 B min+gz
```

All six must pass before any task group is declared complete. CI mirrors them.
