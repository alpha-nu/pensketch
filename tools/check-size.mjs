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
    //
    // 3264 from 3072 for `edge-overlap` reporting a shared run rather than
    // only a whole-length overlap. This entry stands at 3008 with 64 B free -
    // the tightest in the repository - and the rule does not fit in 64. A
    // built prototype of it - the point-to-path proximity test, the walk that
    // accumulates the longest near-stretch along a segment, the two thresholds
    // and the length in the message - measured 3161, so +153. 3161 plus the
    // same 100 B of gzip headroom is 3261, taken up to 3264. The prototype was
    // reverted once it had been measured: nothing it declared is in the tree,
    // and this comment is the surviving record in code of what was weighed.
    //
    // Two figures, because both were built and the cheaper was rejected on 9
    // bytes. Taking the shared run as `max(run(a,b), run(b,a))` measured 3161;
    // taking it one way round only measured 3152. The symmetric form is what a
    // run means when one path wanders and the other does not, and 9 B is not a
    // reason to carry an asymmetry whose answer depends on which edge the
    // caller happened to write first.
    //
    // The root entry and `./server` were measured on the same prototype and
    // did not move at all - 4179 and 4196, both unchanged - which is the check
    // that the rule landed in the checker rather than in shared code. That
    // holds wherever the two thresholds end up living: this entry imports
    // named constants and tree-shakes the frozen `constants` object away
    // entirely, so only joining that object - which the root entry and
    // `./server` do carry - would move them. Whether they join it is open.
    //
    // 3392 from 3264, same change, because 3264 was measured against the wrong
    // mechanism. That prototype *replaced* the whole-length test with the
    // shared-run one; the spec keeps both, and the rule as built has to. What
    // forced it was not the spec on paper but the existing tests: an unguarded
    // run test reports a pair bowed 5 px apart as a 93 px run, so the rule
    // would name `bow` as the fix and then go on reporting the pair that took
    // it, against a separation this repository had already measured at 4
    // firing and 5 not. It also reported a short edge lying inside a longer
    // one, which the baseline keeps quiet on purpose.
    //
    // So the shipped rule keeps `along` and adds a run measured only for a
    // pair sharing exactly one end - a trunk two connectors leave or arrive on
    // together - which is both guards in one test and leaves all 364 existing
    // tests passing unedited. Built and measured cold at 3287, so +279 rather
    // than +153. Plus the same 100 B of gzip headroom is 3387, taken up to
    // 3392. The root entry and `./server` are still 4179 and 4196, unmoved.
    //
    // Raised here rather than at the gate that failed: the rule is not in this
    // commit. The requirement forbids correcting a budget after the fact, and
    // an under-measurement found by the tests is still found before the code
    // lands, so it moves the same way it did the first time - in advance, in
    // its own commit, carrying what was measured and why the first figure was
    // wrong.
    //
    // 3520 from 3392 for `text-collision`, a rule comparing text against text.
    // Every rule before it compares text against *strokes* - `struckBy` walks
    // the drawn polylines - so a node's label and a group's title, both ink and
    // neither a path, were invisible to all of them, and so was another label.
    //
    // This one is raised although the rule fits without it, which is the
    // opposite of the other three and wants its reason on the record. Built and
    // measured cold at 3390 against 3392: it fits by two bytes. Two bytes is
    // not a margin, it is the noise - the 3872 entry below records `./check`
    // gaining 2 B of gzip on identical code when esbuild renamed some locals -
    // so shipping at 3390 would leave a gate that goes red on a toolchain bump
    // with nothing changed in the source, which is the failure the paragraph in
    // the requirement is written against. The line that makes this principled
    // is that a margin smaller than measured toolchain noise is not a margin;
    // it is not that 100 B is owed to an entry. 3390 plus the same 100 B the
    // raises before it used is 3490, taken up to 3520.
    //
    // The rule cost +171 B as first written and +93 as measured here. What came
    // off: the node boxing folded into the loop already walking nodes for
    // `text-overflow`; the text carried as a `[subject, box]` tuple, a minifier
    // not renaming object keys and so holding those two names in the output;
    // each subject string built once where three loops built it twice; and most
    // of it from the message, phrased as `lies under ..., which will be drawn
    // through it` - a string check.ts already emits three times, for an edge
    // label, a brace label and a note, so gzip carries a fourth for almost
    // nothing. It is the accurate phrasing besides: texts are boxed in draw
    // order, so the second really is drawn over the first.
    //
    // The root entry and `./server` were measured on the same prototype and did
    // not move - 4179 and 4196 - which is the check that the rule landed in the
    // checker rather than in shared code.
    name: '@pensketch/core/check',
    entry: 'packages/core/dist/check.js',
    budget: 3520,
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
