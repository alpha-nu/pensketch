# Tasks: publishing-is-its-own-workflow

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

This change touches no package source and moves no byte of any published
entry. What it changes is which button does what, and who may mint a
publishing credential.

**It is sequenced behind the release in flight.** `Version Packages (#4)` is
merged and the manifests say 0.3.0, but the registry is still on 0.2.0, so the
publish dispatch has not run. These commits are local and unpushed, which is
what keeps them clear of it: `release.yml` is still the trusted publisher on
`origin/main` until the owner pushes.

## 1. The split

- [x] 1.1 `.github/workflows/version.yml` — opens or updates the version pull
      request and nothing else. `contents: write` and `pull-requests: write`,
      and deliberately **no `id-token: write`**. Keeps `version: npm run bump`
      and passes no `publish:` input, so the changesets action cannot take its
      publish branch. Keeps the pinned-by-commit action and the output
      assertion that guards against a bad bump of that pin
- [x] 1.2 `.github/workflows/publish.yml` — publishes and pushes tags and
      nothing else. The only place in the repository holding `id-token: write`.
      Calls `changeset publish` **directly rather than through the changesets
      action**: that action picks its own mode from whether changesets exist, so
      passing only `publish:` does not force publishing, and its fallback would
      version with the default `changeset version` rather than `npm run bump` —
      dropping the install-pin regeneration. Pushes tags with `git push origin
      --tags`, which the action used to do, `--tags` rather than
      `--follow-tags` because changesets writes lightweight tags
- [x] 1.3 Complementary guards, so exactly one of the two is dispatchable at
      any moment and the wrong one names the right one: Version requires a
      pending changeset, Publish requires none. Both were exercised in both
      states against the real tree, including that they survive `bash -e` —
      the obvious `[ … ] && unset` form does not
- [x] 1.4 `.github/workflows/release.yml` deleted
- [x] 1.5 `CONTRIBUTING.md` gains a `Releasing` section naming the two
      workflows in order, why they are two, and the filename constraint that
      npm's trusted publisher puts on the second

## 2. The theatre

- [x] 2.1 Publish asserts CI concluded `success` on the exact commit rather
      than re-running six of its steps and omitting four. Kept: `npm ci` and
      `npm run build`, because both manifests ship only `dist` and a publish
      without them uploads a tarball with no code; and the npm-version
      assertion, which is a fact about the runner that CI cannot establish and
      whose natural failure reads like a broken secret
- [x] 2.2 Version runs no gates at all. What it produces is a pull request, and
      CI runs on pull requests — gating a thing that is about to be gated is
      work done twice and trusted once
- [x] 2.3 The `repo-tooling` delta, restated in full from the live baseline
      with all four of its existing scenarios carried and two added

## 3. The cutover

**Blocking, and in this order.** A trusted publisher names one workflow
filename and a package may have exactly one at a time, so there is no staging
this. Between 3.2 and 3.3 the repository cannot publish; that window is
unavoidable and is the reason this is a task rather than a note.

- [ ] 3.1 **OWNER**: finish the release in flight — dispatch the existing
      `release.yml` from `origin/main` and let 0.3.0 reach the registry. It is
      still the trusted publisher and these commits are unpushed, so nothing
      here affects it
- [ ] 3.2 **OWNER**: push these commits, retiring `release.yml`
- [ ] 3.3 **OWNER**: repoint the trusted publisher for both published packages
      on npmjs.com, mirroring how they were first configured:

      ```sh
      npm trust github @pensketch/core --file publish.yml \
        --repo alpha-nu/pensketch --allow-publish
      npm trust github @pensketch/mcp --file publish.yml \
        --repo alpha-nu/pensketch --allow-publish
      ```

      Skipping it fails the next publish as `ENEEDAUTH`, with no mention of
      trusted publishing: npm's OIDC path logs every failure branch at verbose
      or below and is written never to throw, so it reads exactly like a
      revoked secret. `--loglevel verbose` gets the registry's own reason
- [ ] 3.4 **OWNER**: the first release through the new pair is the proof. A
      Version dispatch with nothing pending should refuse, and a Publish
      dispatch with a changeset pending should refuse and name Version

## 4. Left open deliberately

- [ ] 4.1 **OWNER**: whether Publish should sit behind an `environment:` with a
      required reviewer, so a human approves before anything reaches the
      registry. Not in this change because the answer depends on the registry
      rather than on us: npm's trusted publisher carries an optional
      environment field, and whether it rejects a token asserting an
      environment when none is configured is not stated in its documentation.
      Cheap to add once the answer is known — the publish path is now one file
      with one job
