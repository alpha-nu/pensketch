import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Asserts that every published entry point resolves in both module systems
// and exposes exactly the documented surface.
//
// The rest of the project never loads `dist/`: tests and typecheck resolve
// core from source, deliberately, so they cannot run against a stale build.
// The cost is that nothing else would notice an exports map pointing at a
// file that is not there, a declaration rollup that failed, or a name that
// quietly stopped being exported. This is the only thing that looks.
//
// Run locally after `npm run build`: `npm run exports`.

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);

const ENTRIES = [
  {
    name: '@pensketch/core',
    base: 'packages/core/dist/index',
    surface: [
      'anchor',
      'constants',
      'defaultTheme',
      'draw',
      'mulberry32',
      'pen',
    ],
  },
  {
    name: '@pensketch/core/check',
    base: 'packages/core/dist/check',
    // Everything else in the checker's API is a type, and types are erased
    // before this can see them. They are held to their contract by the suite,
    // which only typechecks while each one is exported.
    surface: ['check'],
  },
  {
    name: '@pensketch/core/server',
    base: 'packages/core/dist/server',
    surface: ['renderToString'],
  },
  {
    name: '@pensketch/react',
    base: 'packages/react/dist/index',
    surface: ['PenSketch', 'useSketch'],
  },
];

let problems = 0;

const fail = (message) => {
  console.error(`FAIL ${message}`);
  problems++;
};

// Every entry is checked before exiting, so one breach cannot hide another -
// including in the reporting: an entry's own result is decided by its own
// problems, not by whether an earlier entry had any.
for (const { name, base, surface } of ENTRIES) {
  const expected = [...surface].sort();
  const before = problems;

  for (const [system, ext, load] of [
    ['import', '.js', (url) => import(url)],
    ['require', '.cjs', (url) => require(fileURLToPath(url))],
    // Declarations are not loaded, only required to exist: a missing one
    // leaves a consumer with an untyped import and no error anywhere.
    ['types', '.d.ts', null],
    ['types', '.d.cts', null],
  ]) {
    const url = new URL(`${base}${ext}`, root);
    if (!existsSync(url)) {
      fail(`${name}: ${base}${ext} is missing - run \`npm run build\``);
      continue;
    }
    if (!load) continue;

    const actual = Object.keys(await load(url)).sort();
    if (actual.join() !== expected.join())
      fail(
        `${name} (${system}) exports ${actual.join(', ') || 'nothing'}; expected ${expected.join(', ')}`,
      );
  }

  if (problems === before) console.log(`PASS ${name}: ${expected.join(', ')}`);
}

if (problems) {
  process.exit(1);
}
