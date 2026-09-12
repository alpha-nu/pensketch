import { readFileSync } from 'node:fs';

// Refuses a deploy of a version the registry cannot serve.
//
// `deploy/main.ts` imports `npm:@pensketch/mcp@<version>/http`, and that
// version is written by `npm run pin` from the manifest - which carries the
// *last released* version, not the one the pending changesets describe. So
// between adding the HTTP transport and releasing it, the pin is correct by
// its own rule and points at a tarball with no `./http` in it.
//
// Deno Deploy's failure for that is a module resolution error in a build log,
// on a hostname that then serves nothing. This is the same fact, said here,
// before anything is uploaded.
//
// Runs as `predeploy`, so `npm run deploy` cannot skip it.

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

const fail = (message) => {
  console.error(`FAIL check-deploy: ${message}`);
  process.exit(1);
};

const entry = read('deploy/main.ts');
const pinned = entry.match(/npm:@pensketch\/mcp@([^/'"]+)\//)?.[1];
if (!pinned)
  fail(
    'deploy/main.ts does not import `npm:@pensketch/mcp@<version>/http`. That specifier is what `npm run pin` maintains and what this checks; if the entry changed shape, both need to change with it.',
  );

const { version } = JSON.parse(read('packages/mcp/package.json'));
if (pinned !== version)
  fail(
    `deploy/main.ts pins ${pinned} and the manifest carries ${version}. Run \`npm run pin\`.`,
  );

// What the registry actually holds, rather than what the manifest claims.
const response = await fetch(
  `https://registry.npmjs.org/@pensketch/mcp/${pinned}`,
);
if (response.status === 404)
  fail(
    `@pensketch/mcp@${pinned} is not on npm. The manifest carries the last released version, so a release is pending: publish it before deploying, or the deployment imports a tarball that does not exist.`,
  );
if (!response.ok)
  fail(`npm answered ${response.status} for @pensketch/mcp@${pinned}.`);

const manifest = await response.json();
if (!manifest.exports?.['./http'])
  fail(
    `@pensketch/mcp@${pinned} is published but has no \`./http\` export, so the deployment entry cannot import a handler from it. The HTTP transport landed after that release; publish the version that carries it.`,
  );

console.log(
  `PASS check-deploy: @pensketch/mcp@${pinned} is on npm and exports ./http`,
);
