import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// The build already minifies each entry, so gzipping the file as it sits on
// disk is the min+gzip figure these budgets are expressed in.
const PACKAGES = [
  {
    // 5248 from 5120: the third firing of the depth tripwire, and the first
    // that moves the root entry. D7 priced this change's whole core-side
    // surface at 4882 and recorded 5120 as "unmoved"; groups 2 and 3 landed
    // it at 5099, 217 B past that column - a larger falsification than either
    // that already forced a re-decision (118 B on ./server at 2.3, 131 B on
    // ./check at T-D7b). The test this change applied to itself is on the
    // record: at 2.3 core stood at 4995 with 125 B free, "above the standard,
    // so its number stands". 21 B is not the standard, and this file has
    // already ruled a 20 B margin none. 5099 + 100 = 5199, up to the next
    // multiple of 64.
    //
    // Measured against final code, not a forecast: tasks 4.1-4.3 are
    // MCP-side, and an oversized JSDoc block added to types.ts and rebuilt
    // left all three entries byte-identical, the minifier stripping it. So
    // nothing left in this change can move this number.
    //
    // 5312 from 5248: "nothing left in this change" was true of the plan and
    // not of the review - the owner eye-checked the shipped hero and 5.6 put
    // the corner rib and the per-face hatch back into the pen, +57 B on this
    // entry, leaving 89 of the 100 this file calls the standard. The fourth
    // firing, and the first from a defect no rehearsal could have priced,
    // because the defect was found by looking at the picture. 5159 + 100 =
    // 5259, up to the next multiple of 64.
    //
    // 5440 from 5312, one owner eye-check later: 5.7 taught the pill's band
    // to ride the deviations its front was drawn with, +153 B, and this
    // entry passed its gate with a single byte to spare. A budget met by
    // one byte is not a budget met - it is the next one-line fix failing a
    // gate this file exists to keep green. 5311 + 100 = 5411, up to 5440.
    name: '@pensketch/core',
    entry: 'packages/core/dist/index.js',
    budget: 5440,
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
    // 3648 from 3520 for `depth`: the checker learns the swept box an
    // extruded node occupies and the anchors the renderer moves. The built
    // rehearsal of the whole change lands this entry at 3500, leaving 20 B -
    // but that margin is measured over a rehearsal of groups that had not
    // landed, an estimate rather than code, and the requirement's one step
    // means the raise rides now with the server's or waits to be taken at a
    // failing gate, which the paragraph above it forbids. 3500 plus the
    // same 100 B of headroom is 3600, taken up to 3648.
    // 3968 from 3648 for the checker's half of `depth`. The 3648 raise was
    // sized over a rehearsal column that excluded, in its own words, the
    // label-rule split and the per-rule anchor walks - and those are most of
    // what group 3 turned out to be: the sweep, the moved edge walks and the
    // shared resolution landed this entry at 3631, 131 B past that column,
    // with the `undrawable-depth` rule still unwritten.
    //
    // That rule was then rehearsed against this file's own standard - the
    // messages written to the spec's letter rather than stubbed, since a
    // stubbed message is exactly how the last estimate went 118 B wrong - and
    // measured 3811. Plus the conventional 100 B of gzip headroom is 3911,
    // taken up to the next multiple of 64. Rehearsal reverted; the entry
    // measures 3631 as this number lands, so the gate is green while it moves.
    name: '@pensketch/core/check',
    entry: 'packages/core/dist/check.js',
    budget: 3968,
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
    //
    // 4480 from 4300 for `order`, the option that stamps each element with how
    // far through the drawing it is so a stylesheet can reveal them in turn.
    // This entry stands at 4196 with 104 B free, and the feature does not fit:
    // a built prototype - the three phase boundaries, the rank that reads
    // them, the sort, the `pathLength` guard and the inline `style` prefix -
    // measures 4374 here, so +178. Not an estimate; it rendered, and
    // `order: false` output came back byte-identical to the golden. 4374 plus
    // the same 100 B of gzip headroom is 4474, taken up to 4480.
    //
    // This entry is the one that binds, and that is the whole reason it has a
    // budget: it carries its own copy of `draw`, so it pays for a renderer
    // feature whether or not a server ever passes the option.
    //
    // Built and measured against those prototype figures: this entry 4378
    // rather than 4374, and the root entry 4380 - which is +201 on the 4179 it
    // stood at, so unlike every raise above it this one *does* move the root
    // entry, and by about a twentieth of it. `order` is a behaviour of `draw`
    // rather than an entry point somebody imports, so every consumer carries it
    // whether or not a diagram ever asks for it. That is the same departure the
    // hop paragraph above records, and it is stated again because a reader
    // scanning for "does not move" would otherwise find it and be wrong.
    // `./check` lands at 3391 against 3520 - it imports constants, sample and
    // types and never `draw`, so that 1 B is the toolchain noise the margin
    // exists for.
    //
    // 4992 from 4480 for `depth`, the extrusion pair. This entry stands at
    // 4379 with 101 B free and the feature does not fit: the pen's silhouette
    // algorithm alone, built and measured, lands it at 4727, and the whole
    // core-side surface - draw's pair and its resolution, the moved anchors,
    // the validation rule - measured 4868 as a built rehearsal, reverted
    // after it was read. 4868 plus the same 100 B of gzip headroom is 4968,
    // taken up to 4992. Sized from the rehearsal rather than from the first
    // commit that needs room, because the requirement says one step, and a
    // second raise inside one change is a budget chasing its code. The root
    // entry measured 4882 on the same rehearsal against its 5120 and does
    // not move; `./check` moves above, and for the checker's own code.
    //
    // 5120 from 4992, the depth tripwire taken: D7's rehearsal priced the
    // whole change at 4868 here, but it priced "a minimal validation
    // throw", and the validation the spec actually demands - the offender,
    // the value, what is accepted, whose field carried it - measured 4986
    // when it landed, 118 B past the rehearsal with 6 B of budget left. Six
    // bytes is under this file's own margin standard, and D7 pre-registered
    // exactly this failure: the arithmetic was wrong, so the number is
    // re-decided, not nudged - 4986 plus the same 100 B of headroom is
    // 5086, taken up to 5120. Re-decided at a green gate; nothing was
    // failing when the number moved. The root entry landed at 4995 against
    // its own 5120 with 125 B free, above the standard, and does not move.
    //
    // 5248 from 5120, with the root entry and for the same reason: this entry
    // was re-decided at 2.3 on an arithmetic that assumed 100 B of headroom,
    // and group 3 left it 33. That the sentence above says the root entry
    // "does not move" is the whole point - it did, by 104 B, and a number
    // whose stated reason has gone false is re-decided rather than left
    // standing because it happened to hold. 5087 + 100 = 5187, up to 5248.
    //
    // 5312 from 5248, with the root entry and for its reason: 5.6's rib and
    // per-face hatch cost this bundled copy of the renderer 62 B, leaving
    // 99 - one byte under the standard, and this file has already ruled
    // that a margin the standard's sentence cannot cover is none.
    // 5149 + 100 = 5249, up to 5312.
    //
    // 5440 from 5312, with the root entry and for its reason: the ride cost
    // this copy 145 B and left 8. 5304 + 100 = 5404, up to 5440.
    name: '@pensketch/core/server',
    entry: 'packages/core/dist/server.js',
    budget: 5440,
  },
  {
    name: '@pensketch/react',
    entry: 'packages/react/dist/index.js',
    budget: 2048,
  },
  {
    // 704 from nothing, for the package that turns a diagram `draw` stamped
    // with `order` into one that draws itself. A prototype of it - the
    // stylesheet, the element-side helper and the string-side one - measured
    // 546; plus the same 100 B of gzip headroom every raise here uses is 646,
    // taken up to the next multiple of 64.
    //
    // A budget set from a prototype rather than from the finished package, so
    // it is a claim about how big this ought to be and not a record of how big
    // it turned out. Most of the weight is the stylesheet, which is a string
    // and so is not minified by the build: it is written compact in the
    // source, and gzip does the rest.
    //
    // 768 from 704, and this is the re-decision that paragraph asked for. The
    // finished package measured 614 against the prototype's 546 - inside 704,
    // but leaving 90 B where this file's own standard is 100, and a margin
    // below the toolchain noise it exists to absorb is not a margin. The rule
    // that makes this principled is the one the `./check` raise to 3520 states:
    // 100 B is owed to an entry not because it is owed, but because gzip has
    // been measured moving an entry by 2 B on identical code. 614 plus 100 is
    // 714, taken up to the next multiple of 64.
    //
    // Raised here rather than at a gate that failed - nothing failed. What
    // failed was the arithmetic, which sized the budget from a prototype 68 B
    // lighter than the package that shipped.
    name: '@pensketch/animation',
    entry: 'packages/animation/dist/index.js',
    budget: 768,
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
