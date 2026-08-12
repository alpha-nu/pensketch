# repo-tooling — Delta Specification

> One number moves. `@pensketch/core/server` goes from 3872 to 4240 bytes,
> because the requirement names every budget literally and a figure in a
> requirement is as stale as any other derived number when the thing it
> describes changes.

## MODIFIED Requirements

> Restated from the live baseline in full, with all five of its scenarios
> carried word for word and none added. The only edit is `3872` to `4240` in
> the first sentence; every other clause — the self-contained-entry rule, the
> README comparison gate, the `@pensketch/mcp` exemption, and the paragraph
> requiring a budget to move before the code — is unchanged, that last one
> being the clause this change is obeying by moving it now.

### Requirement: Size budgets are enforced
`tools/check-size.mjs` SHALL gzip the built ESM entry of each published entry
point and fail (non-zero exit, printing actual vs budget) when
`@pensketch/core` exceeds 5120 bytes, `@pensketch/core/check` exceeds 3072
bytes, `@pensketch/core/server` exceeds 4240 bytes, or `@pensketch/react`
exceeds 2048 bytes min+gzip. Each published entry SHALL be a self-contained
file: build-time code splitting SHALL be off, because a shared chunk makes an
entry's budget measure a re-export rather than the code it stands for. It
SHALL also fail when the size printed in the README's comparison table is not
the size the build produces, since a figure a reader is invited to compare
against another project is a derived number, and every other derived number in
this repository is held to its source by a gate rather than by memory.
`@pensketch/mcp` SHALL NOT carry a byte budget —
it is spawned, never bundled into a page — but its packed tarball size SHALL
be reported at build time, because a WebAssembly rasterizer and an embedded
font dominate it and a user fetching it through `npx` waits for every byte.

A budget SHALL be raised deliberately and in advance of the work that needs
the room, in one step, with the measured need recorded where the number is
declared. It SHALL NOT be raised at a failing gate to make that gate pass: a
budget corrected after the fact records only that something grew, where one
corrected before records what was decided and on what evidence.

#### Scenario: Budget breach
- **WHEN** a change pushes core's min+gzip ESM output over 5120 bytes
- **THEN** `npm run size` fails and CI goes red

#### Scenario: Each subpath is held separately
- **WHEN** either subpath exceeds its own budget
- **THEN** `npm run size` fails, and the root entry's budget is unaffected either way

#### Scenario: A published comparison cannot go stale
- **WHEN** an entry grows and the README still prints the size it had before
- **THEN** `npm run size` fails, naming both numbers, rather than leaving the repository's front page to be corrected at release time

#### Scenario: A budget moves before the code does
- **WHEN** a change knows from a prototype that a feature will not fit an entry's budget
- **THEN** the budget is raised in its own commit, before the feature is written, carrying the measurement that justifies the new number

#### Scenario: The server's download weight is visible
- **WHEN** `@pensketch/mcp` is packed
- **THEN** its tarball size is reported, so the wait an `npx` user pays for is a known number rather than an accident
