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
- [x] 1.4 `packages/core/package.json` and `packages/react/package.json`
      exactly per design.md D6 (names, exports map, `publishConfig.access:
      public`, react deps/peers; no `workspace:*`)
- [x] 1.5 tsup configs; `tools/check-size.mjs` (budgets 5120/2048 B min+gz)
- [x] 1.6 `.github/workflows/ci.yml` (D6 step order incl. goldens-freshness
      diff) and `.github/workflows/release.yml` (workflow_dispatch, changesets
      publish with provenance)
- [x] 1.7 changesets init (`access: public`, `baseBranch: main`)
- [ ] 1.8 **OWNER**: push to the existing `alpha-nu/pensketch` repo; npm
      account with 2FA; create npm org `@pensketch` (reserves the namespace;
      if taken by an existing user, stop and re-decide naming); optional
      `0.0.1` placeholder publishes and/or unscoped `pensketch` pointer
      package; add `NPM_TOKEN` secret; enable Settings → Actions → General →
      "Allow GitHub Actions to create and approve pull requests", which is off
      by default for organizations and without which the first release
      dispatch cannot open its version pull request

Gate: lint + typecheck + build green on the skeleton. `npm test` and
`npm run goldens` stay red until group 2 supplies tests and the generator;
the per-group gate below governs, and the six-command gate applies from
group 3 onward. Do not green them early with `--passWithNoTests`, a
placeholder test, or a placeholder golden.

## 2. Core port + golden parity

Porting rules for this group: `noUncheckedIndexedAccess` will flag roughly a
dozen sites in the reference's dense indexing. Resolve each at the type level
first — a total lookup for the shape dispatch — then a type assertion where
the type cannot express it. Never a non-null assertion (lint warns on every one) and
never a runtime guard: guards are forbidden defensive code, and their dead
branch sinks the 90% branch threshold on its own.

- [x] 2.1 `src/rng.ts` (mulberry32, verbatim semantics)
- [x] 2.2 `src/constants.ts` (every aesthetic constant named — design.md D3)
- [x] 2.3 `src/theme.ts` (`Theme`, `defaultTheme`, shallow merge — D4)
- [x] 2.4 `src/pen.ts` (primitives, faithful port, `ownerDocument` creation)
- [x] 2.5 `src/draw.ts` (`draw`, `anchor`, validation, normative order)
- [x] 2.6 `src/types.ts` + `src/index.ts` (closed surface per D2)
- [x] 2.7 Shared serializer util (D5) at `packages/core/test/serialize.mjs`
      (plain ESM — the generator must import the same function and Node 20
      cannot import `.ts`), plus a test asserting its exact output for a
      hand-built fragment: the goldens and the assertions both flow through
      it, so a bug in it is invisible to every parity test
- [x] 2.8 `tools/generate-goldens.mjs` (jsdom over the reference) + checked-in
      goldens + TS fixture copies of SAMPLER/BUDGETS (`\uXXXX` escapes)
- [x] 2.9 Parity tests: port output === goldens byte-for-byte via the
      reference-theme bridge
- [x] 2.10 `.gitattributes` marking `packages/core/test/goldens/**` binary
      (`-text`), so the files whose bytes are the contract are never subject
      to line-ending normalization

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
      delivery; ≥90%. Needs a react-project setup file running
      `afterEach(cleanup)` — Testing Library only self-registers cleanup when
      `afterEach` is a global, which it is not here, so mounted trees would
      otherwise leak between cases
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
      `0.1.0`. The release changeset must name **both** packages: a minor on
      core alone gives react a dependent patch bump to `0.0.2`, not `0.1.0`
- [ ] 6.2 Copy `LICENSE` into each package directory (a real file, never a
      symlink — npm anchors its automatic licence inclusion to the package
      root and never follows symlinks), then `npm pack --dry-run` per
      package: dist + README + license only
- [ ] 6.3 Fresh-clone dry run: `npm ci && npm test && npm run build`
- [ ] 6.4 Confirm no `TODO(owner)` markers or unresolved URLs remain in either
      package README
- [ ] 6.5 **OWNER**: publishing `0.1.0` takes two dispatches of `release.yml`
      — the first opens the "Version Packages" pull request (no publish), and
      after merging it the second publishes the bumped versions. Note a
      dispatch made when no changeset files exist skips straight to
      publishing whatever versions the manifests currently carry

Gate: dry runs green; publish left to owner.
