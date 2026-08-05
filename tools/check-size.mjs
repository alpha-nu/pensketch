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

if (failed) {
  process.exit(1);
}
