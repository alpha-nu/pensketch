# Tasks: publishing-is-its-own-workflow

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

This change touches no package source and moves no byte of any published
entry. What it changes is which button does what, and who may mint a
publishing credential.

**The cutover is complete.** 0.3.0 reached the registry through the old
`release.yml` on 2026-08-12, the commits are pushed — `origin/main` carries
`version.yml` and `publish.yml` and no `release.yml` — and the trusted
publisher is repointed. What is not yet proven is the one path no rehearsal
reaches: see 3.4.

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
- [x] 2.3 The `repo-tooling` delta, restated in full from the live baseline:
      three of its four scenarios carried word for word, five added, and one
      **deliberately retired** — "a dispatch that released nothing goes red"
      names a single workflow that no longer exists, and its two halves are
      now separate scenarios. Its publish half is inverted rather than moved:
      a Publish dispatch with nothing to publish is green by design, which is
      what lets the release path be rehearsed without a release. That
      inversion gets a scenario of its own, because archiving deletes the old
      rule and a reader diffing the spec would otherwise see a safety check
      vanish with no record of why

- [x] 2.4 The semver clause gains its second axis. patch and minor were defined
      by rendered bytes alone, so removing a published name or refusing input
      previously accepted qualified as a patch by the letter — and a caret
      range on 0.x stops at the minor, so a patch arrives without the consumer
      choosing it. Now stated in the requirement and in `CONTRIBUTING.md`:
      pre-1.0 the minor slot is the compatibility boundary and the patch slot
      carries no break.

      Folded into this change rather than given one of its own, because it
      edits the same requirement — "Releases are owner-triggered with a visual
      semver clause" — and two unarchived deltas restating one requirement is
      how a stale baseline deletes the other's work at archive time

- [x] 2.5 The one place the new clause collides with an existing rule, resolved
      in the same change so the clause never lands without its qualifier.
      `react-bindings` peers on **any `0.x`** of core, which was written when
      nothing said a core minor could remove API. It now can, so on paper the
      bindings promise something the release rules permit core to break.

      **The range stays**, and `react-bindings` says why rather than leaving it
      inherited: a semver range cannot express "compatible until a name goes",
      narrowing it would refuse every future core minor in advance — and
      automatically, `onlyUpdatePeerDependentsWhenOutOfRange` bumping and
      rewriting the bindings on each one — and what holds the minors is not the
      range but CI, which runs the bindings suite against the core in the same
      tree on every push. `manifest.test.ts`'s comment gains the same reasoning,
      since that is where the next reader will look

## 3. The cutover

**Blocking, and in this order.** A trusted publisher names one workflow
filename and a package may have exactly one at a time, so there is no staging
this. Between 3.2 and 3.3 the repository cannot publish; that window is
unavoidable and is the reason this is a task rather than a note.

- [x] 3.1 **OWNER**: finish the release in flight — dispatch the existing
      `release.yml` from `origin/main` and let 0.3.0 reach the registry. It is
      still the trusted publisher and these commits are unpushed, so nothing
      here affects it

      Done: `Release` dispatched on `6fdb02c`, and the registry carries
      `@pensketch/core` and `@pensketch/mcp` at 0.3.0
- [x] 3.2 **OWNER**: push these commits, retiring `release.yml`

      Done: `origin/main` carries `ci.yml`, `version.yml` and `publish.yml`,
      and no `release.yml`
- [x] 3.3 **OWNER**: repoint the trusted publisher for both published packages
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

      **Partly proven, and the untested part is the one that matters.**
      `Publish` was dispatched on `3c2f4d9` and went green end to end: the
      guard, the CI-conclusion assertion, the npm-version assertion, `npm ci`,
      `npm run build` and `git push origin --tags`. But `changeset publish`
      reported *"No unpublished projects to publish"*, so **the npm upload and
      the OIDC exchange never ran** — which is exactly the step 3.3 changed and
      the step whose failure mode this change spent a paragraph describing.
      `Version` has never been dispatched at all, and neither refusal path has
      been exercised as a dispatch rather than against the local tree.

      Two of the three are cheap to close now: dispatching `Version` with
      nothing pending must go red, and once a changeset exists, dispatching
      `Publish` must go red naming Version. Only the OIDC exchange has to wait
      for a real release

## 4. Considered and declined

- [x] 4.1 ~~**OWNER**: whether Publish should sit behind an `environment:` with
      a required reviewer.~~ **Declined: the approval flow stays as it is.**
      Publishing is already `workflow_dispatch` and owner-only, so a required
      reviewer would be the same person approving their own dispatch — a click
      rather than a decision. The question about npm's optional environment
      field is moot with it, and not worth answering against the registry to
      buy ceremony. Recorded rather than dropped so it is not re-proposed as an
      oversight
