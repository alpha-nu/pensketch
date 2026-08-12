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
    //
    // 3072 from 2560 for the curved connectors. Measuring a loop or a bow
    // means sampling it, so this entry gained `arcPoints`, `bowPoints` and
    // `loopPoints` - 377 B it had been tree-shaking away, of which the
    // rewritten rule is 5. Raised once, before the rule that needed the room
    // was written, rather than a byte at a time at each gate.
    name: '@pensketch/core/check',
    entry: 'packages/core/dist/check.js',
    budget: 3072,
  },
  {
    // The renderer again, plus a DOM the size of what it touches. It carries
    // its own copy of `draw` and `pen` rather than importing the root entry,
    // which is the point: a server installs this and nothing else. That copy
    // is also why this is the entry every renderer feature is measured
    // against: an error message added to `draw` lands here as well as in the
    // root. Raised from 3072 for the curved connectors, deliberately and once,
    // rather than a byte at a time at each gate.
    //
    // 3648 from 3328 for the braces phase, and the same way. The connectors
    // left 86 B free here; brace-annotations design.md D2 measured its
    // prototype of the phase - the type, the render, the point generation - at
    // +276 B on this entry, and the label refusal it did not prototype is a
    // message on top of that. 3242 + 276 + about 30 is 3548, so this is the
    // need plus 100 B rather than the need plus 36: a gate that fails on gzip
    // noise is a gate somebody starts arguing with.
    //
    // 3872 from 3648 for hatching that follows the outline it is drawn inside
    // rather than the box the outline sits in. This entry stands at 3519 with
    // 129 B free, and the feature is measured - built, not estimated - at
    // 3773: a scanline clip and the shape's own inset, kept alongside the
    // closed form the reference renderer uses rather than replacing it,
    // because a box routed through a contour clip loses the degenerate stroke
    // the reference opens its hatching with and parity fails structurally.
    // 3773 plus the same 100 B of gzip headroom is 3873, taken down to 3872.
    // The root entry lands at 3750 against 5120 and `./check` at 3008 against
    // 3072, so neither moves; `./check` gains 2 B of gzip on identical code,
    // esbuild having renamed some locals, which is the noise the margin above
    // exists for.
    //
    // 4240 from 3872 for connectors that hop where they cross. This entry
    // stands at 3773 with 99 B free, and a built prototype of the whole
    // feature - the two fields, the all-pairs detection, the splice through
    // `bowPoints`, and collecting every path before drawing any of them, which
    // an edge needs in order to see the others - measures 4134 here. Not an
    // estimate: it rendered, hops changed the output, and `hop: false` moved
    // the arc to the other edge of the crossing. 4134 plus the same 100 B of
    // gzip headroom is 4234, taken up to 4240.
    //
    // The root entry lands at 4122 against 5120, so it does not move, and
    // `./check` at 3006 against 3072, 2 B *below* where it stands today on
    // code the feature never reaches - gzip noise again, in the other
    // direction this time.
    //
    // 4300 from 4240, same change, because calibration replaced the mechanism.
    // The bow the proposal described cannot be drawn by this pen: displacing a
    // line perpendicular to itself moves the apex *along* whatever it crosses
    // at a right angle, so the bump lands on the line it is meant to bridge,
    // and ARC_MIN_CHORD flattens an arc that small into two chords, making the
    // apex a vertex. Rendered at four sizes it read as a junction every time.
    // What replaced it is a break in the line underneath.
    //
    // The break costs *more* than the bow, not less: 4196 here against the
    // bow's 4134. A splice is one polyline and one `arrow` call; a break is a
    // list of runs, a loop, and a `stroke` for each of them but the last. 4196
    // plus the usual 100 B is 4296, taken up to 4300. The root entry lands at
    // 4179 against 5120 and still does not move.
    //
    // Worth stating plainly, because the number is large: +429 B on the root
    // entry is about a tenth of it, and every consumer carries it whether or
    // not any diagram ever sets `hop`. That is a departure from what the
    // subpath budgets exist to enforce - a consumer who never imports the
    // checker ships none of it - and it is unavoidable here, because hopping
    // is a behaviour of `draw` rather than an entry point somebody imports.
    name: '@pensketch/core/server',
    entry: 'packages/core/dist/server.js',
    budget: 4300,
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
const measured = new Map();

// Every package is measured before exiting, so one breach cannot hide another.
for (const { name, entry, budget } of PACKAGES) {
  const file = new URL(entry, root);
  if (!existsSync(file)) {
    console.error(`FAIL ${name}: ${entry} is missing - run \`npm run build\``);
    failed = true;
    continue;
  }
  const actual = gzipSync(readFileSync(file), { level: GZIP_LEVEL }).length;
  measured.set(name, actual);
  const over = actual > budget;
  failed = failed || over;
  console.log(
    `${over ? 'FAIL' : 'PASS'} ${name}: ${actual} B (budget ${budget} B, min+gzip)`,
  );
}

// The README prints the root entry's size in the table that compares this
// project to rough.js, and a number a reader is invited to compare had better
// be the number the build produces. Every other derived thing here is held to
// its source by regenerating it and asserting the tree is clean; this one has
// no generator, so it is asserted instead. It went stale the first time an
// entry grew, which is one growth after it was written.
const README = 'README.md';
const CLAIM = /^\| Size, min\+gzip \| \*\*(\d+) B\*\* \|/m;
const root_size = measured.get('@pensketch/core');
const claim = CLAIM.exec(readFileSync(new URL(README, root), 'utf8'));

if (!claim) {
  console.error(
    `FAIL ${README}: no "Size, min+gzip" row found - if the comparison table moved, this check has to move with it`,
  );
  failed = true;
} else if (root_size !== undefined && Number(claim[1]) !== root_size) {
  console.error(
    `FAIL ${README}: the comparison table says ${claim[1]} B, the build measures ${root_size} B`,
  );
  failed = true;
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
