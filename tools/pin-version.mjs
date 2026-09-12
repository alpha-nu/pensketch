import { readFileSync, writeFileSync } from 'node:fs';

// Rewrites the version a reader is told to install - and the one the MCP
// registry is told to list - from the version the package actually carries.
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

// `server.json` is what `mcp-publisher` sends to the MCP registry, and it
// names a version twice: once for the server entry and once for the npm
// package it points at. Both have to be the version actually on npm, or the
// registry lists a release nobody can install.
//
// That is a third and fourth home for a number that already has two, which is
// exactly the drift this file was written for. So it is derived here rather
// than maintained, and CI's tree-clean assertion is what notices.
const SERVER_JSON = 'packages/mcp/server.json';

const fail = (message) => {
  console.error(`FAIL pin-version: ${message}`);
  process.exit(1);
};

const { mcpName } = JSON.parse(read('packages/mcp/package.json'));
const server = JSON.parse(read(SERVER_JSON));

// The registry verifies ownership by fetching the *published* package and
// matching its `mcpName` against the server name. The two drifting apart is a
// publish that fails at the registry with nothing here to explain it, so it is
// asserted rather than assumed.
if (!mcpName)
  fail(
    'packages/mcp/package.json has no `mcpName`. The MCP registry reads it off the published package to verify ownership, and publishing without it means cutting another release for one line.',
  );
if (server.name !== mcpName)
  fail(
    `${SERVER_JSON} is named "${server.name}" and packages/mcp/package.json declares mcpName "${mcpName}". The registry matches those two, so a publish with them apart is refused.`,
  );

const entry = (server.packages ?? []).find(
  (p) => p.identifier === '@pensketch/mcp',
);
if (!entry)
  fail(
    `${SERVER_JSON} lists no npm package with identifier "@pensketch/mcp", so there is nothing for this tool to pin and nothing for a client to install.`,
  );

// `deploy/main.ts` is here for the same reason the READMEs are: it names a
// published version, and a version written by hand is a fact with a
// release-long life. It imports `npm:@pensketch/mcp@<version>/http`, which the
// pin below matches without disturbing the specifier around it.
const FILES = ['README.md', 'packages/mcp/README.md', 'deploy/main.ts'];

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
  fail(
    `no \`@pensketch/mcp@<version>\` found in ${FILES.join(' or ')}. The install instructions are pinned on purpose; if that changed, this tool and the reasoning above need to change with it.`,
  );
}

if (server.version !== version || entry.version !== version) {
  server.version = version;
  entry.version = version;
  writeFileSync(
    new URL(SERVER_JSON, root),
    `${JSON.stringify(server, null, 2)}\n`,
  );
  changed.push(SERVER_JSON);
}

console.log(
  `pinned @pensketch/mcp@${version} in ${found} place${found === 1 ? '' : 's'}${
    changed.length ? ` (rewrote ${changed.join(', ')})` : ' (already current)'
  }`,
);
