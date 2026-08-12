# Design: publishing-is-its-own-workflow

## D1. What the one button actually decides

`changesets/action` documents its own mode selection: with no changesets and no
publish script it exits; with a publish script and no changesets it publishes;
with changesets that carry releases it opens or updates a version pull request.
Nothing in the workflow file chooses. The inputs `version:` and `publish:` name
*how* to do each job, not *which* job to do.

Two consequences, and the second is the dangerous one:

1. The operator dispatches and finds out afterwards. The existing workflow's
   final step is that finding-out, written as an assertion.
2. **Passing only `publish:` does not force publishing.** With a changeset
   present the action falls back to versioning, and to the *default*
   `changeset version` rather than this repository's `npm run bump` — which is
   `changeset version` plus `npm run pin`. The pull request would then carry
   bumped manifests and READMEs still naming the version before. CI's tree-clean
   assertion would catch it, but the design should not need catching.

So a split cannot be done by giving each workflow one of the two inputs.
`publish.yml` has to stop using the action and call `changeset publish`
directly. `version.yml` may keep it, because "open the version pull request" is
the action's whole purpose and its `pullRequestNumber` output is the canary the
existing file already relies on.

`changeset publish` creates git tags locally — `pkg-name@X.X.X` — and does not
push them; the action used to. `git push origin --tags` replaces it, and
`--tags` rather than `--follow-tags` because the tags changesets writes are
lightweight and `--follow-tags` pushes only annotated ones. A fresh
`actions/checkout` fetches no tags, so the only local tags are the ones just
created and `--tags` cannot push something stale.

## D2. Preconditions, stated rather than discovered

Each workflow refuses the other's job, which is what makes the pair legible at
the dispatch screen rather than in the log:

| | precondition | refusal |
|---|---|---|
| `version.yml` | at least one `.changeset/*.md` besides `README.md` | "nothing to version" |
| `publish.yml` | no such file | "there are unreleased changesets — run Version first" |

These are complementary by construction, so exactly one of the two is
dispatchable at any moment, and the wrong one says which the right one is.

The old post-hoc assertion survives only in `version.yml`, and only for the
reason it was written: the action is pinned by commit, renames every input in
its next major, and Actions only warns about an input a workflow declares that
the action does not — so a bad bump of the pin does nothing and exits zero.
`publish.yml` no longer uses the action, so it no longer needs that canary. Its
own outcome is legible without one: `changeset publish` is idempotent, and
re-dispatching it after a successful publish is a no-op rather than a fault.

## D3. Asserting CI instead of repeating it

`release.yml` re-runs six of CI's steps and omits four. Rather than adding the
four, `publish.yml` requires that `ci.yml` concluded `success` on the exact
`GITHUB_SHA` being published, via the Actions API, and keeps only:

- `npm ci` and `npm run build`, because both manifests ship only `dist` and a
  publish without them uploads a tarball with no code in it. That is assembling
  the artefact, not checking it.
- the npm-version assertion, because it is a precondition whose natural failure
  is unreadable: an npm too old to attempt the OIDC exchange fails at the
  registry with a plain authentication error.

Everything CI proves is proved once, on the commit, by the workflow written to
prove it. A publish of a commit CI has not passed — or has not finished — is
refused rather than half-checked.

This is the same reasoning the size budgets and the goldens already run on:
one gate per fact, named where the fact lives. It also removes the standing
temptation to keep `release.yml`'s step list in sync with `ci.yml`'s by hand,
which is a list, and lists go stale — the requirement about the regeneration
step says exactly this about artefact names.

## D4. The cutover, and why it cannot be staged

npm's trusted publisher configuration names a repository **and a workflow
filename**, and each package may have exactly one configured at a time. Both
published packages name `release.yml` today. So:

1. The release in flight publishes 0.3.0 from `release.yml`, as configured.
2. These commits land.
3. The owner repoints both packages at `publish.yml`.

Between 2 and 3 the repository cannot publish. That window is unavoidable — a
package cannot trust two files — and it is why 3 is a blocking task rather than
a note. Reversing the order does not help: repointing first breaks the release
in flight instead.

The failure mode if it is skipped deserves stating, because it is misleading.
npm's OIDC path is written never to throw; every failure branch logs at verbose
or below. A publish with no trust relationship exits `ENEEDAUTH` with no
mention of trusted publishing at all, and reads exactly like a revoked secret.
`--loglevel verbose` gets the registry's own reason.

An environment gate — `environment: npm` with a required reviewer, so a human
approves before anything reaches the registry — was raised and **declined by
the owner**. The approval it would add is one the dispatch already is:
publishing is `workflow_dispatch` and owner-only, so the required reviewer
would be the same person approving the button they just pressed. That is a
click, not a decision, and this repository does not buy ceremony with it.

It also retires the open question that came with it — npm's trusted publisher
carries an optional environment field, and whether the registry rejects a token
asserting an environment when none is configured is not stated in its
documentation. Unasked, because nothing now depends on the answer.
