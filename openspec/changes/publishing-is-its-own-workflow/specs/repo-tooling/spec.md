# repo-tooling — Delta Specification

> One release workflow becomes two, and the publish path asserts CI rather than
> re-running part of it. The action's internal mode selection, the tag push it
> stops doing for us, and the npmjs cutover: publishing-is-its-own-workflow/design.md.

## MODIFIED Requirements

> Restated from the baseline in full. Three of its four scenarios are carried
> word for word, as `initial-release` and `mcp-server` left them.
>
> The fourth, **"A dispatch that released nothing goes red"**, is replaced
> rather than dropped, and deliberately: it described one control that could
> have done either job, so "released nothing" was the only way to name a
> misfire. Split, each half has its own name. The versioning half survives as
> "A version dispatch that opened nothing goes red" — the canary against a bad
> bump of the pinned action, which is why it was written. The publishing half
> does not survive, because it no longer describes a fault: `changeset publish`
> is idempotent, and re-dispatching it once everything is on the registry is a
> no-op rather than a failure. What replaces it is a precondition instead of a
> post-mortem — a publish dispatched at the wrong moment now fails before
> publishing rather than reporting afterwards that it did nothing.

### Requirement: Releases are owner-triggered with a visual semver clause
Publishing SHALL happen only via `workflow_dispatch`, and versioning and
publishing SHALL be separate workflow files. One dispatch SHALL do one of them,
chosen by the operator rather than by the repository's state: opening the
version pull request and publishing to a registry differ in whether they can be
undone, and a control that does either depending on what it finds cannot be
read before it is used.

Each workflow SHALL assert its own precondition and refuse the other's job,
naming it: the versioning workflow requires at least one pending changeset, the
publishing workflow requires none. Only the publishing workflow SHALL hold
`id-token: write`, so the job that bumps version numbers cannot mint a
credential that publishes.

Publishing SHALL use changesets with npm provenance, authenticated by trusted
publishing: the registry trusts this repository and the publishing workflow
file, and npm exchanges the OIDC token minted by `id-token: write` for a
short-lived credential. No long-lived registry token SHALL be stored as a
secret, since a secret that exists can be exfiltrated and one that does not
cannot. The workflow SHALL assert the runner's npm can perform that exchange,
because an npm too old to try fails at the registry with a plain authentication
error that reads like a misconfigured secret. It SHALL push the git tags
`changeset publish` creates, which is not done for it once the changesets
action is no longer what invokes the publish.

The publishing workflow SHALL NOT re-run a subset of CI's gates. It SHALL
instead require that CI concluded successfully on the exact commit being
published, and SHALL run only what assembles the artefact and what CI cannot
establish about the runner. A release path that repeats some of CI's checks and
omits others is a weaker gate wearing the appearance of a stronger one, and the
list of which to repeat is a list, which goes stale.

Version semantics
pre-1.0: **patch** guarantees byte-identical rendered output; **minor** may
change rendered output or add API, and its changeset SHALL say so and describe
what shifts; every user-visible change SHALL carry a changeset; the
implementing agent SHALL never publish, tag, or push.

Compatibility is a second axis, and the clause above governs only the first. A
change that removes or renames a published name, narrows a type, or refuses
input it previously accepted SHALL be a **minor**, whatever it does to rendered
bytes. A caret range on a 0.x version stops at the minor — `^0.3.0` is
`>=0.3.0 <0.4.0` — so a patch reaches a consumer on their next install without
being chosen and a minor does not: pre-1.0 the minor slot is the compatibility
boundary, and the patch slot SHALL NOT carry a break. This SHALL be stated
rather than left to convention because nothing gates it. A byte-moving change
misfiled as a patch is at least partly caught by the goldens and the parity
tests; an API break misfiled as a patch is caught by nothing, the test pinning
the public surface to an exact list being edited by the same commit that
changes that surface. The versioning workflow
SHALL assert its own outcome and fail when a dispatch opens no version pull
request: the changesets action is pinned by commit, renames every input in its
next major, and Actions only warns about an input a workflow declares that the
action does not — so a bad upgrade of that pin does nothing and exits zero. For
`@pensketch/mcp`, which renders nothing of its own, the byte-identity clause
SHALL be read as applying to the SVG its `render_diagram` tool returns.

#### Scenario: A dispatch cannot be ambiguous about what it is for
- **WHEN** the publishing workflow is dispatched while a changeset is still pending
- **THEN** it fails before anything is published, naming the versioning workflow as the one to run, rather than quietly opening a version pull request instead

#### Scenario: A version dispatch that opened nothing goes red
- **WHEN** a versioning dispatch opens no version pull request
- **THEN** the job fails, so versioning nothing cannot pass for a quiet success

#### Scenario: Publishing a commit CI has not passed is refused
- **WHEN** a publish is dispatched for a commit whose CI run failed or has not finished
- **THEN** the job fails before publishing, rather than proceeding on the strength of the checks it happens to repeat

#### Scenario: A break that renders identically is still not a patch
- **WHEN** a change removes a published name, narrows a type, or refuses input it previously accepted, while every diagram that still renders renders byte-identically
- **THEN** it is released as a minor, because a caret range would deliver a patch to consumers without their choosing it

#### Scenario: Visual change is classified
- **WHEN** a commit alters any aesthetic constant or PRNG consumption order
- **THEN** it includes regenerated expectations, a before/after PNG pair, and a minor changeset describing the visual shift

#### Scenario: No unsolicited publishes
- **WHEN** all CI checks pass on `main`
- **THEN** nothing is published until the owner triggers the publishing workflow

#### Scenario: The server's patch promise is about its output
- **WHEN** a patch release of `@pensketch/mcp` changes the SVG `render_diagram` returns
- **THEN** the release is misclassified and the change requires a minor instead
