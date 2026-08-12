# Contributing to pensketch

## Setup

Node 22 or newer is required. Clone the repository and run `npm ci` at the
root. The repository is an npm workspace: the two published packages live in
`packages/core` and `packages/react`, and a single root install wires them
together, so run every command from the root unless told otherwise.

## The verification commands

- `npm run lint` - Biome check across the repository. Proves formatting and
  lint rules hold everywhere; Biome is the only formatter and the only linter.
- `npm run typecheck` - `tsc --noEmit` in each package. The build step does
  not typecheck, so this is the only gate that proves the types are sound.
- `npm test` - vitest with coverage. Proves behavior is correct and that each
  package still meets the 90% line and branch coverage thresholds. Those
  thresholds are never lowered to make a run pass.
- `npm run build` - tsup in each package. Proves both packages still produce a
  working ESM build, CJS build, and `.d.ts` declarations.
- `npm run goldens` - regenerates the golden files from the reference
  renderer. `git diff` must be clean afterwards, which proves the reference,
  the generator, and the checked-in goldens have not drifted apart.
- `npm run schema` - regenerates `packages/core/schema/diagram.schema.json`
  from the TypeScript types. `git diff` must be clean afterwards, which proves
  the schema a caller validates against still describes the types the package
  ships. It lives inside the package because it is published with it, as
  `@pensketch/core/schema.json`.
- `npm run resources` - regenerates the resources `@pensketch/mcp` serves
  from the files they mirror: the machine-caller reference, the JSON Schema,
  and the diagrams this repository ships. `git diff` must be clean
  afterwards, which is what stops a resource telling an agent something the
  repository stopped doing.
- `npm run exports` - loads every published entry point, as ESM and as CJS,
  and asserts each exposes exactly its documented surface. Nothing else in the
  project loads `dist/`, so this is the only thing that would notice an
  exports map pointing at a file that is not there.
- `npm run stdio` - spawns the built MCP server the way a client spawns it
  and completes a real round trip over stdin: initialize, list the tools,
  call two of them. The suite proves the protocol wiring in memory; this
  proves the file `bin` names starts under a bare `node` and that nothing it
  prints corrupts the stream a client is parsing.
- `npm run size` - gzipped size budgets. Proves each minified, gzipped ESM
  entry point stays within budget: 5120 bytes for core, 3072 for its checker
  subpath, 4300 for its DOM-free renderer, 2048 for react. It also proves the
  size the README prints beside another project's is the one the build
  produces, because a number a reader is invited to compare is a claim, and
  this one has no generator to regenerate it from.
- `npm run diagrams` - runs the published checker over every diagram this
  repository ships: every HTML example, the React example, and the README
  hero. Errors fail; warnings are printed. The project that writes the rules
  is the first thing held to them.
- `npm run pin` - rewrites the version the READMEs tell a reader to install,
  from the version `@pensketch/mcp` carries. `git diff` must be clean
  afterwards. The pin is deliberate, because `npx` without one fetches
  whatever is latest when a client happens to start; deriving it is what stops
  the instructions pointing at a release you have already replaced. `npm run
  bump` runs it straight after `changeset version`, so the correction lands in
  the same pull request as the bump.

All of them must pass before a change is complete, and the count is not worth
writing down: it has changed twice. CI runs the same set on every pull request
and every push to `main`, so a local failure is a CI failure. It can also be
dispatched by hand from the Actions tab, for a commit whose run was lost to
something other than the commit.

## Releasing

Two workflows, both `workflow_dispatch`, and each refuses the other's job:

1. **Version** — opens or updates the "Version Packages" pull request from the
   pending changesets, correcting the install pin in the same breath. Refuses
   when nothing is pending. Merge the pull request it opens.
2. **Publish** — publishes to npm and pushes the tags. Refuses while a
   changeset is still pending, and refuses a commit whose CI run has not
   concluded successfully.

They are separate files because one is reversible and the other is not, and a
single control that decides for itself which it is doing cannot be read before
it is used. Only Publish holds `id-token: write`, so the job that bumps version
numbers cannot mint a credential that publishes.

Both are owner actions. npm's trusted publisher names this repository and the
publish workflow *by filename*, so renaming that file breaks publishing until
the trusted publisher is repointed on npmjs.com — and a package may have only
one configured at a time.

## Working alongside the release

`main` has two writers: whoever is committing, and the versioning workflow,
which lands a "Version Packages" merge of its own. Local work therefore diverges
from `origin/main` the moment a release goes out, and `git pull` in its
default configuration answers that with a merge commit — or, with
`--ff-only`, with a refusal.

Neither is what anyone wants in a linear history, so the repository is worked
with `pull.rebase` on:

```sh
git config pull.rebase true
git config rebase.autoStash true
```

Fetch and rebase before starting a group of work, not after finishing one. A
rebase of unpushed commits rewrites nothing anyone else has.

## Golden files

The goldens are generated from the reference renderer only, never from the
ported implementation. Generating them from the port would make the parity
tests compare the port to itself, which proves nothing.

The reference renderer is read-only. It is the ground truth the port is
measured against, so editing it to settle a disagreement moves the target
instead of finding the fault. If you believe the reference is wrong, stop and
raise it.

A golden file changes only when a visual change is intended. Such a commit
carries a before/after PNG pair showing the shift, and a minor changeset
describing what moved.

Never regenerate goldens to make a failing test pass. A failing golden means
the rendered output moved - that signal is the entire reason the test exists,
and regenerating it destroys the evidence. Find out what moved and decide
whether you meant it.

There is one case where the answer is to regenerate. Trigonometry decides
where a stroke wobbles, and the language leaves those functions approximate,
so a JavaScript engine may change a result in the last digit across a major
upgrade. The signature is unmistakable: the goldens and the parity tests fail
together, on a commit that changed no source, and the diff is a handful of
final digits inside path data. That is the engine moving, not the renderer.
Regenerate deliberately, with the before and after images, and say so in the
changeset.

## Patch vs minor

Every user-visible change carries a changeset; create one with
`npx changeset`. Before 1.0 the split is:

- **patch** guarantees byte-identical rendered output on a given JavaScript
  engine. Same input, same seed, same engine, same bytes as the previous
  version.
- **minor** may change rendered output or add API. Its changeset must say that
  output changes and describe what shifts, so anyone snapshot-testing their
  own diagrams knows why their snapshots moved.

Any change to an aesthetic constant, or to the order in which the seeded
random number generator is consumed, changes the rendered bytes. That makes it
a minor, even when the diagram looks identical to the eye. Reordering draw
operations is such a change.

Compatibility is a second axis, and the split above governs only the first. A
change that **removes or renames a published name, narrows a type, or refuses
input it previously accepted is a minor**, whatever it does to rendered bytes.
A caret range on a 0.x version stops at the minor: `^0.3.0` means
`>=0.3.0 <0.4.0`, so a patch reaches a consumer on their next install without
being chosen and a minor does not. Pre-1.0 the minor slot is the compatibility
boundary, and the patch slot never carries a break.

Nothing gates that one, which is why it is written here. A byte-moving change
misfiled as a patch is at least partly caught by the goldens and the parity
tests. An API break misfiled as a patch is caught by nothing: the test that
pins the public surface to an exact list is edited by the same commit that
changes the surface, and no gate then has an opinion about the version number.

## Project invariants

These hold regardless of what a change is trying to do.

**Neither rendering package takes a runtime dependency.** `@pensketch/core`
and `@pensketch/react` are what a page loads, and they add nothing to a
consumer's lockfile: development tooling lives at the repository root, and
the bindings reach for core and the host's React and nothing else. A new
entry under `dependencies` in either is a design decision, not an
implementation detail, and a test enforces it.

`@pensketch/mcp` is deliberately outside that rule. It is a tool an agent
spawns, not code that ships inside a page, so it may carry dependencies — and
it may never appear in the dependencies of either rendering package, which
the same test enforces.

**The look is fixed.** The jitter, the double stroke, the corner overshoot and
every constant behind them are the product rather than a set of knobs. They do
not become options. There is no automatic layout, no edge routing, no text
measurement, and no canvas renderer - a diagram's coordinates are the author's
to choose.

**Nothing in package source reads the outside world.** No `Math.random`, no
clock, no timers, no locale-dependent formatting, and no reference to a global
`document` or `window` - elements are created through the target element's own
document. A test enforces this by reading the source, because output rendered
on one machine cannot witness it.

**Code in a README has one source.** The snippets in the root and package
READMEs are copies of the canonical blocks in the change's design document.
Change the canonical block and propagate, in the same commit; do not edit a
copy in place. The examples are not copies: each folder carries its own
diagram, chosen to exercise what that folder demonstrates, and is free to be
longer than anything a README can afford to print.

## ASCII source

Strings that reach rendered output use `\uXXXX` escapes for any non-ASCII
glyph — fixture and label strings above all — which keeps what is drawn
independent of file encoding and keeps diffs readable everywhere.

Prose is not covered. Comments, documentation and error messages use the
typographic dashes the rest of the project uses. This section used to forbid a
literal multi-byte character anywhere in a source file, which was never true of
this repository and which nothing checks.

HTML files declare `<meta charset="utf-8">` and may use HTML entities in
markup, but JavaScript and TypeScript strings inside them still use escapes.
