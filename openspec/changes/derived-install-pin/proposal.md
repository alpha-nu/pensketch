# Proposal: derived-install-pin

> The version a reader is told to install, derived from the version the
> package carries — and a regeneration gate stated as a rule rather than as an
> inventory that goes stale.

## Why

`0.1.1` shipped while both READMEs still told a reader to install
`@pensketch/mcp@0.1.0` — the release whose `render_png` drew no stroke at all.
The instructions pointed at the broken version for as long as it took someone
to notice by hand.

The pin itself is right, and its reasoning stands: `npx` without a version
fetches whatever is latest when a client happens to start, which is a strange
way to decide what your tools do. What is wrong is that the number is typed
into prose, where it is invalidated by a bump made in a different pull request
by a tool that has no idea the prose exists.

The same failure has now happened three times in this repository in different
clothing — a resource count in a heading, an example count in a requirement
title, and this. In every case a fact with a short life was written somewhere
nothing checks.

## What changes

- `tools/pin-version.mjs` rewrites the install pin from
  `packages/mcp/package.json`, and fails rather than silently doing nothing if
  no pin is found.
- `npm run bump` — `changeset version && npm run pin` — is handed to the
  release action as its `version` command, so the corrected instructions land
  in the same pull request as the bump that invalidated them.
- CI regenerates the pin alongside the goldens, the schema and the served
  resources, under the assertion that the tree is unchanged.
- The requirement describing that gate stops listing artefacts by name and
  states the rule instead, since the list had already fallen behind.

## Impact

- **Affected specs**: `repo-tooling`, `documentation-and-examples`
- **Affected code**: `tools/pin-version.mjs`, root `package.json`,
  `.github/workflows/{ci,release}.yml`, `CONTRIBUTING.md`, both READMEs
- **Not affected**: no published code changes. The next release is the first
  that carries its own corrected instructions.
