# Contributing to pensketch

## Setup

Node 22 or newer is required. Clone the repository and run `npm ci` at the
root. The repository is an npm workspace: the four published packages live in
`packages/core`, `packages/react`, `packages/mcp` and `packages/animation`,
and a single root install wires them together, so run every command from the
root unless told otherwise.

## The verification commands

- `npm run lint` - Biome check across everything the repository ships. Proves
  formatting and lint rules hold everywhere; Biome is the only formatter and
  the only linter. Two authoring directories sit outside it, `content/` and
  `.claude/`, because neither is part of any package and a gate that is always
  red is a gate nobody reads: local runs were exiting 1 on 20 findings, none of
  them in shipped code, which had already masked one committed failure and hid
  a second behind Biome's 20-diagnostic display cap.
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
- `npm run showcase` - regenerates `docs/showcase/index.html`, the published
  page showing every diagram this repository ships. `git diff` must be clean
  afterwards, which is what stops the page claiming a figure the repository
  stopped drawing. The generator refuses in both directions: a diagram it
  names that `shippedDiagrams()` no longer returns, and a diagram
  `shippedDiagrams()` returns that the page does not place. Adding an example
  therefore stops the build until someone decides where it goes, which is the
  only way a generated page stays curated.
- `npm run http` - spawns the built HTTP server the way a deployment spawns
  it and completes a real round trip over a socket: initialize, list the
  tools, call one. The suite drives the same handler through `fetch` with no
  socket at all; this proves the file `bin` names starts under a bare `node`,
  that the shared chunks code splitting produces resolve at runtime, that
  nothing reaches stdout, and that `render_png` is absent from the list an
  HTTP client is sent.
- `npm run edge` - bundles `@pensketch/mcp/http` for a runtime with no Node
  built-ins and fails on any that reach the graph, then lists the handler's
  tools so a bundle that is clean by doing nothing cannot pass. This has caught
  two breaks, neither visible in the source: an entry that held the listener
  beside the handler, and a rasterizer moved behind `await import()`, which
  reads as lazy and is not - a bundler follows it and resolves what it finds.
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
  entry point stays within budget: 5440 bytes for core, 3968 for its checker
  subpath, 5440 for its DOM-free renderer, 2048 for react, and 768 for the
  animation package. It also proves the size the README prints beside another
  project's is the one the build produces, because a number a reader is invited
  to compare is a claim, and this one has no generator to regenerate it from.
- `npm run animation` - drives the locally installed Chrome over ten checks of
  `@pensketch/animation`, against the built package. The suite cannot reach
  any of them: jsdom neither computes `@scope` nor runs an animation, so it
  can prove the shape of the rules and nothing about what they do. This is
  what holds a diagram that cannot animate to being a *finished* diagram
  rather than a blank one, measured in pixels against a control drawn with no
  stylesheet at all. It needs a real Chrome and says so if there is none.
- `npm run diagrams` - runs the published checker over every diagram this
  repository ships: every HTML example, the React example, and the README
  hero. Errors fail; warnings are printed. The project that writes the rules
  is the first thing held to them.
- `npm run pin` - rewrites every version this repository states to someone
  installing the server, from the version `@pensketch/mcp` carries: the pin in
  both READMEs, and the two in `packages/mcp/server.json`, which is what
  `mcp-publisher` sends to the MCP registry. It also asserts that manifest's
  server name matches the `mcpName` in the package, the pair the registry
  checks to verify ownership. `git diff` must be clean afterwards. The pin is
  deliberate, because `npx` without one fetches whatever is latest when a
  client happens to start; deriving it is what stops the instructions pointing
  at a release you have already replaced. `npm run
  bump` runs it straight after `changeset version`, so the correction lands in
  the same pull request as the bump.

All of them must pass before a change is complete, and the count is not worth
writing down: it has changed twice. CI runs the same set on every pull request
and every push to `main`, so a local failure is a CI failure. It can also be
dispatched by hand from the Actions tab, for a commit whose run was lost to
something other than the commit.

## Recording a diagram

`npm run record -- path/to/diagram.mjs` turns a diagram into an MP4 of itself
being drawn, for the places that will not render an SVG — LinkedIn, X, Slack,
a slide deck. It is a tool rather than a gate: nothing in the build depends on
its output and CI never runs it, which is why it is absent from the list
above, the same way `tools/render-assets.mjs` is.

The file it takes is a `.mjs`, `.js` or `.json` naming a `viewBox` and a
`diagram`, and optionally a `label` and a `seed`:

```js
export default {
  viewBox: [0, 0, 720, 720],
  diagram: { nodes: [], edges: [], notes: [] },
  label: 'an accessible name',
  seed: 7,
};
```

`viewBox` and `diagram` are required by name; a bare diagram object is
refused rather than guessed at. `raw` is refused too — the diagram crosses into the page as JSON and JSON
carries no functions, the same constraint `tools/render-assets.mjs`
documents. There is no fitting step and no letterboxing: the viewBox is the
video's aspect ratio, so author the diagram at the shape you mean to publish.

`node tools/record.mjs --help` lists the flags. `--out`, `--scale`, `--fps`,
`--duration`, `--stroke`, `--easing`, `--hold`, `--theme`, `--background` and
`--seed` are the picture; `--frames`, `--system-font` and `--ffmpeg` are the
recording.

It drives the same locally installed Google Chrome `npm run animation` does,
and shells out to an `ffmpeg` on PATH — `brew install ffmpeg`, or `apt install
ffmpeg`. ffmpeg is deliberately not an npm dependency: a static build is some
45 MB fetched on every `npm ci`, CI included, for a tool one person runs.
`--frames <dir>` writes the PNGs, skips the encode and prints the ffmpeg
command that turns them into an MP4 whenever there is one to run.

Every frame is a seek rather than a wait. The animation is paused and its
clock moved to `(i + 1) * (1000 / fps)` before each screenshot, the
handwriting face is embedded rather than named, and Chrome rasterizes in
software — so re-recording an unchanged diagram writes the same frames, on any
machine. A real-time capture would drop and duplicate frames according to how
busy the machine was.

The `i + 1` is the sampling instant, and it is deliberate: the drawing is
sampled at the end of each interval rather than the start, so the first frame
is one step in and the last lands on `duration` exactly. From zero, the first
frame is the moment before anything has been drawn — measured at 0 inked
pixels — and every target above uses a video's first frame as its poster
unless one is uploaded.

Two things it refuses rather than papers over. The frame must be an even
number of pixels on both sides, because H.264 in `yuv420p` subsamples chroma
2x2 and cannot represent an odd one; an odd `viewBox × scale` fails and names
a scale that works. And a character the embedded subset has no glyph for —
`→ ← ↑ ↓ ✓ ✗` above all — draws nothing at all rather than a fallback shape,
which is invisible until someone watches the video, so each one is warned
about by name. That one is a warning and not a failure: the gap is cosmetic,
and `--system-font` may well cover it.

## Deploying the HTTP server

`deploy/main.ts` is the Deno Deploy entrypoint. It imports the **published**
package rather than the workspace, so what runs there is what an npm consumer
gets, and its version is a pin that `npm run pin` maintains — the same gate
that holds the install line in both READMEs.

Create the app once, from a terminal:

```sh
npm run deploy:create
```

An interactive wizard: organization, app name, source *local*, no framework
preset, runtime mode *dynamic*. Run it from a real terminal — the browser
login puts a token in the system keyring, and the wizard prompts for the
rest. `node_modules` is excluded from the upload by default.

The entrypoint is not chosen there. `deploy/deno.json` declares it under
`deploy.runtime`, along with the `org` and `app` the directory deploys to —
a `deploy` block that exists is parsed as a complete one, coordinates
included — and source configuration takes precedence over the dashboard, so
none of it can drift from the repository.

What is uploaded is `deploy/` alone, and that is load-bearing rather than
tidy. Uploading the repository root was tried and failed in a way worth
remembering: the root `package.json` declares `packages/*` as npm
workspaces, and Deno resolves an `npm:` specifier to a matching workspace
member in preference to the registry. The entrypoint's import of the
published package silently became an import of `packages/mcp/dist/http.js`
— build output the upload correctly excluded — and the build died with a
module-not-found for a file the registry serves fine. With `deploy/` as the
root there is no `package.json` above the entrypoint, so `npm:` can only
mean npm.

The script `cd`s into `deploy/` rather than passing the directory as the
CLI's `[root-path]`, and that too was learned by failing: config discovery
is anchored to the working directory, not the upload root. Scoping the
upload by argument uploaded the right tree but sent the app's stored
entrypoint — `./deploy/main.ts`, a path from before the move — because no
config existed at the working directory to override it, and the build
looked for a file the tar did not hold. Run from inside `deploy/`, the CLI
finds `deno.json` and the upload root in the same place, which is the
single-directory flow it is built around.

Both scripts invoke `jsr:@deno/deploy` directly rather than through the
`deno deploy` subcommand, and that is forced rather than chosen. On Deno
2.9.6 the subcommand forwards everything after `deploy` twice, so any
trailing token breaks it — a flag is refused as occurring twice, and even
the bare wizard dies after its last prompt, because the duplicated `create`
is consumed as the `[root-path]` positional:

    deno deploy create
    ✗ No such file or directory (os error 2): readdir 'create'

Only the zero-argument `deno deploy` parses. Invoked directly, the same CLI
receives its arguments once and all of them work — including the documented
non-interactive mode (`DENO_DEPLOY_TOKEN` plus `--json --non-interactive`),
so CI is not blocked, only the shim is. The version is pinned in the script
because `deno.lock`, which would otherwise pin it, is not tracked.

After each release:

```sh
npm run deploy
```

By hand rather than on push. The deployed bytes change only when the pinned
version does, so a deploy per commit would republish identical output for every
change to this repository, and the one event that matters — a release — is
already a manual dispatch. The script passes `--prod`, because without it a
revision lands in a non-production context — one whose environment variables
are not Production's, so `ALLOWED_HOSTS` would be missing and the entrypoint
would refuse to boot, by its own design.

`deno` is a devDependency, so there is nothing to install globally; the
deploy CLI is fetched from JSR at the version the scripts pin. Deno Deploy
Classic and its `deployctl` were shut down on 2026-07-20 and are not what
this uses.

Set `ALLOWED_HOSTS` in the app's environment variables — in the Deno Deploy
console, under the app's settings, applied to the Production context — to the
hostname it answers on. Leaving it at the default means the rebinding guard
answers 403 to every request, which reads as a broken server rather than a
misconfigured one.

`npm run deploy` refuses before uploading anything if the version pinned in
`deploy/main.ts` is not on npm, or is on npm without a `./http` export. That
is not hypothetical: the pin is derived from the manifest, which carries the
*last released* version, so between adding the HTTP transport and releasing it
the pin is correct by its own rule and names a tarball that cannot serve. The
failure without this check is a module resolution error in a build log, on a
hostname that then serves nothing.

## Releasing

Two workflows, both `workflow_dispatch`, and each refuses the other's job:

1. **Version** — opens or updates the "Version Packages" pull request from the
   pending changesets, correcting the install pin in the same breath. Refuses
   when nothing is pending. Merge the pull request it opens.
2. **Publish** — publishes to npm, pushes the tags, and lists the release in
   the MCP registry. Refuses while a changeset is still pending, and refuses a
   commit whose CI run has not concluded successfully.

The registry step is last, and it has to be: the registry verifies ownership by
fetching the *published* package and matching the `mcpName` in it against the
server name in `packages/mcp/server.json`. It authenticates with the same OIDC
token npm's trusted publisher uses, so there is no secret for it. It asks the
registry what it already has rather than assuming — a re-dispatch of a complete
release finds the version listed and does nothing, and a dispatch where npm
succeeded but the listing failed finds it missing and retries. If it ever fails
on its own, the release itself is done; `mcp-publisher publish` from
`packages/mcp/` finishes it.

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
