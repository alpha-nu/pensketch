# documentation-and-examples — Delta Specification

> `main` has two writers, and CONTRIBUTING should say so.

## MODIFIED Requirements

### Requirement: CONTRIBUTING teaches the guardrails
`CONTRIBUTING.md` SHALL cover: setup, every verification command with one
line each on what they prove, the golden policy including
never-regenerate-to-green, patch-vs-minor selection under the visual clause,
the ASCII/`\uXXXX` rule for fixture strings, and how to work alongside the
release — that `main` has two writers, that local work diverges from
`origin/main` the moment a release lands, and that the repository is worked
with `pull.rebase` on so the answer is a rebase rather than a merge bubble or
a refusal.

It SHALL NOT state how many verification commands there are. That count has
changed twice, and a number in a heading is a fact nothing checks.

#### Scenario: A contributor learns the golden rule before touching goldens
- **WHEN** a contributor reads CONTRIBUTING
- **THEN** the golden policy and its rationale are stated explicitly

#### Scenario: A contributor is not surprised by a diverged main
- **WHEN** a release lands while a contributor holds unpushed commits
- **THEN** CONTRIBUTING has already told them why, and which git configuration makes the reconciliation a rebase
