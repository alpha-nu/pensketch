# Design: initial-release

Technical decisions for the pensketch bootstrap. The delta specs state the
requirements; this file fixes the *how* — names, exact API shapes, exact
config contents, and the canonical snippets that READMEs and examples copy.
`reference/renderer.html` is the normative reference implementation and is
read-only.

## Context

The reference renderer produces the sketch aesthetic via four composed tricks:
seeded jitter (mulberry32 PRNG, every coordinate offset ±amp/2), segmented
polylines (~26 px steps, endpoint jitter damped ×.4), double-stroking (two
jittered passes, second at ×.75 width / .5 opacity), and corner overshoot
(box strokes extend 0–4 px past corners). Determinism comes free: the PRNG is
seeded, so identical inputs give identical bytes — which turns visual testing
into exact golden-file comparison. The port's job is to preserve this, not
improve it.

## D1 — Naming and identity

| Field | Value |
|---|---|
| npm scope | `@pensketch` (org, owner-created; zero packages under the scope as of 2026-08-05) |
| Core package | `@pensketch/core`, in `packages/core/` |
| React package | `@pensketch/react`, in `packages/react/` |
| License | MIT (copyright holder: Anas K) |
| Tagline | *Hand-sketched SVG diagrams from plain data. Tiny, seeded, zero dependencies.* |

Scoped over unscoped (owner decision 2026-08-05): a family of bindings is
planned, and owning the org locks the entire namespace in one act. Scoped
packages default to restricted on publish, so both manifests carry
`publishConfig: { "access": "public" }`. Optional owner move: also reserve
unscoped `pensketch` as a pointer package.

Positioning: **not** a rough.js competitor. rough.js draws shape primitives;
pensketch renders whole diagrams from data, deterministically, in ≤5 KB.
Differentiators in priority order: (1) diagram-level data input that lives in
git and diffs like code; (2) determinism as contract (golden-testable);
(3) tiny + zero-dependency; (4) CSS-variable theming, dark-mode-native.

Non-goals (hard walls, no TODOs): automatic layout or autorouting; text
measurement/wrapping; animation; canvas/PNG rendering; bindings beyond React;
configurable aesthetics beyond the documented API (the look *is* the product).

## D2 — Core public API (exact surface, nothing more)

```ts
export type Point = [number, number];
export type Side = 't' | 'b' | 'l' | 'r';

export interface StrokeOptions {
  color?: string;      // any CSS color or var() expression; default theme.ink
  dotted?: boolean;    // default false
  width?: number;      // primary-pass stroke-width; default 1.6
  amplitude?: number;  // jitter amplitude in px; default 2.6
}

export interface LabelOptions {
  size?: number;                       // font-size px; default 13.5
  color?: string;                      // default theme.ink
  anchor?: 'start' | 'middle' | 'end'; // default 'middle'
  lineHeight?: number;                 // multiplier; default 1.28
}

export interface Theme {
  ink: string;    // primary stroke + label color
  pen: string;    // structural accent (group borders, accent nodes)
  accent: string; // attention color (dotted edges, notes)  [reference: --red]
  muted: string;  // secondary labels
  wash: string;   // group background fill
}

export interface PenOptions {
  seed?: number;            // default 1
  theme?: Partial<Theme>;   // shallow-merged over defaultTheme
}

export interface Pen {
  stroke(pts: Point[], opts?: StrokeOptions): void;
  arrow(pts: Point[], opts?: StrokeOptions): void;
  rect(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  pill(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  diamond(x: number, y: number, w: number, h: number, opts?: StrokeOptions): void;
  hatch(x: number, y: number, w: number, h: number, color?: string): void;
  label(x: number, y: number, lines: string | string[], opts?: LabelOptions): void;
  wash(x: number, y: number, w: number, h: number, fill?: string): void;
  rng(): number;   // the pen's seeded PRNG (advances state)
}

// A group's title is drawn unconditionally, so `lines` is required there and
// optional everywhere else. One interface with `lines?` would type-admit an
// untitled group, which cannot render.
export type DiagramNode =
  | { id: string; x: number; y: number; w: number; h: number;
      shape: 'group'; lines: string[] }
  | { id: string; x: number; y: number; w: number; h: number;
      shape: 'box' | 'pill' | 'diamond';
      lines?: string[];
      size?: number;      // label font-size override
      accent?: boolean;   // stroke with theme.pen instead of theme.ink
      hatch?: boolean;    // hatch-fill the interior (inset 4px, theme.pen)
    };

export interface DiagramEdge {
  from: [string, Side];
  to: [string, Side];
  via?: Point[];                        // waypoints between the two anchors
  dotted?: boolean;                     // dotted implies accent color
  label?: string;
  lx?: number; ly?: number;             // label position (required if label)
  anchor?: 'start' | 'middle' | 'end';  // label anchor; default 'middle'
}

export interface DiagramNote {
  x: number; y: number;
  lines: string[];
  anchor?: 'start' | 'middle' | 'end';  // default 'start'
  arrowFrom?: Point;
  via?: Point[];
  arrowTo?: Point;   // arrow drawn only when both arrowFrom and arrowTo set
}

export interface Diagram {
  nodes?: DiagramNode[];
  edges?: DiagramEdge[];
  notes?: DiagramNote[];
  raw?: Array<(pen: Pen) => void>;
}

export interface DrawOptions extends PenOptions {
  label?: string;   // sets role="img" and aria-label on the svg
}

export function mulberry32(seed: number): () => number;
export function pen(svg: SVGSVGElement, options?: PenOptions): Pen;
export function draw(svg: SVGSVGElement, diagram: Diagram, options?: DrawOptions): void;
export function anchor(node: DiagramNode, side: Side): Point;
export const defaultTheme: Theme;
export const constants: Readonly<Record<string, number | string>>;
```

Module layout: `src/{index,rng,constants,theme,pen,draw,types}.ts`. React
package: `src/{index.ts, PenSketch.tsx, useSketch.ts}` with

```ts
export interface PenSketchProps
  extends Omit<React.ComponentPropsWithoutRef<'svg'>, 'children'> {
  diagram: Diagram;
  seed?: number;     // default 1
  theme?: Partial<Theme>;
  viewBox: string;   // required — pensketch coordinates are explicit
}
export const PenSketch: React.ForwardRefExoticComponent<
  PenSketchProps & React.RefAttributes<SVGSVGElement>>;
export function useSketch(
  sketch: (pen: Pen) => void,
  options?: PenOptions
): { current: SVGSVGElement | null };   // structural: React's own RefObject
                                        // shape differs across ^18 and ^19
```

## D3 — Rendering behavior and aesthetic constants

Draw order is **normative** (defines z-order *and* PRNG consumption, hence the
golden bytes): groups (wash → border rect at width 1.4 / amplitude 3.2 → title
label at `(x+14, y+18)`, anchor start, size 14, theme.pen) → edges (arrow
through `[anchor(from), ...via, anchor(to)]`; dotted = accent color; label
size 12.5) → non-group nodes (shape; hatch inset 4; centered label, default
size 13.5) → notes (label size 13, accent, default anchor start; dotted arrow
amplitude 2 when both ends given) → raw callbacks. Each phase walks its array
in order. `draw()` first removes all children (`removeChild` loop, not
`innerHTML` — DOM-implementation-portable), so re-drawing is idempotent.

Primitive fidelity: port the reference exactly — including the reference
`rect`'s stroke order (top, right, bottom, left) and per-end `4 * rng()`
overshoot placement, `pill`'s 26 segments with radius jitter 3/2 at amplitude
1.4, `hatch`'s 11 px spacing with the reference's min/max clipping arithmetic,
`arrow`'s two ±0.5 rad head strokes of length 10 (never dotted, amplitude
1.2), double-pass stroke (second pass ×.75 width, opacities .92/.5), dash
pattern `2 7`, ~26 px segmentation with ×.4 endpoint damping, and `label`'s
per-line `<text>` elements with `dominant-baseline:middle` and inline
`style="fill:<color>;font-size:<size>px"`. A `string` label argument is
normalized to a one-element array first. `wash` is a plain `<rect rx="6">`.

All magic numbers live in `constants.ts` as named exports with a one-line
comment each, re-exported under one frozen `constants` object for tests and
docs — none are runtime-configurable in this release. Element creation goes
through `svg.ownerDocument.createElementNS`, never the global `document`; no
`window`, `Date`, `Math.random`, locale, or timer access anywhere in package
source.

Validation fails fast with `Error` naming the offender (unknown edge node id,
unknown shape, edge label without numeric `lx`/`ly`); nothing else is checked
— no defensive guards for states hand-authored data cannot reach.

## D4 — Theming

```ts
export const defaultTheme: Theme = {
  ink:    'var(--ps-ink, #232B36)',
  pen:    'var(--ps-pen, #2B5B8A)',
  accent: 'var(--ps-accent, #B3402E)',
  muted:  'var(--ps-muted, #5A6572)',
  wash:   'var(--ps-wash, rgba(43,91,138,.05))',
};
```

Values are written verbatim into SVG attributes; dark mode = the host page
redefines `--ps-*` (snippet A4). The package ships no CSS and no fonts;
labels inherit the page font, and the READMEs document the handwriting stack
the aesthetic depends on.

## D5 — Golden parity protocol

The port must reproduce the reference byte-for-byte for both fixtures in
`reference/renderer.html`: `SAMPLER` (seed 7) and `BUDGETS` (seed 11).

- **Why it works**: path data is built by JS number-to-string conversion,
  which ECMAScript specifies exactly, so preserving PRNG call order is
  sufficient for byte parity **on a given engine**. It is not sufficient
  across engines: the renderer feeds `Math.cos`, `Math.sin` and `Math.atan2`
  straight into emitted coordinates, and ECMAScript leaves those
  implementation-approximated. A one-ULP difference in `cos`/`sin` shifts two
  of SAMPLER's 122 element lines. In practice V8, JavaScriptCore and
  SpiderMonkey agree, and goldens generated under Node 20, 22 and 23 on both
  arm64 and x64 are byte-identical — but the guarantee the project makes, and
  the one the goldens verify, is same-engine.
- **Theme bridge**: the reference emits `var(--ink)` / `var(--pen)` /
  `var(--red)` / `var(--muted)` / `var(--wash)`. Parity tests render with
  `{ ink:'var(--ink)', pen:'var(--pen)', accent:'var(--red)',
  muted:'var(--muted)', wash:'var(--wash)' }` so attribute bytes match; the
  namespaced default theme is covered by separate unit tests.
- **Serializer** (one shared function used by generator and tests): walk
  element children depth-first in document order; per element emit lowercase
  tag, attributes sorted alphabetically **by attribute name** — not by the
  formatted `name="value"` string, which orders `stroke-linecap` before
  `stroke` because `-` sorts below `=` — then emit each as `name="value"`
  (values verbatim), and `textContent` for `<text>`; one element per line,
  joined with `\n`. Sorting makes serialization independent of attribute
  insertion order across DOM implementations. It lives at
  `packages/core/test/serialize.mjs`: plain ESM, because
  `tools/generate-goldens.mjs` must import the very same function, and bare
  Node cannot be relied on to import a `.ts` file across the supported range.
- **Generator** (`tools/generate-goldens.mjs`): jsdom over the reference file
  with `runScripts: 'dangerously'` (our own local file), serialize `#sampler`
  and `#budgets`, write `packages/core/test/goldens/sampler.seed7.svg.txt`
  and `budgets.seed11.svg.txt`. Goldens are checked in; CI re-runs the
  generator and fails on `git diff --exit-code` so reference, generator, and
  goldens cannot drift. The fixtures are duplicated as TS test fixtures with
  `\uXXXX` escapes preserved.
- **Breaking parity intentionally** is a visual change: regenerate goldens
  deliberately, include a before/after PNG pair in the commit, add a minor
  changeset describing what shifts. Never regenerate to green a failing test.

## D6 — Tooling and config contracts

| Concern | Decision |
|---|---|
| Workspaces | npm workspaces (no pnpm/turbo) |
| Build | tsup per package: ESM + CJS + d.ts, minify, sourcemap, clean, target es2020 |
| Node | `>=22` (20 reached end of life on 2026-04-30) |
| Tests | vitest, jsdom environment; `@testing-library/react` for react package |
| Coverage | v8, thresholds ≥90% lines and branches; verify per-package in the per-file report |
| Lint/format | Biome only (no eslint, no prettier) |
| Types | `tsc --noEmit` in CI (tsup does not typecheck) |
| Versioning | changesets, independent versions, internal dep ranges auto-bumped |
| Size budgets | core ≤ 5120 B, react ≤ 2048 B (dist ESM, min+gzip) via `tools/check-size.mjs` |
| Publish | `release.yml` on `workflow_dispatch` only, changesets publish with npm provenance, `NPM_TOKEN` secret; owner triggers |

Root `package.json`: `"private": true`, `"type": "module"`,
`"workspaces": ["packages/*"]`, `"engines": { "node": ">=22" }`, and exactly
these scripts (CI and CLAUDE.md call them by name):

```json
{
  "scripts": {
    "lint": "biome check .",
    "typecheck": "npm run typecheck --workspaces",
    "test": "vitest run --coverage",
    "build": "npm run build --workspaces",
    "goldens": "node tools/generate-goldens.mjs",
    "size": "node tools/check-size.mjs"
  }
}
```

Package `package.json` (core shown; fields may be appended, never dropped):

```json
{
  "name": "@pensketch/core",
  "version": "0.0.1",
  "description": "Hand-sketched SVG diagrams from plain data. Tiny, seeded, zero dependencies.",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/alpha-nu/pensketch.git" },
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=22" },
  "scripts": { "build": "tsup", "typecheck": "tsc --noEmit" },
  "keywords": ["sketch", "hand-drawn", "svg", "diagram", "seeded", "deterministic", "napkin"]
}
```

`@pensketch/react` declares no regular dependency and
`"peerDependencies": { "@pensketch/core": ">=0.0.1 <1.0.0", "react": "^18 || ^19" }`
(plain semver — npm workspaces resolves locally, changesets keeps the range
current; the `workspace:*` protocol is pnpm/yarn and must not appear).
Nothing else; no react-dom. Core is a peer because the bindings are a
pass-through to its renderer: a regular dependency would let an application
resolve two copies and get two different drawings from one seed, silently,
whereas a peer conflict fails at install time. The core range states *API*
compatibility rather than rendering compatibility: because there is exactly
one core in the tree, a rendering change reaches the component and a direct
`draw()` call alike, so only an API break needs a new range. Changesets is
configured with `onlyUpdatePeerDependentsWhenOutOfRange` so that a core minor
does not force a react major — without it every core release drags the
bindings to the next major for a range rewrite that changes nothing. That is
the only switch for this: the rule is otherwise unconditional in
`assemble-release-plan`, and it fires even for a range the new version already
satisfies. Because the option's own name reserves the right to change without
notice, `@changesets/cli` is pinned to an exact version, and a test asserts
the release plan directly — a core minor must leave the bindings alone and a
core major must take them with it — so a change in that behaviour fails
`npm test` rather than surfacing as an unexplained major on a release pull
request.

`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` (without it `theme={{ ink: props.ink }}` with an
undefined prop is type-legal and renders `stroke="undefined"`; the flag turns
that into a compile error instead of a runtime guard),
`target: "ES2020"`, `module: "ESNext"`, `moduleResolution: "bundler"`,
`lib: ["ES2020", "DOM"]`, `skipLibCheck`; react package adds
`"jsx": "react-jsx"`. Biome: formatter + linter, recommended rules,
organize-imports. changesets config: `"access": "public"`,
`"baseBranch": "main"`. vitest: coverage excludes `examples/**`, `tools/**`,
`**/dist/**`.

CI (`ci.yml`): push/PR to `main`; matrix node 22 + 24; steps in order —
checkout → setup-node (npm cache) → `npm ci` → `npm run lint` →
`npm run typecheck` → `npm test` → `npm run build` → `npm run goldens` then an
assertion that the whole working tree is unchanged (`git status --porcelain`
empty — a diff scoped to tracked files under the goldens directory would miss
a newly emitted golden and would pass silently if the path were mistyped) →
`npm run size`. A second job installs React 18 over the workspace install and
runs the type gate and the React suite against it: the peer range admits that
major, and nothing else in the matrix exercises it.

Repository layout:

```
pensketch/
├── package.json / LICENSE / README.md / CONTRIBUTING.md / CLAUDE.md
├── openspec/                  # this change
├── reference/renderer.html    # normative reference (READ-ONLY)
├── packages/core/             # @pensketch/core  (src, test incl. goldens, README)
├── packages/react/            # @pensketch/react (src, test, README)
├── tools/                     # generate-goldens.mjs, render-assets.mjs, check-size.mjs
├── docs/assets/               # committed README images (hero-light/dark.png)
├── examples/                  # vanilla/, custom-pen/, react/  (runnable, never published)
└── .github/workflows/         # ci.yml, release.yml
```

## D7 — Documentation, examples, and the single-source snippet rule

Every code snippet in any README comes **verbatim from Appendix A below**;
the examples mirror the same snippets (sole permitted divergence: import
lines, §examples). If an API change invalidates a snippet, Appendix A is
updated in the same commit and propagated everywhere.

Biome would rewrite these snippets — it collapses the column alignment that
makes the node tables readable and explodes the nested waypoint arrays, at
every line width — so `biome.json` exempts the two example files that carry
verbatim snippets (`examples/vanilla/`, `examples/custom-pen/`) from both
formatter and linter. `examples/react/` is ordinary authored code, not a
snippet copy, and stays fully checked. Markdown is not processed by Biome at
all, so every README snippet is unaffected.

**Root README sections, in order**: 1 Hero (name, tagline, SAMPLER hero image
via theme-aware `<picture>` over `docs/assets/hero-{light,dark}.png`);
2 Why pensketch (four one-line differentiator bullets from D1); 3 Install;
4 Quickstart vanilla (A1); 5 Quickstart React (A2); 6 The drawing model (one
prose paragraph + four field tables from D2 — DiagramNode/Edge/Note/Diagram:
field, type, default, meaning — + anchor glossary `t/b/l/r` + one sentence on
`via`); 7 The pen (A3 + one-row-per-method `Pen` table); 8 Theming
(CSS-variable table with D4 defaults + A4 + font paragraph); 9 Determinism &
testing your diagrams (seed story, two-sentence version policy, A5);
10 Examples table (folder, description, run command); 11 pensketch vs
rough.js (one honest paragraph, respectful link); 12 License.

**Package READMEs** (npm-facing): core = tagline, install, A1, `Pen` method
table, CSS-variable table, repo link; react = tagline, install + peer note,
A2, `PenSketchProps` table, `useSketch` signature with the A3 drawing in a
callback, repo link. npm does not reliably honor `<picture>` — package READMEs
embed `hero-light.png` via the absolute URL
`https://raw.githubusercontent.com/alpha-nu/pensketch/main/docs/assets/hero-light.png`.
The repository exists at `https://github.com/alpha-nu/pensketch`, so every URL
is written resolved — no placeholder markers at any point.

**CONTRIBUTING.md**: setup (`npm ci`); the six verification commands with one
line each; the golden policy (D5, including never-regenerate-to-green); how to
pick patch-vs-minor under the visual clause; the ASCII/`\uXXXX` fixture rule.

**README assets** (`tools/render-assets.mjs`): `playwright-core` (root
devDependency only — the no-browser flavor: it bundles nothing and downloads
nothing on install) drives the locally installed Google Chrome via
`channel: 'chrome'`. It renders the SAMPLER fixture on a minimal page (A4
variables + font stack) in a context with `deviceScaleFactor: 2` →
`docs/assets/hero-light.png`, then in a second context with
`colorScheme: 'dark'` → `hero-dark.png`. Backgrounds `#FFFFFF` / `#161B21`,
no margins, corner pixels verified against the background, PNGs committed.
Deterministic by construction (seeded renderer, fixed viewport). The script is
local-only — CI never renders assets — and exits with an
`npx playwright-core install chrome` hint when no Chrome is found (`install
chromium` fetches a Chrome-for-Testing build that `channel: 'chrome'` never
uses, so it would leave the reader just as stuck). The same harness
screenshot-verifies the examples. It defines its own hero diagram rather than
importing a parity fixture: the hero is marketing, and coupling it to a
fixture means any fixture edit silently changes the README image.

**Examples** (`examples/` — runnable, never published, excluded from
coverage/size/publish; all fixture strings ASCII with `\uXXXX` escapes):

- `vanilla/index.html` — self-contained (`<!DOCTYPE html>`, charset, A4 CSS,
  one `<svg>`, module script = A1 verbatim except the import line becomes
  `import { draw } from '../../packages/core/dist/index.js';`, commented as
  the only divergence — bare specifiers need a bundler). Header comment: run
  `npm run build` at the root first.
- `custom-pen/index.html` — same skeleton running A3 (same import
  adaptation), plus one short `draw()` whose diagram includes a `raw`
  callback, showing the escape hatch receives the same `Pen`.
- `react/` — minimal Vite app: `package.json` (private; deps
  `@pensketch/core` and `@pensketch/react` as `file:../../packages/core` and
  `file:../../packages/react` specifiers — the example sits outside the
  `packages/*` workspaces glob, so `file:` links are what make it installable
  before the first publish and keep it exercising local code afterwards; plus
  react, react-dom; devDeps vite, `@vitejs/plugin-react`, typescript),
  `vite.config.ts` (react plugin only, no aliases — the `file:` links
  resolve), `index.html`, `src/main.tsx`
  (createRoot, deliberately wraps in `<React.StrictMode>` as the
  double-effect smoke test), `src/App.tsx`
  (`<PenSketch diagram={BUDGETS} seed={11} viewBox="0 0 900 470"
  aria-label="Nested time budgets" />` + `<CustomSketch/>`), `src/budgets.ts`
  (the BUDGETS fixture as typed `Diagram`), `src/CustomSketch.tsx`
  (`useSketch` running the A3 drawing). Run: root `npm run build` once, then
  `npm install && npm run dev` inside the example.

Every example is screenshot-verified with headless Chrome at implementation
time and after any API change (diagrams render, labels legible, dark mode
switches under emulated `prefers-color-scheme`); the check stays manual — CI
covers the packages.

**API docs**: JSDoc on every exported symbol; `@example` on `draw`, `pen`,
`PenSketch`, `useSketch` (short forms of Appendix A). The d.ts files are the
API reference; no docs site. No other documents.

---

## Appendix A — canonical snippets (single source of truth)

### A1 — vanilla quickstart

```html
<svg id="flow" viewBox="0 0 700 150" role="img" aria-label="Request flow"></svg>
<script type="module">
  import { draw } from '@pensketch/core';

  draw(document.getElementById('flow'), {
    nodes: [
      { id: 'in',   shape: 'pill',    x: 40,  y: 50, w: 160, h: 50, lines: ['request'] },
      { id: 'gate', shape: 'diamond', x: 260, y: 35, w: 150, h: 80, lines: ['allowed?'] },
      { id: 'work', shape: 'box',     x: 480, y: 50, w: 180, h: 50, lines: ['do the work'], accent: true },
    ],
    edges: [
      { from: ['in', 'r'],   to: ['gate', 'l'] },
      { from: ['gate', 'r'], to: ['work', 'l'], label: 'yes', lx: 445, ly: 60 },
      { from: ['gate', 'b'], to: ['in', 'b'], via: [[335, 135], [120, 135]],
        dotted: true, label: 'no', lx: 225, ly: 122 },
    ],
  }, { seed: 7 });
</script>
```

### A2 — React quickstart

```tsx
import { PenSketch } from '@pensketch/react';
import type { Diagram } from '@pensketch/core';

const FLOW: Diagram = {
  nodes: [
    { id: 'in',   shape: 'pill',    x: 40,  y: 50, w: 160, h: 50, lines: ['request'] },
    { id: 'gate', shape: 'diamond', x: 260, y: 35, w: 150, h: 80, lines: ['allowed?'] },
    { id: 'work', shape: 'box',     x: 480, y: 50, w: 180, h: 50, lines: ['do the work'], accent: true },
  ],
  edges: [
    { from: ['in', 'r'],   to: ['gate', 'l'] },
    { from: ['gate', 'r'], to: ['work', 'l'], label: 'yes', lx: 445, ly: 60 },
    { from: ['gate', 'b'], to: ['in', 'b'], via: [[335, 135], [120, 135]],
      dotted: true, label: 'no', lx: 225, ly: 122 },
  ],
};

export function Flow() {
  return <PenSketch diagram={FLOW} seed={7} viewBox="0 0 700 150" aria-label="Request flow" />;
}
```

(The `FLOW` diagram literal is identical in A1 and A2 by design.)

### A3 — the pen (low-level)

```js
import { pen } from '@pensketch/core';

const p = pen(document.querySelector('svg'), { seed: 3 });
p.rect(20, 20, 200, 90);
p.label(120, 65, 'hand-drawn box');
p.arrow([[220, 65], [320, 65]]);
p.pill(320, 40, 150, 50);
p.label(395, 65, ['a pill', '(two lines)']);
```

### A4 — theming + font

```css
:root {
  --ps-ink: #232B36;
  --ps-pen: #2B5B8A;
  --ps-accent: #B3402E;
  --ps-muted: #5A6572;
  --ps-wash: rgba(43, 91, 138, .05);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ps-ink: #D9DFE7;
    --ps-pen: #7FA9DB;
    --ps-accent: #DB8570;
    --ps-muted: #93A0AD;
    --ps-wash: rgba(127, 169, 219, .07);
  }
}
/* the hand-drawn feel depends on a handwriting font for labels */
svg text {
  font-family: "Chalkboard SE", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive;
}
```

### A5 — snapshot-testing your own diagrams (vitest, jsdom environment)

```ts
// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { draw } from '@pensketch/core';
import { FLOW } from './flow';

test('flow diagram renders byte-stably', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  draw(svg, FLOW, { seed: 7 });
  // Same seed + same pensketch version = same bytes. A snapshot diff means
  // either the diagram data changed or a visual-minor upgrade landed.
  expect(svg.outerHTML).toMatchSnapshot();
});
```
