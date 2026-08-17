import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { HERO } from './hero-diagram.mjs';
import { shippedDiagrams } from './shipped-diagrams.mjs';

// Renders the README images with the locally installed Google Chrome: the hero
// at the top, and the architecture overview below it.
// The diagram is the hero's own rather than a parity fixture: coupling the
// marketing image to a fixture would let a fixture edit silently redraw the
// README. It lives in hero-diagram.mjs because the checker reads it too.
//
// Run locally, never in CI: `node tools/render-assets.mjs`. The output is
// deterministic - seeded renderer, fixed viewport - so re-running it on an
// unchanged repository rewrites the same bytes.

const root = new URL('../', import.meta.url);
const bundle = new URL('packages/core/dist/index.js', root);
const assets = new URL('docs/assets/', root);

// Each image is emitted at twice its natural width, which is what keeps it
// sharp on a retina display.
const SCALE = 2;

const SCHEMES = [
  { colorScheme: 'light', background: [0xff, 0xff, 0xff] },
  { colorScheme: 'dark', background: [0x16, 0x1b, 0x21] },
];

// The showcase is loaded from the example itself rather than copied here, so
// the README's architecture overview cannot drift from the page that draws it -
// the same loader the checker uses reads the same file.
const SHOWCASE = (await shippedDiagrams()).find((d) => d.key === 'showcase');
if (!SHOWCASE) fail('examples/showcase is not in shipped-diagrams.mjs');

const TARGETS = [
  { id: 'hero', width: 880, height: 300, name: 'hero' },
  {
    id: 'showcase',
    // The frame the example's own `<svg>` declares, so the overview is the
    // diagram at its intended proportions rather than a crop of it.
    width: SHOWCASE.viewBox[2],
    height: SHOWCASE.viewBox[3],
    name: 'showcase',
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
const pageFor = ({ id, width, height }) => `<!doctype html>
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
svg { display: block; width: ${width}px; height: ${height}px; }
svg text {
  font-family: "Chalkboard SE", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive;
}
</style>
<svg id="${id}" viewBox="0 0 ${width} ${height}"></svg>
<script type="module">
import * as pensketch from './${ENTRY}';
window.__pensketch = pensketch;
</script>
`;

// The showcase carries no `raw`, so it crosses to the page as JSON whole - the
// property that lets it be served as a resource is the same one that lets it
// be drawn here without a callback.
function drawShowcase(diagram) {
  window.__pensketch.draw(document.getElementById('showcase'), diagram, {
    seed: 7,
    label:
      "The architecture of pensketch: what draws a diagram and what makes it draw itself, core's four entry points, the renderer and the checker",
  });
}

// Runs in the page, so it reaches core through the global the page's module
// script publishes. Nothing here closes over this file's scope - the diagram
// arrives as an argument, which is why only its data half can live in
// hero-diagram.mjs: page arguments cross as JSON, and `raw` holds functions.
function drawHero(diagram) {
  const PEN = 'var(--ps-pen, #2B5B8A)';
  const MUTED = 'var(--ps-muted, #5A6572)';

  window.__pensketch.draw(
    document.getElementById('hero'),
    {
      ...diagram,
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

function verify(file, bytes, background, width, height) {
  const png = readPng(bytes);
  const expected = `${width * SCALE}x${height * SCALE}`;
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

for (const target of TARGETS) {
  for (const { colorScheme, background } of SCHEMES) {
    const file = `${target.name}-${colorScheme}.png`;
    // A context per scheme: the color scheme is emulated per context, and the
    // device scale factor has to be set when the context is created.
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      deviceScaleFactor: SCALE,
      colorScheme,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => fail(`the page threw: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error')
        fail(`the page logged: ${message.text()}`);
    });
    // The page and the bundle are answered from memory at a stub origin rather
    // than opened from disk: a file:// document has an opaque origin, and an
    // opaque origin fails the CORS check every ES module import goes through.
    await page.route(`${ORIGIN}/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') {
        return route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: pageFor(target),
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
    if (target.id === 'hero') await page.evaluate(drawHero, HERO);
    else await page.evaluate(drawShowcase, SHOWCASE.diagram);
    await page.waitForFunction(
      (id) => document.getElementById(id).childElementCount > 0,
      target.id,
    );
    // No `scale: 'css'`: it would resample the shot back down to CSS pixels
    // and quietly undo the 2x this image exists for.
    const bytes = await page.screenshot({ animations: 'disabled' });
    const out = new URL(file, assets);
    writeFileSync(out, bytes);
    verify(file, bytes, background, target.width, target.height);
    await context.close();
  }
}

await browser.close();
