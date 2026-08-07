import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// The build already minifies each entry, so gzipping the file as it sits on
// disk is the min+gzip figure these budgets are expressed in.
const PACKAGES = [
  {
    name: '@pensketch/core',
    entry: 'packages/core/dist/index.js',
    budget: 5120,
  },
  {
    // Its own entry and its own budget. The root entry measured 2562 B before
    // this one existed and measures 2562 B after, which is the guarantee: a
    // consumer who never imports the checker ships none of it.
    //
    // 2560 rather than the 1536 design.md D5 guessed at before anything was
    // written. Measured, the rules and geometry are 557 B and the messages
    // are 1512 - findings that name the fix are three quarters of this entry
    // by weight. Fitting 1536 means cutting them by a third, and a caller who
    // cannot see the drawing has nothing but the message. This is the entry
    // an agent or a CI job loads, not one a page ships.
    name: '@pensketch/core/check',
    entry: 'packages/core/dist/check.js',
    budget: 2560,
  },
  {
    // The renderer again, plus a DOM the size of what it touches. It carries
    // its own copy of `draw` and `pen` rather than importing the root entry,
    // which is the point: a server installs this and nothing else.
    name: '@pensketch/core/server',
    entry: 'packages/core/dist/server.js',
    budget: 3072,
  },
  {
    name: '@pensketch/react',
    entry: 'packages/react/dist/index.js',
    budget: 2048,
  },
];

// Pinned so the reported size is reproducible across machines and Node
// versions instead of tracking whatever zlib defaults to.
const GZIP_LEVEL = 9;

const root = new URL('../', import.meta.url);
let failed = false;

// Every package is measured before exiting, so one breach cannot hide another.
for (const { name, entry, budget } of PACKAGES) {
  const file = new URL(entry, root);
  if (!existsSync(file)) {
    console.error(`FAIL ${name}: ${entry} is missing - run \`npm run build\``);
    failed = true;
    continue;
  }
  const actual = gzipSync(readFileSync(file), { level: GZIP_LEVEL }).length;
  const over = actual > budget;
  failed = failed || over;
  console.log(
    `${over ? 'FAIL' : 'PASS'} ${name}: ${actual} B (budget ${budget} B, min+gzip)`,
  );
}

// `@pensketch/mcp` carries no byte budget: it is spawned, never bundled into
// a page, so a kilobyte there costs nothing a reader waits for. What it does
// cost is the first `npx`, and this is the part of that wait the repository
// controls — its own files, the embedded font among them. The rasterizer is
// another 2.5 MB that arrives as a dependency and is not counted here.
// Reported rather than budgeted, so the number is one somebody has seen.
const packed = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--workspace', '@pensketch/mcp'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ),
)[0];

console.log(
  `INFO @pensketch/mcp: ${Math.round(packed.size / 1024)} KB packed, ${Math.round(packed.unpackedSize / 1024)} KB unpacked, ${packed.entryCount} files`,
);

if (failed) {
  process.exit(1);
}
