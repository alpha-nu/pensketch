import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

// Records a diagram drawing itself, as an MP4, with the locally installed
// Google Chrome and an ffmpeg from PATH.
//
// It exists for the places that will not render an SVG - LinkedIn, X, Slack, a
// slide deck - where an animated diagram otherwise has to become a still. The
// animation package is what draws it; this only drives it and photographs it.
//
// Run locally, never in CI: `npm run record -- path/to/diagram.mjs`. Nothing
// in the build depends on its output, and CI has neither a reason to make a
// video nor an ffmpeg to make one with.
//
// Deterministic in the same sense as `tools/render-assets.mjs`, and for the
// same reason - the seeded renderer, the fixed viewport, software
// rasterization, and here also an embedded font and a timeline this file
// steps by hand rather than waits on. The same input records the same frames
// on any machine.

const root = new URL('../', import.meta.url);
const CORE = new URL('packages/core/dist/index.js', root);
const ANIMATION = new URL('packages/animation/dist/index.js', root);
const FONT = new URL('packages/mcp/fonts/ArchitectsDaughter-Subset.ttf', root);

const USAGE = `node tools/record.mjs <diagram file> [options]

The file is .mjs, .js or .json and provides, as its default export or at the
top level of the JSON:

  viewBox   [x, y, w, h]   required
  diagram   { nodes, edges, notes, braces }   required
  label     an accessible name   optional
  seed      the pen's seed, default 1   optional

  --out <file>         output path         (default: input path with .mp4)
  --scale <n>          device pixel ratio  (default 2)
  --fps <n>            frames per second   (default 30)
  --duration <ms>      the drawing         (default 4000)
  --stroke <ms>        one element         (default 500)
  --easing <fn>        CSS easing function (default: the stylesheet's own)
  --hold <ms>          still frames after it finishes (default 3000)
  --theme light|dark   (default light)
  --background <css>
  --seed <n>           overrides the file's seed
  --frames <dir>       write PNGs to <dir> and skip ffmpeg entirely
  --system-font        use the SVG's own handwriting stack
  --ffmpeg <path>      (or the PENSKETCH_FFMPEG environment variable)`;

// The frames live in a temporary directory unless a caller asked for them
// somewhere, and a failed encode must not leave hundreds of PNGs behind. An
// `exit` handler rather than a `finally`, because the ways out of this file
// include `fail` calling `process.exit` from a page event handler, and an
// uncaught throw; `exit` covers all of them and `rmSync` is synchronous, which
// is the only kind of work an exit handler can still do.
let scratch;
process.on('exit', () => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

function fail(message) {
  console.error(`FAIL record: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

// Every option this file knows, and nothing else is tolerated. A typo'd flag
// silently ignored would produce a video that is wrong in a way nobody
// notices - the wrong duration is still a plausible-looking animation - so an
// unknown one is named and refused, the way the checker refuses an unknown
// key in a diagram.
const OPTIONS = new Set([
  'out',
  'scale',
  'fps',
  'duration',
  'stroke',
  'easing',
  'hold',
  'theme',
  'background',
  'seed',
  'frames',
  'ffmpeg',
]);

const raw = {};
let input;
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--system-font') {
    raw.systemFont = true;
    continue;
  }
  if (arg.startsWith('-')) {
    const equals = arg.indexOf('=');
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    if (!arg.startsWith('--') || !OPTIONS.has(name))
      fail(`unknown option \`${arg}\` - run with --help for the list`);
    const value = equals === -1 ? argv[++i] : arg.slice(equals + 1);
    if (value === undefined) fail(`\`--${name}\` needs a value`);
    raw[name] = value;
    continue;
  }
  if (input !== undefined)
    fail(`one diagram file at a time - got \`${input}\` and \`${arg}\``);
  input = arg;
}
if (input === undefined) fail('no diagram file given - run with --help');

/**
 * A flag that must be a finite number, and inside the range its meaning
 * allows. `Number('')` is 0 and `Number('30fps')` is NaN, so both the empty
 * value and the unit somebody appends are refused here by name rather than
 * silently becoming a frame rate.
 */
const numeric = (name, fallback, allowed, expected) => {
  if (raw[name] === undefined) return fallback;
  const value = Number(raw[name]);
  if (raw[name].trim() === '' || !Number.isFinite(value) || !allowed(value))
    fail(`--${name} must be ${expected}, not \`${raw[name]}\``);
  return value;
};

const above = (n) => n > 0;
const scale = numeric('scale', 2, above, 'a number greater than zero');
const fps = numeric('fps', 30, above, 'a number greater than zero');
const duration = numeric('duration', 4000, above, 'a duration in ms above 0');
const stroke = numeric('stroke', 500, above, 'a duration in ms above 0');
// Zero is a legitimate answer here and only here: `--hold 0` is a recording
// that ends the instant the drawing does, which is what somebody making a
// loop wants. Every other number above is a rate or a span, and none of them
// means anything at zero.
const hold = numeric('hold', 3000, (n) => n >= 0, 'a duration in ms, or 0');
const theme = raw.theme ?? 'light';
if (theme !== 'light' && theme !== 'dark')
  fail(`--theme is light or dark, not \`${theme}\``);

const source = resolve(input);
if (!existsSync(source)) fail(`no such file: ${source}`);

const extension = extname(source).toLowerCase();
let config;
if (extension === '.json') {
  try {
    config = JSON.parse(readFileSync(source, 'utf8'));
  } catch (error) {
    fail(`${source} is not valid JSON: ${error.message}`);
  }
} else if (extension === '.mjs' || extension === '.js') {
  const module = await import(pathToFileURL(source).href);
  config = module.default;
  if (config === undefined)
    fail(`${source} has no default export - see --help for the shape`);
} else {
  fail(`${source} is not a .mjs, .js or .json file`);
}

if (typeof config !== 'object' || config === null || Array.isArray(config))
  fail(`${source} does not provide an object`);

// Required by name rather than sniffed for. A bare diagram object would be
// convenient to pass and impossible to tell from a malformed configuration,
// and the recorder cannot invent a frame to draw it in: there is no fitting
// step here, so the viewBox is the video's aspect ratio and has to be a
// decision somebody made.
if (!Array.isArray(config.viewBox) || config.viewBox.length !== 4)
  fail(`${source} has no \`viewBox\` - four numbers, [x, y, width, height]`);
if (!config.viewBox.every((n) => Number.isFinite(n)))
  fail(`${source} has a \`viewBox\` that is not four numbers`);
if (
  typeof config.diagram !== 'object' ||
  config.diagram === null ||
  Array.isArray(config.diagram)
)
  fail(`${source} has no \`diagram\``);
if (config.label !== undefined && typeof config.label !== 'string')
  fail(`${source} has a \`label\` that is not a string`);
if (config.seed !== undefined && !Number.isFinite(config.seed))
  fail(`${source} has a \`seed\` that is not a number`);

// The same constraint `tools/render-assets.mjs` documents, met here for the
// same reason: the diagram is handed to the page through `page.evaluate`,
// which crosses as JSON, and `raw` holds functions. Refused by name rather
// than dropped, because a dropped `raw` records a diagram missing whatever it
// drew and nothing says so.
if (config.diagram.raw !== undefined)
  fail(
    `${source} has \`diagram.raw\`, which cannot be recorded: the diagram ` +
      'crosses into the page as JSON and JSON carries no functions. Move ' +
      'what `raw` draws into nodes, edges, notes or braces.',
  );

const [, , width, height] = config.viewBox;
if (width <= 0 || height <= 0)
  fail(`the viewBox is ${width}x${height}; both sides must be positive`);
// Playwright's viewport is in whole CSS pixels, and a viewBox is the author's
// own frame rather than something derived, so a fractional one is a typo far
// more often than it is a request.
if (!Number.isInteger(width) || !Number.isInteger(height))
  fail(`the viewBox is ${width}x${height}; both sides must be whole numbers`);

// Any finite number: a seed is a choice of drawing rather than a magnitude,
// so zero and negatives are as valid as anything else.
const seed = numeric('seed', config.seed ?? 1, () => true, 'a number');
const label = config.label;

const frameWidth = width * scale;
const frameHeight = height * scale;

// H.264 in yuv420p subsamples chroma 2x2, so an odd side carries half a
// chroma sample and no encoder can represent it. Padding or rounding would
// hand back a video of something other than what was asked for, and the check
// runs even under `--frames` - frames exist to be encoded, and discovering
// this after the fact costs another few hundred screenshots.
const usable = (candidate) =>
  Number.isInteger(width * candidate) &&
  (width * candidate) % 2 === 0 &&
  Number.isInteger(height * candidate) &&
  (height * candidate) % 2 === 0;

if (!usable(scale)) {
  const better = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]
    .filter(usable)
    .sort((a, b) => Math.abs(a - scale) - Math.abs(b - scale))[0];
  fail(
    `${width}x${height} at ${scale}x is ${frameWidth}x${frameHeight}, and ` +
      'H.264 needs an even whole number of pixels on both sides' +
      (better === undefined
        ? ' - change the viewBox'
        : `; --scale ${better} gives ${width * better}x${height * better}`),
  );
}

for (const bundle of [CORE, ANIMATION]) {
  if (!existsSync(bundle)) {
    const name = bundle.pathname.slice(root.pathname.length);
    fail(`${name} is missing - run \`npm run build\``);
  }
}

const framesDir = raw.frames === undefined ? undefined : resolve(raw.frames);
const out = raw.out
  ? resolve(raw.out)
  : `${source.slice(0, -extension.length)}.mp4`;

// Whatever is on PATH, and not an npm dependency, deliberately. A static
// ffmpeg is around 45 MB fetched on every `npm ci`, CI included, for a tool
// CI never runs and one person uses; the real one is a package manager away
// on every platform this is developed on. The two overrides are for a machine
// that keeps it somewhere PATH does not reach.
const binary = raw.ffmpeg ?? process.env.PENSKETCH_FFMPEG ?? 'ffmpeg';

/** A child process, run to completion, with whatever it said on stderr. */
const run = (command, args) =>
  new Promise((done) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => done({ error, stderr }));
    child.on('close', (code) => done({ code, stderr }));
  });

function noFfmpeg(error) {
  if (error.code !== 'ENOENT')
    fail(`\`${binary}\` could not be run: ${error.message}`);
  fail(
    `no ffmpeg to encode with (tried \`${binary}\`).\n` +
      '  Install one - macOS: `brew install ffmpeg`, Debian or Ubuntu: ' +
      '`apt install ffmpeg`.\n' +
      '  Or name one: `--ffmpeg <path>`, or the PENSKETCH_FFMPEG ' +
      'environment variable.\n' +
      '  Or skip the encode: `--frames <dir>` writes the PNGs and stops, ' +
      'and prints the\n' +
      '  ffmpeg command that turns them into an MP4 whenever you have one.',
  );
}

// Checked before a single screenshot is taken. ffmpeg missing is the first
// thing most people will hit, and finding out after several hundred frames -
// which are then deleted - is the difference between a message and an insult.
if (framesDir === undefined) {
  const probe = await run(binary, ['-version']);
  if (probe.error) noFfmpeg(probe.error);
}

const face = raw.systemFont ? '' : readFileSync(FONT).toString('base64');

// The same palette `tools/render-assets.mjs` renders the README images with.
// Resolved here rather than left to a `prefers-color-scheme` block, because
// this file knows which theme it is recording: a media query would leave the
// custom properties to the emulated scheme while `--background` was set from
// the flag, and the two could then disagree. The context is still told the
// scheme, so anything the user agent styles for itself agrees as well.
const PALETTES = {
  light: {
    ink: '#232B36',
    pen: '#2B5B8A',
    accent: '#B3402E',
    muted: '#5A6572',
    wash: 'rgba(43, 91, 138, .05)',
    background: '#FFFFFF',
  },
  dark: {
    ink: '#D9DFE7',
    pen: '#7FA9DB',
    accent: '#DB8570',
    muted: '#93A0AD',
    wash: 'rgba(127, 169, 219, .07)',
    background: '#161B21',
  },
};

const palette = PALETTES[theme];
// Interpolated into the `<style>` below without escaping, unlike the timing
// options `@pensketch/animation` escapes on the way into one. The shapes look
// alike and the positions are not: that guard protects a library from a
// string its caller was handed, where this one is typed on the command line
// by the person running the tool against their own machine. There is nothing
// here they could reach that they do not already have.
const background = raw.background ?? palette.background;

// The stack the SVG itself names is Chalkboard SE and friends: proprietary
// system faces, present on some machines and not others, so the same diagram
// records in a different hand on every machine and at different widths. The
// embedded face is the open-licence one `@pensketch/mcp` rasterizes with,
// chosen there by measuring glyph advance against that stack, and it makes
// the recording a property of the input rather than of the laptop.
const EMBEDDED_FAMILY = 'Architects Daughter';
const SYSTEM_STACK =
  '"Chalkboard SE", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';

const fontStack = raw.systemFont
  ? SYSTEM_STACK
  : `"${EMBEDDED_FAMILY}", cursive`;

const fontFace = raw.systemFont
  ? ''
  : `@font-face {
  font-family: "${EMBEDDED_FAMILY}";
  src: url(data:font/ttf;base64,${face}) format("truetype");
}
`;

const page = `<!doctype html>
<meta charset="utf-8">
<style>
${fontFace}:root {
  --ps-ink: ${palette.ink};
  --ps-pen: ${palette.pen};
  --ps-accent: ${palette.accent};
  --ps-muted: ${palette.muted};
  --ps-wash: ${palette.wash};
}
html, body { margin: 0; padding: 0; background: ${background}; }
svg { display: block; width: ${width}px; height: ${height}px; }
svg text {
  font-family: ${fontStack};
}
</style>
<svg id="diagram" viewBox="${config.viewBox.join(' ')}"></svg>
<script type="module">
import * as core from './core.js';
import * as animation from './animation.js';
window.__core = core;
window.__animation = animation;
</script>
`;

// Printable ASCII, the Latin-1 supplement, and the eight marks the subset was
// extended by: the two dashes, the four curly quotes, the ellipsis and the
// multiplication sign. That last one, U+00D7, is already inside the Latin-1
// range and is written out here only because that is how the subset was
// specified; it adds nothing the range had not already covered.
const MARKS = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x00d7,
]);
const covered = (code) =>
  (code >= 0x20 && code <= 0x7e) ||
  (code >= 0xa0 && code <= 0xff) ||
  MARKS.has(code);

/** Every string the diagram will draw, with somewhere to point at it. */
function* drawn(diagram) {
  for (const node of diagram.nodes ?? [])
    for (const [i, line] of (node.lines ?? []).entries())
      yield [line, `node "${node.id}" line ${i + 1}`];
  for (const [i, edge] of (diagram.edges ?? []).entries())
    if (edge.label) yield [edge.label, `edge ${i} label`];
  for (const [i, brace] of (diagram.braces ?? []).entries())
    for (const [n, line] of (brace.lines ?? []).entries())
      yield [line, `brace ${i} line ${n + 1}`];
  for (const [i, note] of (diagram.notes ?? []).entries())
    for (const [n, line] of (note.lines ?? []).entries())
      yield [line, `note ${i} line ${n + 1}`];
}

// A character the face has no glyph for draws nothing at all - not a box, not
// a fallback letterform, nothing - so the gap is invisible until somebody
// watches the video. Arrows and ticks are the ones that catch people out:
// none of them survived the subset and no subset could have added them.
//
// A warning rather than a failure, because the fault is cosmetic and
// `--system-font` may well cover it, and skipped entirely under that flag,
// where the question is about faces this process cannot see.
if (!raw.systemFont) {
  const seen = new Set();
  for (const [text, where] of drawn(config.diagram)) {
    for (const character of String(text)) {
      const code = character.codePointAt(0);
      const key = `${code} ${where}`;
      if (covered(code) || seen.has(key)) continue;
      seen.add(key);
      const point = code.toString(16).toUpperCase().padStart(4, '0');
      console.warn(
        `warn record: ${where} has U+${point} "${character}", which the ` +
          'embedded font draws as nothing',
      );
    }
  }
  if (seen.size > 0)
    console.warn(
      'warn record: those characters will be blank in the video; ' +
        '--system-font draws with the handwriting stack instead',
    );
}

// Rendering on the GPU moves antialiased pixels along near-vertical strokes
// from one launch to the next, which is enough to change a frame. The same
// two flags `tools/render-assets.mjs` and `tools/check-animation.mjs` pin,
// for the same reason.
const DETERMINISTIC = ['--disable-gpu', '--force-color-profile=srgb'];

let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', args: DETERMINISTIC });
} catch (error) {
  console.error(error.message);
  fail(
    'no local Google Chrome to drive - install it, or run ' +
      '`npx playwright-core install chrome` (`install chromium` fetches a ' +
      'Chrome for Testing build, which channel "chrome" never uses)',
  );
}

const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: scale,
  colorScheme: theme,
});
const shot = await context.newPage();
shot.on('pageerror', (error) => fail(`the page threw: ${error.message}`));
shot.on('console', (message) => {
  if (message.type() === 'error') fail(`the page logged: ${message.text()}`);
});

// The page and both bundles are answered from this process at a hostname that
// resolves nowhere: a file:// document has an opaque origin, and an opaque
// origin fails the CORS check every ES module import goes through. Nothing
// here touches the network, which is also why the font is inlined rather than
// linked.
const ORIGIN = 'https://pensketch.invalid';
const core = readFileSync(CORE, 'utf8');
const animation = readFileSync(ANIMATION, 'utf8');
await shot.route(`${ORIGIN}/**`, (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/')
    return route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: page,
    });
  if (path === '/core.js')
    return route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: core,
    });
  if (path === '/animation.js')
    return route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: animation,
    });
  return route.abort();
});

await shot.goto(`${ORIGIN}/`);
await shot.waitForFunction(() => Boolean(window.__animation));

// Runs in the page, so it reaches both packages through the globals the
// page's module script publishes, and closes over nothing in this file.
//
// `animate` after `draw`, which is load-bearing and documented on `animate`:
// `draw` removes every child of the element it fills, so a stylesheet put
// there first goes with them and the diagram simply appears. `order: true` is
// the other half - without it no element carries the `--ps-i` the rules read,
// and the diagram renders finished and still.
//
// Nothing is waited for afterwards. `draw` and `animate` are synchronous, so
// the count this hands back is the finished drawing, and the seek below is
// what settles the first frame - the same sequence `tools/check-animation.mjs`
// uses, where `document.getAnimations()` flushes the pending style change that
// created the animations it is asked for.
let painted;
try {
  painted = await shot.evaluate(
    (options) => {
      const svg = document.getElementById('diagram');
      window.__core.draw(svg, options.diagram, {
        seed: options.seed,
        label: options.label,
        order: true,
      });
      window.__animation.animate(svg, {
        duration: options.duration,
        stroke: options.stroke,
        easing: options.easing,
      });
      return svg.childElementCount;
    },
    {
      diagram: config.diagram,
      seed,
      label,
      duration,
      stroke,
      easing: raw.easing,
    },
  );
} catch (error) {
  // `draw` refuses a diagram it cannot draw - an edge naming a node that is
  // not there, an edge label with no coordinates to place it at - and says
  // exactly what is wrong. That sentence is the whole of what is useful here;
  // what Playwright wraps around it is a stack through a minified bundle at a
  // hostname that does not resolve.
  const said = error.message
    .split('\n')[0]
    .replace(/^(page\.evaluate: )?(Error: )?/, '');
  fail(`the diagram did not draw: ${said}`);
}
// One child is the stylesheet `animate` just inserted and nothing else, which
// is a diagram that drew nothing - an empty `nodes`, or a `diagram` whose
// contents were spelled something else. Recording it would take several
// hundred screenshots of an empty rectangle and say so nowhere.
if (painted < 2) fail(`${source} drew nothing - the diagram is empty`);

/**
 * Freezes every animation on the page at one instant. The technique is
 * `tools/check-animation.mjs`'s, unchanged: two frames are waited on so the
 * seek has reached the compositor before anything is shot.
 *
 * `currentTime` is in the animation's own time space, which begins at its
 * start time and *includes* its delay in the before-phase. Every element here
 * shares a start time and a duration and is staggered by `animation-delay`
 * alone, so one `t` applied to all of them is the page's global state at `t`
 * rather than an approximation of it.
 */
const seek = (target, ms) =>
  target.evaluate(async (at) => {
    for (const running of document.getAnimations()) {
      running.pause();
      running.currentTime = at;
    }
    await new Promise((frame) =>
      requestAnimationFrame(() => requestAnimationFrame(frame)),
    );
  }, ms);

const step = 1000 / fps;
const drawing = Math.ceil(duration / step);
// The still frames are seeks past the end rather than copies of the last
// drawn frame: fill-mode `both` holds the final state there, so what they
// show is provably the finished picture rather than whatever the last
// sampling instant happened to catch.
const held = Math.round(hold / step);
const total = drawing + held;

// A caller who asked where the frames go owns them and gets them wherever
// they said, existing directory or not. Everything else goes somewhere the
// exit handler above is willing to delete.
if (framesDir === undefined) {
  scratch = mkdtempSync(join(tmpdir(), 'pensketch-record-'));
} else {
  mkdirSync(framesDir, { recursive: true });
}
const dir = framesDir ?? scratch;

const progress = (done) => {
  const line = `frame ${done}/${total}`;
  if (process.stdout.isTTY) process.stdout.write(`\r${line}`);
  else if (done === total || done % 25 === 0) console.log(line);
};

console.log(
  `${frameWidth}x${frameHeight}, ${total} frames at ${fps}fps ` +
    `(${drawing} drawing, ${held} held)`,
);

// Every frame is a seek, never a wait. Capturing in real time takes whatever
// the machine happened to be doing - frames dropped while it is busy,
// duplicated when the shot outruns the timeline - so the same input would
// produce a different file on every run and on every machine, which is the
// one thing the tooling in this repository is for: re-running it on an
// unchanged input is a no-op.
//
// `animations: 'disabled'` is deliberately absent from the screenshot call,
// though `tools/render-assets.mjs` passes it. Playwright implements it by
// finishing every animation and holding it at its end state, which would make
// all of these frames the completed diagram - a video that is a still, and
// the exact failure this file is arranged to avoid.
for (let i = 0; i < total; i++) {
  // The drawing is sampled at the *end* of each interval, so the first frame
  // is one step in and the last is at `duration` exactly. Sampling from zero
  // instead spends a frame on the instant before anything has been drawn,
  // measured at 0 inked pixels of 1080x1080 - and every target this file
  // exists for uses a video's first frame as its poster image unless one is
  // uploaded, so that frame is not merely wasted but is the still that has to
  // earn the stop. It also never reached `duration`: at 10fps over 2000ms the
  // last drawn frame sat at 1900.
  await seek(shot, i < drawing ? (i + 1) * step : duration + hold);
  await shot.screenshot({
    path: join(dir, `frame-${String(i + 1).padStart(5, '0')}.png`),
  });
  progress(i + 1);
}
if (process.stdout.isTTY) process.stdout.write('\n');

await context.close();
await browser.close();

// Numbered from one, and five digits wide: ffmpeg's image2 demuxer begins at
// zero and probes a few numbers forward, so it finds either, and five digits
// is past any recording that would be made here - it runs out at 99999
// frames, which is over half an hour at 60fps.
const pattern = join(dir, 'frame-%05d.png');
const ENCODE = [
  '-c:v',
  'libx264',
  // Not optional, and the reason it is easy to leave out is that leaving it
  // out succeeds. Many players - QuickTime and several web players among them
  // - will not decode H.264 in the 4:4:4 or 4:2:2 pixel format ffmpeg picks
  // from PNG input, and show a black rectangle or refuse the file, while the
  // encode itself reports nothing wrong.
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '18',
  '-preset',
  'slow',
  // Moves the index to the front, so a player streaming the file can start
  // before it has all of it - which is what every one of the targets here
  // does with an upload.
  '-movflags',
  '+faststart',
];

if (framesDir !== undefined) {
  console.log(`wrote ${total} frames to ${framesDir}`);
  console.log(
    `to encode them: ffmpeg -framerate ${fps} -i ${pattern} ` +
      `${ENCODE.join(' ')} ${out}`,
  );
  process.exit(0);
}

// `-nostdin` so a failing ffmpeg cannot sit waiting on a terminal this file
// is also writing to, and `-y` because a recorder that refuses to overwrite
// its own previous take is a recorder nobody can iterate with.
const encode = await run(binary, [
  '-nostdin',
  '-loglevel',
  'error',
  '-y',
  '-framerate',
  String(fps),
  '-i',
  pattern,
  ...ENCODE,
  out,
]);
if (encode.error) noFfmpeg(encode.error);
if (encode.code !== 0)
  fail(`ffmpeg exited ${encode.code}:\n${encode.stderr.trim()}`);

const bytes = statSync(out).size;
console.log(
  `wrote ${out} (${frameWidth}x${frameHeight}, ` +
    `${(total / fps).toFixed(2)}s, ${bytes} bytes)`,
);
