import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

// What `@pensketch/animation` does can only be seen by a browser. jsdom
// computes no `@scope`, runs no animation and resolves no `var()`, so the
// suite can prove the stylesheet's shape and nothing about its effect. These
// ten checks are the other half: the built package, driven by the locally
// installed Google Chrome, measured rather than looked at.
//
// `npm run animation`, locally and in CI both. It drives the same Chrome
// `tools/render-assets.mjs` does, with the same flags, and fails the same way
// when there is none. Unlike that one it writes nothing into the repository -
// its only output is this report and an exit code - which is what makes it a
// gate rather than a tool somebody remembers to run.
//
// Every check reads the built bundles under `packages/*/dist`, because what a
// consumer installs is what has to animate.

const root = new URL('../', import.meta.url);
const CORE = new URL('packages/core/dist/index.js', root);
const SERVER = new URL('packages/core/dist/server.js', root);
const ANIMATION = new URL('packages/animation/dist/index.js', root);

function fail(message) {
  console.error(`FAIL check-animation: ${message}`);
  process.exit(1);
}

for (const bundle of [CORE, SERVER, ANIMATION]) {
  if (!existsSync(bundle)) {
    const name = bundle.pathname.slice(root.pathname.length);
    fail(`${name} is missing - run \`npm run build\``);
  }
}

// The built package, imported rather than re-implemented: `animateMarkup` is
// what a caller holding markup uses, and check 9 is about exactly that string.
const { animateMarkup } = await import(ANIMATION.href);
const { renderToString } = await import(SERVER.href);

// One diagram carrying everything the stylesheet tells apart: solid strokes,
// a dotted connector - which the renderer leaves `pathLength` off and this
// package must fade rather than draw - and text. Two nodes far enough apart
// that the corridor between them holds nothing but the connector, which is
// what lets a region of the screenshot answer "has the first connector
// started".
const VIEW = { width: 520, height: 200 };
const SEED = 7;
const FLOW = {
  nodes: [
    {
      id: 'in',
      shape: 'pill',
      x: 40,
      y: 50,
      w: 160,
      h: 50,
      lines: ['request'],
    },
    {
      id: 'work',
      shape: 'box',
      x: 300,
      y: 50,
      w: 180,
      h: 50,
      lines: ['do the work'],
    },
  ],
  edges: [
    { from: ['in', 'r'], to: ['work', 'l'] },
    {
      from: ['work', 'b'],
      to: ['in', 'b'],
      via: [
        [390, 140],
        [120, 140],
      ],
      dotted: true,
    },
  ],
};

// Between the two nodes and clear of both, in the diagram's own user units -
// which are screenshot pixels, the `<svg>` being drawn at its viewBox size.
// The solid connector is the only thing that ever inks here.
const CORRIDOR = { x: 210, y: 60, width: 80, height: 30 };

// How long the drawing takes in the checks that sample it. Long enough that
// the elements are spread out in time, short enough that waiting for the end
// costs nothing.
const DUR = 4000;

const ORIGIN = 'https://pensketch.invalid';
const core = readFileSync(CORE, 'utf8');
const animation = readFileSync(ANIMATION, 'utf8');

const pageFor = (body) => `<!doctype html>
<meta charset="utf-8">
<style>
html, body { margin: 0; padding: 0; background: #FFFFFF; }
svg { display: block; }
svg text {
  font-family: "Chalkboard SE", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive;
}
</style>
${body}
<script type="module">
import * as core from './core.js';
import * as animation from './animation.js';
window.__core = core;
window.__animation = animation;
</script>
`;

// The svg the diagram is drawn into, at its viewBox size so that one user
// unit is one CSS pixel and a region of the fixture is a region of the shot.
const svgTag = (id) =>
  `<svg id="${id}" viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="${VIEW.width}" height="${VIEW.height}"></svg>`;

// Rendering on the GPU moves antialiased pixels from one launch to the next,
// which is enough to change a pixel count. The same two flags
// `tools/render-assets.mjs` pins, for the same reason.
//
// No `--no-sandbox`, deliberately. It is the usual reflex for Chrome in CI and
// it is not needed here: the sandbox only fails for a root user, and a
// GitHub-hosted job runs as `runner`. Adding it would turn off a protection
// against pages this tool builds itself, to fix a failure nobody has seen.
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

/** A page at the stub origin, with core and animation already loaded. */
async function open({ body, viewport = VIEW, reducedMotion }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => fail(`the page threw: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') fail(`the page logged: ${message.text()}`);
  });
  // Answered from this process at a hostname that resolves nowhere, so the
  // check never touches the network and a `file://` document's opaque origin
  // never breaks the module imports.
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/')
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: pageFor(body),
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
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => Boolean(window.__animation));
  return { context, page };
}

/**
 * Draws, and animates unless told not to. Runs in the page.
 *
 * `drop` puts the same rules there behind an at-rule no engine knows, which
 * is what an engine that does not understand `@scope` does with the block:
 * consumes it and discards it whole. It is the only way to see that
 * degradation from a browser that does understand `@scope`.
 */
const paint = (
  page,
  { id, diagram, order = true, animate = true, duration, drop = false },
) =>
  page.evaluate(
    ([target, data, seed, withOrder, withAnimation, ms, dropped]) => {
      const svg = document.getElementById(target);
      window.__core.draw(svg, data, { seed, order: withOrder });
      if (dropped) {
        const style = svg.ownerDocument.createElementNS(
          'http://www.w3.org/2000/svg',
          'style',
        );
        style.textContent = window.__animation.rules.replace(
          '@scope{',
          '@pensketch-no-such-at-rule{',
        );
        svg.insertBefore(style, svg.firstChild);
        return;
      }
      if (withAnimation) window.__animation.animate(svg, { duration: ms });
    },
    [id, diagram, SEED, order, animate, duration ?? DUR, drop],
  );

/**
 * Every computed property of every drawn element, less the ones that are not
 * about the picture: the `animation` longhands the stylesheet exists to set,
 * and every `--ps-` property - the timing it reads and the `--ps-i` the
 * renderer stamps, which is absent by construction in the variants drawn
 * without `order`. One prefix covers both, which is the point of the prefix.
 * What is left is everything that paints, so two of these being equal is "the
 * stylesheet is not touching this element".
 */
const painted = (page, id) =>
  page.evaluate((target) => {
    const svg = document.getElementById(target);
    return Array.from(svg.children)
      .filter((el) => el.tagName !== 'style')
      .map((el) => {
        const computed = getComputedStyle(el);
        const out = {};
        for (const name of computed) {
          if (name.startsWith('animation-') || name.startsWith('--ps-'))
            continue;
          out[name] = computed.getPropertyValue(name);
        }
        return out;
      });
  }, id);

/**
 * Freezes every animation on the page at one instant. The harness does this,
 * never the package: what is being measured is the state the browser computes
 * at time `ms`, and a screenshot of a running animation is a state nobody
 * chose. Two frames are waited on so the seek has reached the compositor
 * before anything is read or shot.
 */
const seek = (page, ms) =>
  page.evaluate(async (at) => {
    for (const running of document.getAnimations()) {
      running.pause();
      running.currentTime = at;
    }
    await new Promise((frame) =>
      requestAnimationFrame(() => requestAnimationFrame(frame)),
    );
  }, ms);

/** Every drawn element of an svg, with what the browser resolved for it. */
const probe = (page, id) =>
  page.evaluate((target) => {
    const svg = document.getElementById(target);
    return Array.from(svg.children).map((el) => {
      const computed = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        i: el.style.getPropertyValue('--ps-i'),
        dashAttr: el.getAttribute('stroke-dasharray'),
        opacityAttr: el.getAttribute('opacity'),
        name: computed.animationName,
        delay: computed.animationDelay,
        duration: computed.animationDuration,
        dash: computed.strokeDasharray,
        offset: computed.strokeDashoffset,
        strokeOpacity: computed.strokeOpacity,
        opacity: computed.opacity,
        rect: [box.x, box.y, box.width, box.height],
      };
    });
  }, id);

/**
 * How far along an element is, on whichever channel its own keyframes move:
 * 0 is untouched by the drawing, 1 is finished. Read off the computed style
 * rather than off the animation object, because the computed style is what
 * the pixels come from.
 */
const drawnness = (el) => {
  if (el.name === 'ps-draw') return 1 - Number.parseFloat(el.offset);
  if (el.name === 'ps-fade') return Number.parseFloat(el.strokeOpacity);
  if (el.name === 'ps-write') return Number.parseFloat(el.opacity);
  return null;
};

// A page of its own whose only job is to turn screenshot bytes back into
// pixels. Chrome decodes its own PNGs, so nothing here hand-rolls an inflate
// and a Paeth filter to compare two images the browser already understands.
const meter = await browser.newPage();
await meter.goto('about:blank');

// Published into the meter page once, so the two readings below share one
// decoder without either of them shipping its source across as a string.
await meter.evaluate(() => {
  window.__load = async (b64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    };
  };
});

/** How many pixels of a shot are not the flat white the page is painted on. */
const inked = (shot, rect) =>
  meter.evaluate(
    async ([b64, area]) => {
      const { width, height, data } = await window.__load(b64);
      const box = area ?? { x: 0, y: 0, width, height };
      let count = 0;
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let x = box.x; x < box.x + box.width; x++) {
          const at = (y * width + x) * 4;
          if (data[at] !== 255 || data[at + 1] !== 255 || data[at + 2] !== 255)
            count++;
        }
      }
      return count;
    },
    [shot.toString('base64'), rect ?? null],
  );

/**
 * How many pixels two shots disagree on, and by how much on the worst
 * channel. A count of zero is "pixel-identical"; the depth is what tells a
 * stroke that is missing from one of them apart from a stroke that is drawn
 * in both and antialiased a shade differently.
 */
const differing = (a, b) =>
  meter.evaluate(
    async ([one, two]) => {
      const left = await window.__load(one);
      const right = await window.__load(two);
      if (left.width !== right.width || left.height !== right.height)
        return { count: -1, worst: -1 };
      let count = 0;
      let worst = 0;
      for (let at = 0; at < left.data.length; at += 4) {
        let depth = 0;
        for (let channel = 0; channel < 4; channel++)
          depth = Math.max(
            depth,
            Math.abs(left.data[at + channel] - right.data[at + channel]),
          );
        if (depth) {
          count++;
          worst = Math.max(worst, depth);
        }
      }
      return { count, worst };
    },
    [a.toString('base64'), b.toString('base64')],
  );

const results = [];
const check = async (number, title, body) => {
  const found = [];
  const want = (ok, detail) => {
    if (!ok) found.push(detail);
  };
  const note = await body(want);
  results.push({ number, title, failures: found, note });
};

// 1. Sampled part-way through, some elements are drawn and some are not - and
//    the whole of it is over by the time the caller asked for.
await check(1, 'a diagram sampled mid-draw is mid-draw', async (want) => {
  const { context, page } = await open({ body: svgTag('flow') });
  await paint(page, { id: 'flow', diagram: FLOW });
  await seek(page, DUR / 2);
  const drawn = (await probe(page, 'flow')).filter((el) => el.name !== 'none');
  const done = drawn.filter((el) => drawnness(el) > 0.999).length;
  const waiting = drawn.filter((el) => drawnness(el) < 0.001).length;
  want(drawn.length > 0, 'nothing on the page is animating at all');
  want(done > 0, 'no element had finished half way through');
  want(waiting > 0, 'no element was still waiting half way through');
  // `duration` is the whole drawing, first stroke to last, and that is what the
  // stylesheet subtracts a stroke's length off the stagger's span for: the last
  // element has to *start* early enough to *finish* on time. Nothing else here
  // holds that subtraction. With it removed the last stroke moved from 3.206s
  // to 3.664s and the drawing ended at 4.332s for the 4s asked for, while every
  // unit test and every other check on this page stayed green - and
  // `examples/react` passes `STEP_MS - 400` precisely so the drawing fits
  // inside a step, so an overrun there interrupts every step part-drawn.
  //
  // Read off the computed longhands rather than off the rules, because what has
  // to end on time is what the browser resolved.
  const ends = drawn.map(
    (el) => Number.parseFloat(el.delay) + Number.parseFloat(el.duration),
  );
  const over = Math.max(...ends);
  want(
    over <= DUR / 1000,
    `the last element finishes at ${over}s for a ${DUR / 1000}s drawing`,
  );
  await context.close();
  return `${done} finished, ${waiting} not started, ${drawn.length - done - waiting} in flight, of ${drawn.length}; last one ends at ${over}s of ${DUR / 1000}s`;
});

// 2. A neighbour on the same page is untouched. Two of them: the SVG the
//    requirement names, and a second pensketch diagram that was drawn with
//    `order: true` and deliberately not animated - which is the neighbour
//    that can tell whether the rules escaped, because it is the only kind
//    that carries the `--ps-i` an escaped rule would need.
await check(2, 'a neighbouring drawing is untouched', async (want) => {
  const { context, page } = await open({
    viewport: { width: VIEW.width, height: VIEW.height * 2 + 80 },
    body: `${svgTag('flow')}
<svg id="foreign" width="${VIEW.width}" height="80" viewBox="0 0 ${VIEW.width} 80">
  <path id="foreign-path" d="M10 40 L500 40" fill="none" stroke="#232B36" stroke-width="2" stroke-dasharray="4 6" opacity="0.6" stroke-opacity="0.55"/>
</svg>
${svgTag('still')}`,
  });
  await paint(page, { id: 'flow', diagram: FLOW });
  await paint(page, { id: 'still', diagram: FLOW, animate: false });
  await seek(page, DUR / 2);

  const foreign = await page.evaluate(() => {
    const el = document.getElementById('foreign-path');
    const computed = getComputedStyle(el);
    return {
      name: computed.animationName,
      dash: computed.strokeDasharray,
      offset: computed.strokeDashoffset,
      opacity: computed.opacity,
      strokeOpacity: computed.strokeOpacity,
    };
  });
  want(
    foreign.name === 'none',
    `the foreign svg's path is running "${foreign.name}"`,
  );
  want(
    foreign.dash === '4px, 6px',
    `the foreign svg's dash pattern is ${foreign.dash}, not 4px, 6px`,
  );
  want(
    foreign.offset === '0px',
    `the foreign svg's dash offset is ${foreign.offset}, not 0px`,
  );
  want(
    foreign.opacity === '0.6' && foreign.strokeOpacity === '0.55',
    `the foreign svg's opacity is ${foreign.opacity}/${foreign.strokeOpacity}, not 0.6/0.55`,
  );

  const still = (await probe(page, 'still')).filter((el) => el.tag !== 'style');
  const running = still.filter((el) => el.name !== 'none');
  const dashed = still.filter(
    (el) => el.dashAttr === null && el.dash !== 'none',
  );
  const offset = still.filter((el) => Number.parseFloat(el.offset) !== 0);
  // The fixture first, because the three assertions below all pass over an
  // empty set, and a second diagram that drew nothing would satisfy every one
  // of them while proving nothing at all.
  want(
    still.length > 0,
    'the second diagram drew nothing, so the three checks below prove nothing',
  );
  want(
    running.length === 0,
    `${running.length} of ${still.length} elements of the un-animated diagram are running "${running[0]?.name}"`,
  );
  want(
    dashed.length === 0,
    `${dashed.length} of ${still.length} elements of the un-animated diagram were given a dash pattern (${dashed[0]?.dash})`,
  );
  want(
    offset.length === 0,
    `${offset.length} of ${still.length} elements of the un-animated diagram were given a dash offset (${offset[0]?.offset})`,
  );
  await context.close();
  return `foreign path ${foreign.dash} at opacity ${foreign.opacity}/${foreign.strokeOpacity}, animation ${foreign.name}; ${still.length} elements of the un-animated diagram untouched`;
});

// 3. A dashed stroke keeps its dashes throughout - and a solid one gives its
//    own back when it finishes, which is what the 99% keyframe is for.
await check(3, 'dashed strokes keep their dashes', async (want) => {
  const { context, page } = await open({ body: svgTag('flow') });
  await paint(page, { id: 'flow', diagram: FLOW });
  const seen = [];
  for (const [when, at] of [
    ['start', 0],
    ['mid', DUR / 2],
    ['end', DUR + 1000],
  ]) {
    await seek(page, at);
    const all = (await probe(page, 'flow')).filter((el) => el.tag === 'path');
    const dotted = all.filter((el) => el.dashAttr !== null);
    const solid = all.filter((el) => el.dashAttr === null);
    want(
      dotted.length > 0,
      'the fixture has no dashed path, so this proves nothing',
    );
    const wrong = dotted.filter((el) => el.dash !== '2px, 7px');
    want(
      wrong.length === 0,
      `at ${when} ${wrong.length} of ${dotted.length} dashed paths read ${wrong[0]?.dash} rather than the 2px, 7px the pen emitted`,
    );
    if (when === 'end') {
      // The implicit `to` keyframe is the element's own value, and the
      // element's own value is no dash at all. A finished element is one this
      // stylesheet is no longer touching.
      const held = solid.filter((el) => el.dash !== 'none');
      want(
        held.length === 0,
        `${held.length} of ${solid.length} finished solid paths are still dashed (${held[0]?.dash})`,
      );
    }
    seen.push(`${when} ${dotted[0]?.dash}`);
  }
  await context.close();
  return `dotted connector at ${seen.join(', ')}; every solid path back to dasharray none at the end`;
});

// 4. The pen's two passes are a dark one and a lighter one, carried in an
//    `opacity` attribute. A CSS `opacity` would beat it and flatten them.
await check(4, "the pen's two-pass opacity survives", async (want) => {
  const { context, page } = await open({ body: svgTag('flow') });
  await paint(page, { id: 'flow', diagram: FLOW });
  const seen = [];
  for (const [when, at] of [
    ['mid', DUR / 2],
    ['end', DUR + 1000],
  ]) {
    await seek(page, at);
    const paths = (await probe(page, 'flow')).filter((el) => el.tag === 'path');
    const passes = [...new Set(paths.map((el) => el.opacity))].sort();
    want(
      passes.includes('0.92') && passes.includes('0.5'),
      `at ${when} the passes computed to ${passes.join('/')} rather than both 0.5 and 0.92`,
    );
    // Presence is not enough: a rule that put every path on the same opacity
    // would leave both numbers on the page and still have flattened the pen's
    // weighting. What is asserted is that each path computes to the opacity
    // the pen wrote on it, which is what a CSS `opacity` would take away.
    const flattened = paths.filter(
      (el) => el.opacityAttr !== null && el.opacity !== el.opacityAttr,
    );
    want(
      flattened.length === 0,
      `at ${when} ${flattened.length} of ${paths.length} paths compute to an opacity of ${flattened[0]?.opacity} over the pen's own ${flattened[0]?.opacityAttr}`,
    );
    seen.push(`${when} ${passes.join('/')}`);
  }
  await context.close();
  return `computed opacities ${seen.join(', ')}`;
});

// 5. Hand order: every node shape before the first connector. The shapes are
//    told apart from the connectors by where they are - a shape's box sits
//    inside the node it outlines, a connector's does not - so nothing here
//    trusts the renderer's own account of what it stamped.
await check(
  5,
  'every node shape is drawn before the first connector',
  async (want) => {
    const { context, page } = await open({ body: svgTag('flow') });
    await paint(page, { id: 'flow', diagram: FLOW });
    await seek(page, 0);
    const all = (await probe(page, 'flow')).filter((el) => el.tag === 'path');
    // Four pixels of slack: the pen's amplitude carries a stroke a little past
    // the box it draws, and an arrowhead barb starts five pixels clear of the
    // node it points at. Measured, both margins are over two pixels.
    const SLACK = 4;
    const inside = (rect) =>
      FLOW.nodes.some(
        (node) =>
          rect[0] >= node.x - SLACK &&
          rect[1] >= node.y - SLACK &&
          rect[0] + rect[2] <= node.x + node.w + SLACK &&
          rect[1] + rect[3] <= node.y + node.h + SLACK,
      );
    const shapes = all.filter((el) => inside(el.rect));
    const connectors = all.filter((el) => !inside(el.rect));
    // The counts are asserted so that a misclassification fails loudly rather
    // than weakening the comparison below: two node outlines at two passes each
    // - the box drawn side by side - against two connectors and their barbs.
    //
    // Both numbers are pen facts, not animation facts. 10 is how many path
    // elements the pen lays down for a pill and a box at two passes each, and
    // 12 is a straight connector and a three-leg dotted one with their
    // arrowheads. Change how many passes the pen makes, or how an arrowhead's
    // barbs are emitted, and this animation gate goes red for a reason that has
    // nothing to do with animation. That is the trade taken deliberately - the
    // classifier is geometric, so a silent misclassification would weaken every
    // assertion below it without failing - but the message a future reader gets
    // is "expected 10 and 12", so what they are pinned to is written here: read
    // the new counts off the pen and update them, do not loosen the check.
    want(
      shapes.length === 10 && connectors.length === 12,
      `classified ${shapes.length} node-shape paths and ${connectors.length} connector paths, expected 10 and 12 - both are pen facts (pass count, arrowhead geometry), so a pen change lands here`,
    );
    const last = Math.max(...shapes.map((el) => Number.parseFloat(el.delay)));
    const first = Math.min(
      ...connectors.map((el) => Number.parseFloat(el.delay)),
    );
    want(
      last < first,
      `the last node shape starts at ${last}s, the first connector at ${first}s`,
    );
    // Not the same claim in pixels - this one cannot corroborate the ordering,
    // because it samples just before the first connector's *own* start and an
    // element has drawn nothing before it starts whatever the order is. What it
    // proves is the other half: that the delay is real ink rather than a number
    // in a computed style, which is what fails when the stagger is lost.
    await seek(page, first * 1000 - 10);
    const before = await inked(await page.screenshot(), CORRIDOR);
    await seek(page, DUR + 1000);
    const after = await inked(await page.screenshot(), CORRIDOR);
    want(
      before === 0 && after > 0,
      `the corridor between the nodes held ${before} inked px before the first connector started and ${after} at the end`,
    );
    // And once more inside the connector's own window, which is the only sample
    // in these ten checks that falls there. Half way through drawing itself a
    // stroke must be part inked: more than nothing, less than the whole.
    //
    // This is the only reading that holds the `stroke-dasharray` channel.
    // `drawnness` reads `stroke-dashoffset` alone, and dropping
    // `stroke-dasharray:1` from the 99% keyframe leaves every offset
    // byte-identical while the stroke pops fully inked at 34.25% of its window -
    // where `ease-out` crosses 0.5 and the discrete dasharray flips to the
    // `none` the element itself carries. Every unit test and every other check
    // here stayed green through that. Measured: 151 inked px half way with the
    // keyframe, 211 - the finished stroke - without it.
    const opening = connectors.reduce((one, other) =>
      Number.parseFloat(one.delay) <= Number.parseFloat(other.delay)
        ? one
        : other,
    );
    const strokeWindow = Number.parseFloat(opening.duration);
    await seek(page, (first + strokeWindow / 2) * 1000);
    const half = await inked(await page.screenshot(), CORRIDOR);
    want(
      half > 0 && half < after,
      `half way through the first connector's own ${strokeWindow}s window the corridor held ${half} inked px, against ${before} before it started and ${after} finished`,
    );
    await context.close();
    return `last shape at ${last}s, first connector at ${first}s; corridor ${before} inked px before it, ${half} half way through its own window, ${after} after`;
  },
);

// 6. All text comes last.
await check(6, 'all text comes last', async (want) => {
  const { context, page } = await open({ body: svgTag('flow') });
  await paint(page, { id: 'flow', diagram: FLOW });
  await seek(page, 0);
  const all = (await probe(page, 'flow')).filter((el) => el.name !== 'none');
  const text = all.filter((el) => el.tag === 'text');
  const rest = all.filter((el) => el.tag !== 'text');
  want(text.length > 0, 'the fixture drew no text, so this proves nothing');
  const first = Math.min(...text.map((el) => Number.parseFloat(el.delay)));
  const last = Math.max(...rest.map((el) => Number.parseFloat(el.delay)));
  want(
    last < first,
    `the last non-text element starts at ${last}s and the first text at ${first}s`,
  );
  // In pixels, and the same caveat as the corridor above: sampling at the first
  // text's own start cannot corroborate the ordering. It proves the delay is
  // ink.
  const area = text.map((el) => ({
    x: Math.floor(el.rect[0]),
    y: Math.floor(el.rect[1]),
    width: Math.ceil(el.rect[2]),
    height: Math.ceil(el.rect[3]),
  }));
  await seek(page, first * 1000 - 10);
  const before = [];
  for (const rect of area)
    before.push(await inked(await page.screenshot(), rect));
  await seek(page, DUR + 1000);
  const after = [];
  for (const rect of area)
    after.push(await inked(await page.screenshot(), rect));
  want(
    before.every((n) => n === 0) && after.every((n) => n > 0),
    `the text boxes held ${before.join('/')} inked px before the first text started and ${after.join('/')} at the end`,
  );
  await context.close();
  return `${text.length} text elements start at ${first}s, after the last of ${rest.length} others at ${last}s; text boxes ${before.join('/')} inked px before, ${after.join('/')} after`;
});

// The picture the pen emitted, with no stylesheet at all. Everything checks 7
// and 10 claim is measured against this one shot and these computed values.
const baseline = await (async () => {
  const { context, page } = await open({ body: svgTag('flow') });
  await paint(page, { id: 'flow', diagram: FLOW, animate: false });
  const shot = await page.screenshot();
  const styles = await painted(page, 'flow');
  await context.close();
  return { shot, styles };
})();
const control = baseline.shot;
const controlInk = await inked(control);

/** Which elements differ from the control on some property that paints. */
const unlikeControl = (styles) =>
  styles.flatMap((element, k) => {
    const want = baseline.styles[k] ?? {};
    return Object.keys({ ...want, ...element })
      .filter((name) => want[name] !== element[name])
      .map(
        (name) =>
          `element ${k} ${name}: "${want[name]}" became "${element[name]}"`,
      );
  });

// 7. Reduced motion shows the finished drawing at once.
await check(7, 'reduced motion is the finished drawing', async (want) => {
  const { context, page } = await open({
    body: svgTag('flow'),
    reducedMotion: 'reduce',
  });
  await paint(page, { id: 'flow', diagram: FLOW });
  const all = (await probe(page, 'flow')).filter((el) => el.tag !== 'style');
  const running = all.filter((el) => el.name !== 'none');
  want(
    running.length === 0,
    `${running.length} of ${all.length} elements are still running "${running[0]?.name}" under reduce`,
  );
  const dotted = all.filter((el) => el.dashAttr !== null);
  const kept = dotted.every((el) => el.dash === '2px, 7px');
  want(kept, `under reduce the dotted connector reads ${dotted[0]?.dash}`);
  const passes = [
    ...new Set(all.filter((el) => el.tag === 'path').map((el) => el.opacity)),
  ].sort();
  want(
    passes.includes('0.92') && passes.includes('0.5'),
    `under reduce the passes computed to ${passes.join('/')}`,
  );
  const shot = await page.screenshot();
  const gap = await differing(control, shot);
  want(
    gap.count === 0,
    `under reduce the drawing differs from the control in ${gap.count} px`,
  );
  await context.close();
  return `no animation on any of ${all.length} elements, dots ${dotted[0]?.dash}, passes ${passes.join('/')}, ${gap.count} px from the control`;
});

// 8. Two diagrams on one page keep their own timing.
await check(8, 'two diagrams keep their own timing', async (want) => {
  const { context, page } = await open({
    viewport: { width: VIEW.width, height: VIEW.height * 2 },
    body: `${svgTag('fast')}${svgTag('slow')}`,
  });
  await paint(page, { id: 'fast', diagram: FLOW, duration: 2000 });
  await paint(page, { id: 'slow', diagram: FLOW, duration: 5000 });
  const sheets = await page.evaluate(() =>
    Array.from(document.querySelectorAll('style')).map((el) => el.textContent),
  );
  const blocks = sheets.filter((text) => text.includes('@scope'));
  want(
    blocks.length === 2 && blocks[0] === blocks[1],
    `the two diagrams carry ${blocks.length} rule blocks and they are ${blocks[0] === blocks[1] ? 'identical' : 'different'}`,
  );
  await seek(page, 1000);
  const done = async (id) => {
    const all = (await probe(page, id)).filter((el) => el.name !== 'none');
    return {
      finished: all.filter((el) => drawnness(el) > 0.999).length,
      total: all.length,
      last: Math.max(...all.map((el) => Number.parseFloat(el.delay))),
    };
  };
  const fast = await done('fast');
  const slow = await done('slow');
  want(
    fast.last < slow.last,
    `the last element of the 2s diagram starts at ${fast.last}s and of the 5s diagram at ${slow.last}s`,
  );
  want(
    fast.finished > slow.finished,
    `a second in, the 2s diagram had drawn ${fast.finished} elements and the 5s diagram ${slow.finished}`,
  );
  await context.close();
  return `byte-identical blocks; at 1s the 2s diagram has drawn ${fast.finished}/${fast.total} and the 5s diagram ${slow.finished}/${slow.total}; last element starts at ${fast.last}s against ${slow.last}s`;
});

// 9. Self-contained: the same markup animates with nothing else loaded, both
//    as a file opened directly and embedded as an `<img src>` data URI.
//    Neither can be reached from script, so what is measured is the picture
//    twice: early, and after it has had time to finish.
await check(9, 'self-contained as a file and as an img', async (want) => {
  const inner = renderToString(FLOW, { seed: SEED, order: true });
  const wrap = (contents) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="${VIEW.width}" height="${VIEW.height}">${contents}</svg>`;
  const drawing = wrap(animateMarkup(inner, { duration: DUR }));
  // A control of its own rather than the page's: a standalone `.svg` carries
  // no font stack, so the text in it is not the text on an HTML page, and
  // comparing the two would measure the font rather than the animation.
  const still = wrap(inner);

  const dir = mkdtempSync(join(tmpdir(), 'pensketch-animation-'));
  const notes = [];
  try {
    const html = (svg) =>
      `data:text/html,${encodeURIComponent(
        `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#fff}img{display:block}</style><img width="${VIEW.width}" height="${VIEW.height}" src="data:image/svg+xml,${encodeURIComponent(svg)}">`,
      )}`;
    const write = (name, svg) => {
      const file = join(dir, name);
      writeFileSync(file, svg);
      return pathToFileURL(file).href;
    };
    // Nothing else is loaded in either: a `file://` document reaches no
    // network and no sibling, and an `<img>` runs no script at all.
    const sources = [
      ['file', write('drawing.svg', drawing), write('still.svg', still)],
      ['img', html(drawing), html(still)],
    ];
    const visit = async (url) => {
      const context = await browser.newContext({
        viewport: VIEW,
        deviceScaleFactor: 1,
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto(url);
      return { context, page };
    };
    for (const [name, moving, fixed] of sources) {
      const stillPage = await visit(fixed);
      const base = await stillPage.page.screenshot();
      const baseInk = await inked(base);
      await stillPage.context.close();

      const page = await visit(moving);
      // A fixed fraction of the drawing, not "as soon as `goto` came back".
      // Shot immediately, the `img` case measured 0 inked px in three runs of
      // four - it had not painted yet - and 0 satisfies `early < late` by
      // having rendered nothing at all, which is the one thing this check is
      // meant to rule out. Half way through, a drawing that is animating is
      // part inked and a static one is already whole, so the two are told
      // apart. Neither end is close: at DUR/2 the last element has not started
      // and the text has not begun.
      await page.page.waitForTimeout(DUR / 2);
      const early = await inked(await page.page.screenshot());
      await page.page.waitForTimeout(DUR + 1500);
      const shot = await page.page.screenshot();
      const late = await inked(shot);
      const gap = await differing(base, shot);
      await page.context.close();

      want(
        late > 0,
        `nothing rendered as ${name} at all - ${late} inked px, so this measured a blank page rather than an animation`,
      );
      want(
        early > 0 && early < late,
        `as ${name} the drawing was ${early} inked px half way through, of an eventual ${late} - ${early === 0 ? 'nothing had painted, so this measured a blank page rather than an animation' : 'which is a static picture, not an animated one'}`,
      );
      // That the finished drawing is the whole drawing - but only as an
      // `img`, because only there are the two sides of this comparison
      // rastered the same way. An image is one layer, so nothing inside it is
      // composited per element. A document is not: it puts every animated
      // element on a layer of its own and keeps it there, and Chrome rasters a
      // composited element a shade differently from one it never composited.
      //
      // Measured on the same markup in one run, finished against unanimated:
      // as an `img` 0 px differ on macOS and on Linux; as a `file` +3 px of ink
      // on macOS and -141 on Linux, 3.6% of the drawing. No band separates
      // that from a real defect, because the quantity it measures belongs to
      // the platform rather than to the drawing - a band wide enough for Linux
      // is wider than several strokes. So the document case is not held to
      // pixels here. It is held to every computed property, exactly, by check
      // 10 - which is the assertion this one was standing in for.
      if (name === 'img')
        want(
          Math.abs(late - baseInk) <= baseInk / 100,
          `as ${name} the finished drawing inked ${late} px against ${baseInk} for the same markup with no stylesheet`,
        );
      notes.push(
        `${name} ${early} inked px half way -> ${late} at the end, against ${baseInk} unanimated (${gap.count} px differ, worst channel ${gap.worst})`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return notes.join('; ');
});

// 10. The degradation is one, not four. A diagram whose animation does not
//     run for any reason is pixel-identical to the same diagram with no
//     stylesheet at all - measured against the control, not asserted.
await check(10, 'the degradation is one, not four', async (want) => {
  const shoot = async (name, options) => {
    const { context, page } = await open({
      body: svgTag('flow'),
      reducedMotion: options.reducedMotion,
    });
    await paint(page, {
      id: 'flow',
      diagram: FLOW,
      order: options.order ?? true,
      animate: options.animate ?? true,
      duration: options.duration,
      drop: options.drop,
    });
    if (options.settle) await page.waitForTimeout(options.settle);
    const shot = await page.screenshot();
    const styles = await painted(page, 'flow');
    await context.close();
    return {
      name,
      styles,
      ink: await inked(shot),
      gap: await differing(control, shot),
    };
  };

  want(
    controlInk > 0,
    'the control inked nothing, so no comparison means anything',
  );

  // Every way the animation can fail to run. The requirement's own words are
  // "pixel-identical to the same diagram with no stylesheet at all", so these
  // are held to exactly that and not to a tolerance.
  const dead = [
    // `order: false` with no stylesheet at all, which is what makes
    // `pathLength` visually inert and the one control fair to every variant.
    await shoot('no stylesheet, no order', { order: false, animate: false }),
    // The index absent entirely - an older core, an element a bare `pen`
    // drew, a caller who did not pass `order`.
    await shoot('--ps-i absent', { order: false }),
    // A viewer who has asked not to be moved.
    await shoot('reduced motion', { reducedMotion: 'reduce' }),
    // An engine that does not understand `@scope` and drops the block whole.
    await shoot('rules dropped', { drop: true }),
  ];
  for (const variant of dead) {
    want(
      variant.gap.count === 0,
      `"${variant.name}" differs from the control in ${variant.gap.count} px, worst channel ${variant.gap.worst} (${variant.ink} inked against ${controlInk})`,
    );
    const unlike = unlikeControl(variant.styles);
    want(
      unlike.length === 0,
      `"${variant.name}" was touched by the stylesheet: ${unlike.slice(0, 3).join('; ')}`,
    );
  }

  // And the animation run to its end, which is the other half of the same
  // claim: a finished element is one the stylesheet is no longer touching.
  //
  // Held to its computed values and to nothing else, because the computed
  // values are the whole of the claim. `painted` collects *every* property
  // `getComputedStyle` reports bar the animation longhands and `--ps-*`, and
  // this compares all of them against the control element by element - so
  // `stroke-opacity`, `opacity`, `stroke-dasharray`, `stroke-dashoffset`,
  // `stroke-width`, `visibility` and the rest are each equal, exactly. There
  // is no way for an element to be missing, faded, hidden or narrowed that
  // does not show up here.
  //
  // It used to be held to its inked pixel count as well, within 1%, and that
  // was the second of two instruments for one claim - the weaker one, and the
  // only assertion in this file comparing a *composited* render against one
  // that was never composited. An element Chrome has animated stays on a layer
  // of its own and rasters a shade differently: measured, +4 px of ink on
  // macOS and -141 on Linux, against the same control, with every computed
  // property equal in both. That is a fact about the platform's compositor,
  // not about the drawing, and no threshold turns it into one - which is why
  // the comparison is gone rather than widened.
  const finished = await shoot('animation finished', {
    duration: 1000,
    settle: 3000,
  });
  const unlike = unlikeControl(finished.styles);
  want(
    unlike.length === 0,
    `the finished drawing is still being touched: ${unlike.slice(0, 3).join('; ')}`,
  );

  return `control ${controlInk} inked px; ${dead
    .map((v) => `${v.name} ${v.ink} (${v.gap.count} px differ)`)
    .join(
      '; ',
    )}; animation finished ${finished.ink} (${finished.gap.count} px differ, worst channel ${finished.gap.worst}, every painted property equal)`;
});

await browser.close();

let failed = 0;
for (const { number, title, failures, note } of results) {
  if (failures.length === 0) {
    console.log(`ok   ${number}  ${title} - ${note}`);
    continue;
  }
  failed++;
  console.log(`FAIL ${number}  ${title}`);
  for (const detail of failures) console.log(`        ${detail}`);
  if (note) console.log(`        (${note})`);
}
console.log(
  `${results.length - failed} of ${results.length} checks passed against packages/animation/dist`,
);
if (failed) fail(`${failed} of ${results.length} checks failed`);
