# Tasks: initial-release

Execute groups in order. A group is done when the verification commands in
`CLAUDE.md` are green, a self-review of the group's diff has been made, and
every finding is fixed. Items marked **OWNER** are performed by the repo
owner, never the agent — surface them when unblocked and continue with what
does not depend on them.

## 1. Scaffold

- [x] 1.1 Root `package.json` (private, workspaces, engines, the six scripts —
      design.md D6 verbatim), `.gitignore` (node_modules, dist, coverage),
      `git init` if needed
- [x] 1.2 `LICENSE` (MIT, Anas K), root `README.md` stub, `CONTRIBUTING.md`
      per documentation spec
- [x] 1.3 `tsconfig.base.json` + per-package tsconfigs, `biome.json`, vitest
      config with jsdom + 90% line/branch thresholds and the D6 coverage
      excludes
- [ ] 1.4 `packages/core/package.json` and `packages/react/package.json`
      exactly per design.md D6 (names, exports map, `publishConfig.access:
      public`, react deps/peers; no `workspace:*`)
- [ ] 1.5 tsup configs; `tools/check-size.mjs` (budgets 5120/2048 B min+gz)
- [ ] 1.6 `.github/workflows/ci.yml` (D6 step order incl. goldens-freshness
      diff) and `.github/workflows/release.yml` (workflow_dispatch, changesets
      publish with provenance)
- [ ] 1.7 changesets init (`access: public`, `baseBranch: main`)
- [ ] 1.8 **OWNER**: push to the existing `alpha-nu/pensketch` repo; npm
      account with 2FA; create npm org `@pensketch` (reserves the namespace;
      if taken by an existing user, stop and re-decide naming); optional
      `0.0.1` placeholder publishes and/or unscoped `pensketch` pointer
      package; add `NPM_TOKEN` secret

Gate: lint + typecheck + build green on the skeleton.

## 2. Core port + golden parity

- [ ] 2.1 `src/rng.ts` (mulberry32, verbatim semantics)
- [ ] 2.2 `src/constants.ts` (every aesthetic constant named — design.md D3)
- [ ] 2.3 `src/theme.ts` (`Theme`, `defaultTheme`, shallow merge — D4)
- [ ] 2.4 `src/pen.ts` (primitives, faithful port, `ownerDocument` creation)
- [ ] 2.5 `src/draw.ts` (`draw`, `anchor`, validation, normative order)
- [ ] 2.6 `src/types.ts` + `src/index.ts` (closed surface per D2)
- [ ] 2.7 Shared serializer util (D5) under `packages/core/test/`
- [ ] 2.8 `tools/generate-goldens.mjs` (jsdom over the reference) + checked-in
      goldens + TS fixture copies of SAMPLER/BUDGETS (`\uXXXX` escapes)
- [ ] 2.9 Parity tests: port output === goldens byte-for-byte via the
      reference-theme bridge

Gate: parity green; goldens-freshness green.

## 3. Core hardening

- [ ] 3.1 Unit tests: primitives structure, draw order, idempotent redraw,
      aria labeling, validation errors with exact messages, theme fallbacks
      and partial override, jsdom-independence; ≥90% both dimensions
- [ ] 3.2 JSDoc on all exports incl. `@example` on `draw`/`pen`
- [ ] 3.3 Size budget met; `npm run size` wired
- [ ] 3.4 `packages/core/README.md` per documentation spec

Gate: all six verification commands green.

## 4. React package

- [ ] 4.1 `PenSketch.tsx`, `useSketch.ts`, `index.ts` per design.md D2
- [ ] 4.2 Tests: mount draw, seed-change redraw, identity-stable no-redraw,
      StrictMode double-effect, `renderToString` SSR, `useSketch` pen
      delivery; ≥90%
- [ ] 4.3 JSDoc incl. `@example` on `PenSketch`/`useSketch`; size budget;
      `packages/react/README.md`

Gate: all six verification commands green.

## 5. Examples + documentation

- [ ] 5.1 `examples/vanilla/index.html` (A1 + A4; relative dist import
      commented as the only divergence)
- [ ] 5.2 `examples/custom-pen/index.html` (A3 + one `raw`-callback `draw()`)
- [ ] 5.3 `examples/react/` Vite app (BUDGETS via `<PenSketch>`,
      `CustomSketch` via `useSketch`, StrictMode on) — files per design.md D7
- [ ] 5.4 `tools/render-assets.mjs` → `docs/assets/hero-{light,dark}.png`
      (2×, corner-pixel-verified, committed)
- [ ] 5.5 Root `README.md` complete — every section of the documentation
      spec, snippets byte-identical to Appendix A
- [ ] 5.6 Screenshot-verify all three examples (headless Chrome, light + dark)

Gate: examples render correctly; README snippet diff vs Appendix A clean.

## 6. Release readiness

- [ ] 6.1 Changesets present for everything shipped; versions resolve to
      `0.1.0`
- [ ] 6.2 `npm pack --dry-run` per package: dist + README + license only
- [ ] 6.3 Fresh-clone dry run: `npm ci && npm test && npm run build`
- [ ] 6.4 Confirm no `TODO(owner)` markers or unresolved URLs remain in either
      package README
- [ ] 6.5 **OWNER**: trigger `release.yml` to publish `0.1.0`

Gate: dry runs green; publish left to owner.
