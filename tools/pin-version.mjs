import { readFileSync, writeFileSync } from 'node:fs';

// Rewrites the version a reader is told to install, from the version the
// package actually carries.
//
// The pin itself is deliberate — `npx` without one fetches whatever is latest
// when a client happens to start, which is a strange way to decide what your
// tools do. But a version number written into prose is a fact with a
// release-long life, and prose is where facts go stale: `0.1.1` shipped while
// both READMEs still told a reader to install `0.1.0`, the release whose
// `render_png` drew nothing at all.
//
// So it is derived rather than typed. `npm run bump` runs this immediately
// after `changeset version`, which puts the corrected README in the same
// pull request as the bump that invalidated it, and CI regenerates and
// asserts the tree is unchanged — the same gate that holds the goldens, the
// schema and the served resources.
//
// Run locally: `npm run pin`.

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

const { version } = JSON.parse(read('packages/mcp/package.json'));

// Only an install pin: `@pensketch/mcp@1.2.3`. Prose that names a version
// without the package in front of it is history rather than instruction —
// "which is what `0.1.0` shipped" must not be rewritten into a lie.
const PIN = /@pensketch\/mcp@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g;

const FILES = ['README.md', 'packages/mcp/README.md'];

let found = 0;
const changed = [];
for (const file of FILES) {
  const before = read(file);
  const after = before.replace(PIN, () => {
    found++;
    return `@pensketch/mcp@${version}`;
  });
  if (after !== before) {
    writeFileSync(new URL(file, root), after);
    changed.push(file);
  }
}

// A README that lost its pin would leave this silently doing nothing, which
// is the failure this file exists to prevent, one level up.
if (!found) {
  console.error(
    `FAIL pin-version: no \`@pensketch/mcp@<version>\` found in ${FILES.join(' or ')}. The install instructions are pinned on purpose; if that changed, this tool and the reasoning above need to change with it.`,
  );
  process.exit(1);
}

console.log(
  `pinned @pensketch/mcp@${version} in ${found} place${found === 1 ? '' : 's'}${
    changed.length ? ` (rewrote ${changed.join(', ')})` : ' (already current)'
  }`,
);
