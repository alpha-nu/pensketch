# Tasks: derived-install-pin

Small enough to do inline, and done in the same sitting it was written. Listed
so the archive records what was actually changed.

## 1. The generator

- [x] 1.1 `tools/pin-version.mjs` — rewrite `@pensketch/mcp@<semver>` in both
      READMEs from the manifest version; idempotent
- [x] 1.2 Exit non-zero when no pin is found, since a README that lost its pin
      would otherwise leave the tool silently succeeding over nothing
- [x] 1.3 Match only an install pin. Verified against a version named as
      history across a line break, a `>=` range, and `@pensketch/core@…`

## 2. Wiring

- [x] 2.1 `npm run pin`, named alongside the other generators
- [x] 2.2 `npm run bump` = `changeset version && npm run pin`. Not named
      `version`: npm reserves that as a lifecycle hook of its own
- [x] 2.3 `release.yml` passes `version: npm run bump` to the changesets
      action, so the corrected instructions land in the version pull request
- [x] 2.4 `ci.yml` regenerates the pin inside the tree-clean assertion

## 3. Documentation

- [x] 3.1 CONTRIBUTING gains the command, and a section on working alongside
      the release: two writers on `main`, and `pull.rebase`
- [x] 3.2 The heading stops counting the commands, and so does the closing
      line. The count has changed twice
- [x] 3.3 `npm run diagrams` no longer described as covering "both HTML
      examples" — there are three

## 4. Verification

- [x] 4.1 Simulated a bump to `0.1.2` and confirmed all three pins followed,
      then reverted
- [x] 4.2 Confirmed idempotence: a second run rewrites nothing
- [x] 4.3 Every verification command green from a tree with no prior build
- [x] 4.4 `openspec validate derived-install-pin --strict`

Gate: all verification commands green; a simulated bump moves the READMEs and
nothing else.
