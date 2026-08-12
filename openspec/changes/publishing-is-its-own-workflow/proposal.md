# Proposal: publishing-is-its-own-workflow

> One dispatch button does two things that differ in reversibility, and which
> one you get is decided by repo state rather than by the operator. Split it,
> and stop the publish path from re-running a subset of CI.

## Why

**The operator cannot see which action they are taking.**
`.github/workflows/release.yml` names its job `Version or publish`. The
changesets action chooses between the two internally: with unreleased
changesets present it opens a version pull request, and with none it publishes.
So one button either opens a reversible pull request or puts bytes on a public
registry and pushes tags — and you tell which by remembering whether you merged
the last "Version Packages" pull request.

**The workflow already admits this.** Its last step exists only to report,
after the fact, which of the two branches was taken. A step whose job is to
tell you what just happened is a workflow that could not tell you what was
about to.

**The publish path is a weaker gate than CI, not a stronger one.** `release.yml`
re-runs lint, typecheck, tests, build, goldens and size. `ci.yml` runs all of
those plus `exports`, `stdio`, `diagrams`, the whole-tree regeneration
assertion, the Node floor and the React 18 matrix. So the last gate before the
registry checks less than the gate that already passed on the same commit. That
is incoherent either way: if the release trusts CI, six re-runs are theatre; if
it does not, four gates are missing.

**A credential that only one job needs is held by both.** `id-token: write` is
what npm exchanges for a publishing credential. Today the versioning path runs
under it too, because it is the same job.

**The semver clause classifies one axis and is silent on the other.** patch and
minor are defined by rendered bytes: patch guarantees byte-identity, minor may
move output or add API. Neither mentions removing or narrowing. So a change
that deletes a published name, or refuses input it used to accept, renders
byte-identically for everything that still works and qualifies as a patch by
the letter — and `^0.3.0` means `>=0.3.0 <0.4.0`, so a patch arrives on a
consumer's next install without being chosen. The rule that would prevent it
belongs in the same requirement, which this change is already restating.

## What changes

- **`version.yml`** — opens or updates the version pull request, and nothing
  else. No `id-token`, so the job that bumps numbers cannot mint a credential
  that publishes. Refuses to run when there is no changeset to version.
- **`publish.yml`** — publishes and pushes tags, and nothing else. Refuses to
  run when a changeset is still pending, naming the other workflow.
- **`release.yml`** is deleted. Its two responsibilities are the two files
  above.
- **The publish path asserts CI rather than repeating part of it**: it requires
  that `ci.yml` concluded successfully on the exact commit being published, and
  keeps only the steps that assemble the artefact (`npm ci`, `npm run build`)
  and the precondition whose failure is otherwise unreadable (the runner's npm
  being new enough to exchange an OIDC token).
- **The compatibility axis is written down**, in the same requirement and in
  `CONTRIBUTING.md`: removing or renaming a published name, narrowing a type,
  or refusing input previously accepted is a minor whatever it does to bytes,
  because pre-1.0 the minor slot is the boundary a caret range stops at. Said
  rather than left to convention because nothing gates it — the test pinning
  the public surface is edited by the same commit that changes the surface.
- **`publish.yml` does not use the changesets action.** The action's mode
  selection is internal — documented as "if a publish script exists without
  changesets, it proceeds to publish; if changesets with releases are present,
  it proceeds to create or update a version PR" — so passing only `publish:`
  does not force publishing. Worse, that fallback would version with the
  default `changeset version` and skip `npm run bump`, dropping the install-pin
  regeneration. It runs `changeset publish` directly and pushes tags with
  `git push origin --tags`.

- **The one collision that clause creates is resolved with it.**
  `@pensketch/react` peers on any `0.x` of core, written when nothing said a
  core minor could remove API. The range stays — a semver range cannot say
  "compatible until a name goes", and narrowing it would refuse every future
  core minor automatically — but `react-bindings` now states that as a decision
  rather than leaving it inherited, and names what actually holds the minors:
  CI running the bindings suite against the core in the same tree.

## Impact

- **Affected specs**: `repo-tooling`, `react-bindings`
- **Affected code**: `.github/workflows/{version,publish}.yml` added,
  `.github/workflows/release.yml` deleted, `CONTRIBUTING.md`.
- **Requires an owner action on npmjs, and it is a cutover.** A trusted
  publisher names one workflow *filename*, and each package may have exactly
  one configured at a time. `@pensketch/core` and `@pensketch/mcp` both name
  `release.yml` today and must be repointed at `publish.yml`. There is no
  staging this: until it is done, the new publish workflow fails at the
  registry, and it fails as `ENEEDAUTH`, which reads like a broken secret.
- **Sequenced after the release in flight.** `Version Packages (#4)` is merged
  and the manifests say 0.3.0, but the registry is still on 0.2.0 — the publish
  dispatch has not run. Deleting `release.yml` before it does would strand that
  release.
