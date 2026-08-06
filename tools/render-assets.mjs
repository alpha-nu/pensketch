import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';

// Renders the README hero images with the locally installed Google Chrome.
// The diagram below is the hero's own: coupling the marketing image to a
// parity fixture would let a fixture edit silently redraw the README.
//
// Run locally, never in CI: `node tools/render-assets.mjs`. The output is
// deterministic - seeded renderer, fixed viewport - so re-running it on an
// unchanged repository rewrites the same bytes.

const root = new URL('../', import.meta.url);
const bundle = new URL('packages/core/dist/index.js', root);
const assets = new URL('docs/assets/', root);

// The image is emitted at twice this, which is what makes it stay sharp on a
// retina display at its natural width.
const WIDTH = 880;
const HEIGHT = 300;
const SCALE = 2;

const SHOTS = [
  {
    file: 'hero-light.png',
    colorScheme: 'light',
    background: [0xff, 0xff, 0xff],
  },
  {
    file: 'hero-dark.png',
    colorScheme: 'dark',
    background: [0x16, 0x1b, 0x21],
  },
];

function fail(message) {
  console.error(`FAIL render-assets: ${message}`);
  process.exit(1);
}

if (!existsSync(bundle)) {
  fail('packages/core/dist/index.js is missing - run `npm run build`');
}

// A hostname that resolves nowhere: every request the page makes is answered
// from this process, so the render never touches the network.
const ORIGIN = 'https://pensketch.invalid';
const ENTRY = 'index.js';

// The page loads core from the built bundle rather than from source, so the
// image shows what the published package draws.
const core = readFileSync(bundle, 'utf8');

// A4 from the documentation, plus the flat background the corners are
// checked against and the handwriting stack the aesthetic depends on.
const PAGE = `<!doctype html>
<meta charset="utf-8">
<style>
:root {
  --ps-ink: #232B36;
  --ps-pen: #2B5B8A;
  --ps-accent: #B3402E;
  --ps-muted: #5A6572;
  --ps-wash: rgba(43, 91, 138, .05);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ps-ink: #D9DFE7;
    --ps-pen: #7FA9DB;
    --ps-accent: #DB8570;
    --ps-muted: #93A0AD;
    --ps-wash: rgba(127, 169, 219, .07);
  }
}
html, body { margin: 0; padding: 0; background: #FFFFFF; }
@media (prefers-color-scheme: dark) {
  html, body { background: #161B21; }
}
svg { display: block; width: ${WIDTH}px; height: ${HEIGHT}px; }
svg text {
  font-family: "Chalkboard SE", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive;
}
</style>
<svg id="hero" viewBox="0 0 ${WIDTH} ${HEIGHT}"></svg>
<script type="module">
import * as pensketch from './${ENTRY}';
window.__pensketch = pensketch;
</script>
`;

// Runs in the page, so it reaches core through the global the page's module
// script publishes. Nothing here closes over this file's scope.
function drawHero() {
  const PEN = 'var(--ps-pen, #2B5B8A)';
  const MUTED = 'var(--ps-muted, #5A6572)';

  window.__pensketch.draw(
    document.getElementById('hero'),
    {
      nodes: [
        {
          id: 'g',
          shape: 'group',
          x: 30,
          y: 30,
          w: 620,
          h: 240,
          lines: ['a diagram, from plain data'],
        },
        {
          id: 'in',
          shape: 'pill',
          x: 60,
          y: 95,
          w: 150,
          h: 52,
          lines: ['request'],
        },
        {
          id: 'gate',
          shape: 'diamond',
          x: 270,
          y: 85,
          w: 150,
          h: 76,
          lines: ['cached?'],
          size: 13,
        },
        {
          id: 'work',
          shape: 'box',
          x: 480,
          y: 95,
          w: 150,
          h: 52,
          lines: ['render'],
          accent: true,
        },
        {
          id: 'store',
          shape: 'box',
          x: 270,
          y: 200,
          w: 150,
          h: 52,
          lines: ['cache'],
          hatch: true,
        },
      ],
      edges: [
        { from: ['in', 'r'], to: ['gate', 'l'] },
        {
          from: ['gate', 'r'],
          to: ['work', 'l'],
          label: 'miss',
          lx: 450,
          ly: 110,
        },
        {
          from: ['gate', 'b'],
          to: ['store', 't'],
          dotted: true,
          label: 'hit',
          lx: 352,
          ly: 186,
          anchor: 'start',
        },
        {
          from: ['store', 'l'],
          to: ['in', 'b'],
          via: [[135, 226]],
        },
      ],
      notes: [
        {
          x: 690,
          y: 95,
          lines: ['same seed,', 'same bytes'],
          anchor: 'start',
          arrowFrom: [700, 122],
          via: [[672, 152]],
          arrowTo: [636, 128],
        },
      ],
      raw: [
        (p) => {
          p.stroke(
            [
              [690, 190],
              [828, 192],
            ],
            { color: PEN, width: 1.2, amplitude: 1.6 },
          );
          p.label(690, 218, ['tiny, seeded,', 'zero dependencies'], {
            size: 13,
            anchor: 'start',
            color: MUTED,
          });
        },
      ],
    },
    { seed: 7, label: 'A hand-sketched request flow drawn by pensketch' },
  );
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// A PNG reader that goes no further than these images need: 8-bit truecolor,
// with or without alpha, uninterlaced - which is what Chrome writes. Reading
// the file back is the point: verifying the corners in the page would test
// the DOM rather than the bytes that land in the repository.
function readPng(bytes) {
  const signature = '\x89PNG\r\n\x1a\n';
  if (bytes.toString('latin1', 0, 8) !== signature) fail('not a PNG');

  let offset = 8;
  let header;
  const parts = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    }
    if (type === 'IDAT') parts.push(data);
    offset += 12 + length;
  }

  if (!header) fail('the PNG has no IHDR chunk');
  if (header.depth !== 8 || header.interlace !== 0) {
    fail(
      `unsupported PNG: depth ${header.depth}, interlace ${header.interlace}`,
    );
  }
  const channels = header.colorType === 6 ? 4 : header.colorType === 2 ? 3 : 0;
  if (channels === 0) fail(`unsupported PNG color type ${header.colorType}`);

  const raw = inflateSync(Buffer.concat(parts));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(header.height * stride);
  let source = 0;
  // Every scanline is reconstructed, not just the ones the corners sit on:
  // each filter type refers back to the line above it.
  for (let y = 0; y < header.height; y++) {
    const filter = raw[source++];
    const line = raw.subarray(source, source + stride);
    source += stride;
    const from = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[from + i - channels] : 0;
      const up = y > 0 ? pixels[from - stride + i] : 0;
      const upLeft =
        y > 0 && i >= channels ? pixels[from - stride + i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) fail(`unknown PNG filter ${filter} on row ${y}`);
      pixels[from + i] = value & 0xff;
    }
  }

  const at = (x, y) => {
    const i = y * stride + x * channels;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  return { width: header.width, height: header.height, at };
}

function verify(file, bytes, background) {
  const png = readPng(bytes);
  const expected = `${WIDTH * SCALE}x${HEIGHT * SCALE}`;
  const actual = `${png.width}x${png.height}`;
  if (actual !== expected) fail(`${file} is ${actual}, expected ${expected}`);

  const corners = [
    ['top left', 0, 0],
    ['top right', png.width - 1, 0],
    ['bottom left', 0, png.height - 1],
    ['bottom right', png.width - 1, png.height - 1],
  ];
  const want = background.join(',');
  for (const [name, x, y] of corners) {
    const got = png.at(x, y);
    if (got.join(',') !== want) {
      fail(`${file} ${name} pixel is rgb(${got}), expected rgb(${background})`);
    }
  }
  console.log(`wrote ${file} (${actual}, corners rgb(${background}))`);
}

// Rendering on the GPU moves a handful of antialiased pixels along near
// vertical strokes from one launch to the next, which is enough to change the
// file. Software rasterization draws the same picture the same way every
// time, and pinning the color profile keeps the display's own out of it - so
// re-rendering an unchanged repository is a no-op.
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

mkdirSync(assets, { recursive: true });

for (const { file, colorScheme, background } of SHOTS) {
  // A context per scheme: the color scheme is emulated per context, and the
  // device scale factor has to be set when the context is created.
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => fail(`the page threw: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') fail(`the page logged: ${message.text()}`);
  });
  // The page and the bundle are answered from memory at a stub origin rather
  // than opened from disk: a file:// document has an opaque origin, and an
  // opaque origin fails the CORS check every ES module import goes through.
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: PAGE,
      });
    }
    if (path === `/${ENTRY}`) {
      return route.fulfill({
        contentType: 'text/javascript; charset=utf-8',
        body: core,
      });
    }
    return route.abort();
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => Boolean(window.__pensketch));
  await page.evaluate(drawHero);
  await page.waitForFunction(
    () => document.getElementById('hero').childElementCount > 0,
  );
  // No `scale: 'css'`: it would resample the shot back down to CSS pixels
  // and quietly undo the 2x this image exists for.
  const bytes = await page.screenshot({ animations: 'disabled' });
  const out = new URL(file, assets);
  writeFileSync(out, bytes);
  verify(file, bytes, background);
  await context.close();
}

await browser.close();
