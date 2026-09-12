import { writeFileSync } from 'node:fs';
import { animateMarkup } from '../packages/animation/dist/index.js';
import { renderToString } from '../packages/core/dist/server.js';
import { shippedDiagrams } from './shipped-diagrams.mjs';
import { DARK, FACE, FACE_LICENCE, MONO, P, SERIF } from './tokens.mjs';

// One page showing every diagram this repository ships, drawn by the shipped
// renderer from the shipped data. Generated rather than written, so it cannot
// claim a figure the repository stopped drawing. Since 5148903 the page is
// hand-maintained and CI no longer holds it to this generator; it runs on
// demand, and its template is kept in step with the page by hand so a
// regeneration does not resurrect what an owner edit removed.
//
// Self-contained on purpose: the CSS is inline, the hand face is a data: URI,
// every `<svg>` is in the document. A reader opening it from a file:// URL
// sees what a visitor sees, and no request leaves the page.
//
// Run: `npm run showcase`. Needs `npm run build` first - it renders through
// `packages/core/dist`, the published entry, rather than through the source.

const root = new URL('../', import.meta.url);

/**
 * The figures, in the order a reader meets them, with the one line of
 * editorial each needs.
 *
 * This list is the tripwire, and it is a real one rather than a formality:
 * a key here that `shippedDiagrams()` does not return fails the build, and a
 * keyed diagram it returns that is *not* here fails it too. Adding an example
 * therefore stops the page until someone decides where it goes, which is the
 * only way a generated page stays curated.
 *
 * Everything else about a figure - its counts, its frame, the file it came
 * from - is read from the data. Only the sentence is typed.
 */
const ORDER = [
  [
    'hero',
    'The one on the front page',
    'The diagram the README opens with, at the size most diagrams actually are.',
  ],
  [
    'pipeline',
    'A CI pipeline',
    'What the extrusion is for: a flat drawing and a stack of slabs are the same data and one option apart.',
  ],
  [
    'lifecycle',
    'An order lifecycle',
    'A state machine where the interesting state is the one that loops back to itself.',
  ],
  [
    'atm',
    'A cash machine',
    'A transition and its reverse between the same pair of nodes, which is the case a straight line cannot draw twice.',
  ],
  [
    'incident',
    'An incident, mid-flight',
    'The React example. The diagram is computed from application state, so the picture changes as the incident does and the renderer is told nothing about why.',
  ],
  [
    'showcase',
    'Everything at once',
    'Built to reach for as much of the data model as one picture can hold, and to need no `raw` callback doing it. The escape hatch exists; this did not want it.',
  ],
  [
    'fig-overview',
    'Photosynthesis, in one line',
    'The first of five figures from the animation example, which explains photosynthesis and is drawn by the library it is demonstrating.',
  ],
  [
    'fig-zoom',
    'Down to the chloroplast',
    'A leaf, then a cell, then the organelle, then the two halves of the machinery inside it.',
  ],
  [
    'fig-light',
    'The light reactions',
    'The busiest figure here. A membrane along the top, and everything below it hanging off what crosses that membrane.',
  ],
  [
    'fig-calvin',
    'The Calvin cycle',
    'A cycle, so the last arrow has to return to the first node without drawing through the middle of the picture.',
  ],
  [
    'fig-loop',
    'Why it is one process',
    'The smallest figure here, and the one carrying the whole argument of the piece.',
  ],
];

/**
 * What a diagram actually uses, counted rather than described.
 *
 * Every factual claim about a figure is derived here. The sentences above say
 * why a figure is on the page and nothing a reader could check against the
 * data, because the sentences are the one part of this page nothing gates -
 * and the first two drafts of them were wrong. The first invented what five
 * figures were about. The second, written after that was caught, still said
 * three accents were "inside a single group" when two of them are outside it,
 * counted a group as both a node and a group, and called one accent several.
 *
 * A caption cannot go stale if it makes no claim, and a count cannot go stale
 * if it is computed on the way past.
 */
const featuresOf = ({ diagram, options }) => {
  const nodes = diagram.nodes ?? [];
  const edges = diagram.edges ?? [];
  const braces = diagram.braces ?? [];
  const drawn = nodes.filter((n) => n.shape !== 'group');
  const kinds = [...new Set(drawn.map((n) => n.shape ?? 'box'))].sort();
  const braceKinds = [...new Set(braces.map((b) => b.kind ?? 'curly'))].sort();
  const count = (n, one, many = `${one}s`) =>
    n ? `${n} ${n === 1 ? one : many}` : '';

  return [
    kinds.join(' + '),
    count(nodes.length - drawn.length, 'group'),
    braceKinds.length
      ? `${braceKinds.join(' + ')} brace${braces.length === 1 ? '' : 's'}`
      : '',
    // Adjectives, so they do not take a plural: "2 hatched", not "2 hatcheds".
    count(drawn.filter((n) => n.hatch).length, 'hatched', 'hatched'),
    count(drawn.filter((n) => n.accent).length, 'accent'),
    count(edges.filter((e) => e.via?.length).length, 'orthogonal run'),
    count(edges.filter((e) => e.bow).length, 'bowed', 'bowed'),
    count(edges.filter((e) => e.from[0] === e.to[0]).length, 'self-transition'),
    count(edges.filter((e) => e.dotted).length, 'dotted', 'dotted'),
    count((diagram.notes ?? []).length, 'note'),
    options?.extrude ? 'extruded' : '',
  ].filter(Boolean);
};

const attr = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The same drawing, with the digits nobody can see taken off.
 *
 * `renderToString` prints coordinates at full IEEE-754 precision -
 * `27.579534765519202` - and 23,499 of this page's 26,680 numbers carry
 * twelve decimal places or more. They carry no information: the pen's own
 * jitter amplitude is 2.6 px, so everything below 0.01 px is far under the
 * noise floor of the thing being drawn.
 *
 * It is worth 145 KB gzipped, 58% of the page. This repository budgets its
 * core entry at 5,440 gzipped bytes and has re-argued that number over 21 of
 * them; shipping 145 KB of float noise on a published page is the same
 * question, and nothing in this change had asked it.
 *
 * Scoped to the two attributes that carry long decimals - `d` and
 * `stroke-width` - rather than run over every number in the document, because
 * a label reading "3.14159" is text and not a coordinate.
 */
const trim = (svg) =>
  svg.replace(
    /(\b(?:d|stroke-width)=")([^"]*)"/g,
    (_, name, value) =>
      `${name}${value.replace(/\d+\.\d{3,}/g, (n) => String(Math.round(Number(n) * 100) / 100))}"`,
  );

/** The file a diagram was loaded from, off the name the loader built. */
const sourceOf = (name) =>
  String(name)
    .split(/ (?:at "|#)/)[0]
    .trim();

const shipped = await shippedDiagrams();
const keyed = shipped.filter((s) => s.key);
const byKey = new Map(keyed.map((s) => [s.key, s]));

// A `Map` keeps the last writer, so two entries sharing a key collapse into
// one and a diagram disappears from a page headed "every diagram it ships" -
// no error, no diff, nothing. One copy-pasted `<svg id="...">` between two
// example pages is all it takes, because that id *is* the key.
if (byKey.size !== keyed.length) {
  // `!seen.add(k)` would be a neat one-liner and is always false, because
  // `Set.add` returns the set. The first draft of this line named no key at
  // all, which is a refusal that does not name the fix.
  const seen = new Set();
  const twice = new Set();
  for (const { key } of keyed) {
    if (seen.has(key)) twice.add(key);
    seen.add(key);
  }
  throw new Error(
    `two shipped diagrams share the key ${[...twice].map((k) => `"${k}"`).join(', ')}, so one would be dropped silently. The key is the element id the example page draws into; give them different ids.`,
  );
}

// `shippedDiagrams()` refuses a missing viewBox, which a three-number one is
// not: `"0 0 880".split(...).map(Number)` is a truthy array of three, and it
// reaches the page as `height="undefined"` with the generator exiting 0.
for (const s of keyed)
  if (s.viewBox.length !== 4 || !s.viewBox.every(Number.isFinite))
    throw new Error(
      `"${s.key}" has viewBox [${s.viewBox}], which is not four numbers. A short one publishes width="undefined" rather than failing here.`,
    );

// The options are read by name below, so one this page has not been taught
// about is dropped rather than applied - and a dropped option is a figure
// that differs from the example page in a way only a comparison would show.
// That is the failure the wrapper's own docblock describes; an allowlist
// reintroduces it for every option added after today, unless something
// notices.
const KNOWN = new Set(['seed', 'extrude', 'depth', 'hops', 'label', 'order']);
for (const s of keyed) {
  const unknown = Object.keys(s.options ?? {}).filter((k) => !KNOWN.has(k));
  if (unknown.length)
    throw new Error(
      `"${s.key}" is drawn with ${unknown.map((k) => `"${k}"`).join(', ')}, which this generator does not pass on. Add it to svgFor and to KNOWN, or the page draws a picture the example does not.`,
    );
}

// Both directions, because a tripwire that only fires one way is half a
// tripwire: a name here that no longer exists, and a diagram that exists and
// is not named here.
const missing = ORDER.map(([key]) => key).filter((key) => !byKey.has(key));
if (missing.length)
  throw new Error(
    `tools/build-showcase.mjs names ${missing.map((k) => `"${k}"`).join(', ')}, which shippedDiagrams() does not return. Remove them here, or restore the example.`,
  );

const unplaced = [...byKey.keys()].filter(
  (key) => !ORDER.some(([named]) => named === key),
);
if (unplaced.length)
  throw new Error(
    `shippedDiagrams() returns ${unplaced.map((k) => `"${k}"`).join(', ')}, which this page does not show. Add each to ORDER with the line it should carry - a generated page stays curated only while adding an example stops the build.`,
  );

// The unkeyed entries are the React example's other reveal stages, and they
// are skipped rather than printed untitled. Skipped by provenance, not by
// count: an unkeyed diagram arriving from a file no keyed one came from is a
// figure nobody named, and it fails here rather than vanishing quietly.
const shown = new Set([...byKey.values()].map((s) => sourceOf(s.name)));
const orphans = shipped
  .filter((s) => !s.key && !shown.has(sourceOf(s.name)))
  .map((s) => s.name);
if (orphans.length)
  throw new Error(
    `shippedDiagrams() returns unnamed diagrams from a source nothing named covers: ${orphans.join(', ')}. Give each a key, or this page cannot title them.`,
  );

/**
 * A complete `<svg>` for one shipped diagram.
 *
 * `renderToString` takes the diagram and its *options* - it returns the
 * contents of an element rather than an element, and the frame is the
 * wrapper's business. Passing the viewBox where the options go is silent:
 * every field reads `undefined`, so the drawing comes back seeded 1 and flat,
 * and the only way to notice is that the picture is not the one the example
 * page draws. The options are what carry `extrude`, which is the difference
 * between a slab and a rectangle.
 *
 * `order: true`, because these figures animate: it stamps the `--ps-i`
 * fraction the animation rules read, and `animateMarkup` puts those rules
 * inside each wrapper, where their implicit `@scope` binds to that drawing
 * alone. The page then holds every element paused until its figure scrolls
 * into view - the gate and its reasons live beside the `.js` rule in the
 * stylesheet below. `label` goes on the wrapper as the accessible name,
 * which is where it belongs and not in the drawing.
 */
const svgFor = ({ diagram, viewBox, options }, name) => {
  const [minX, minY, width, height] = viewBox;
  const { seed, extrude, depth, hops } = options ?? {};
  const inner = renderToString(diagram, {
    ...(seed === undefined ? {} : { seed }),
    ...(extrude === undefined ? {} : { extrude }),
    ...(depth === undefined ? {} : { depth }),
    ...(hops === undefined ? {} : { hops }),
    order: true,
  });
  // The data's own label where there is one - five of the eleven carry it -
  // and this page's title for the rest. A figure with no accessible name is
  // an image a screen reader announces as nothing at all, and "the data
  // already holds it" was true of under half of them.
  // A `<title>` carrying the heading a sighted reader sees, rather than an
  // `aria-label` carrying the data's own. Five of these diagrams have a
  // `label` in their options and it is not the heading - "The whole trade, in
  // one line" against "Photosynthesis, in one line" - so labelling from it
  // gave two readers two names for one figure. `role="img"` prunes the
  // subtree, so the title is the whole of what is announced.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" role="img"><title>${attr(name)}</title>${animateMarkup(trim(inner))}</svg>`;
};

const figures = ORDER.map(([key, title, blurb], i) => {
  const s = byKey.get(key);
  const nodes = s.diagram.nodes?.length ?? 0;
  const edges = s.diagram.edges?.length ?? 0;
  const [, , w, h] = s.viewBox;
  const svg = svgFor(s, title);

  return `<section class="fig" id="${attr(key)}">
  <header>
    <p class="n">${String(i + 1).padStart(2, '0')}</p>
    <h2>${attr(title)}</h2>
    <p class="blurb measure">${attr(blurb)}</p>
  </header>
  <figure><div class="frame" style="--w:${w};--h:${h}">${svg}</div>
    <figcaption>
      <span>${nodes} node${nodes === 1 ? '' : 's'}</span>
      <span>${edges} edge${edges === 1 ? '' : 's'}</span>
      <span>${w} &times; ${h}</span>
      <span class="src">${attr(sourceOf(s.name))}</span>
    </figcaption>
    <p class="uses">${featuresOf(s)
      .map((f) => `<span>${attr(f)}</span>`)
      .join('')}</p>
  </figure>
</section>`;
}).join('\n\n');

// The install block, emitted once and placed twice - the cover's disclosure
// and the closing slide - because two hand-written copies in one template is
// in-page drift waiting to happen. The npx pin inside it is one of
// `npm run pin`'s targets.
const INSTALL = `<pre><code><span class="comment"># the full server for a coding agent: check, render, and a PNG it can look at</span>
claude mcp add pensketch -- npx -y @pensketch/mcp@0.9.0

<span class="comment"># zero install, hosted: checks and SVG, no PNG</span>
claude mcp add --transport http pensketch https://pensketch.alpha-nu.deno.net</code></pre>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pensketch &mdash; every diagram it ships</title>
<meta name="description" content="Every diagram the pensketch repository ships, drawn by the library itself from the same data its tests and its MCP server read.">
<style>
@font-face {
  font-family: "Architects Daughter";
  src: url(data:font/ttf;base64,${FACE}) format("truetype");
  font-display: swap;
}

:root {
  color-scheme: light dark;
  --paper: ${P.paper};
  --rule: ${P.rule};
  --ps-ink: ${P.ink};
  --ps-pen: ${P.pen};
  --ps-accent: ${P.accent};
  --ps-muted: ${P.muted};
  --ps-wash: ${P.wash};
  --serif: ${SERIF};
  --mono: ${MONO};
}

/* The palette the repository's own examples already carry for a dark
   viewer. The ink lightens and the pen and accent lift off it; the paper
   goes to the ink's own hue rather than to black, so a drawing sits on a
   surface rather than in a hole. */
@media (prefers-color-scheme: dark) {
  :root {
    --paper: ${DARK.paper};
    --rule: ${DARK.rule};
    --ps-ink: ${DARK.ink};
    --ps-pen: ${DARK.pen};
    --ps-accent: ${DARK.accent};
    --ps-muted: ${DARK.muted};
    --ps-wash: ${DARK.wash};
  }
}

* { box-sizing: border-box; }

/* One rule for every link, rather than one per region: two rules of
   different specificity in source order is a descending-specificity warning,
   and a gate that prints warnings is a gate people stop reading. */
a { color: var(--ps-pen); }

body {
  margin: 0;
  padding: 0 24px 96px;
  background: var(--paper);
  color: var(--ps-ink);
  font: 400 17px/1.65 var(--serif);
  -webkit-font-smoothing: antialiased;
}

/* Wide enough for a figure to be the slide it sits on; prose keeps its own
   62ch measure regardless, so the column widening never stretches a
   sentence. */
.wrap { max-width: 96rem; margin: 0 auto; }

header.top {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  border-bottom: 1px solid var(--rule);
}

/* The opening line gets more room than body prose: it is one paragraph
   doing the work of a cover, and at 62ch it wrapped into a block that read
   as documentation. */
.lede { max-width: 76ch; }

/* The shortcut for the reader who needs no show: a disclosure that hands
   over the commands where they stand, instead of a jump that makes them
   leave the cover. A native <details>, so it costs no script and the
   keyboard and the screen reader get it for free. */
.skip { margin: 18px 0 0; font: 400 13px/1.6 var(--mono); }
.skip summary { cursor: pointer; color: var(--ps-muted); }
/* max-content up to the column, so the commands sit whole on one line
   where there is room and scroll inside the block where there is not. */
.skip pre {
  margin: 12px 0 0;
  padding: 16px 20px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  overflow-x: auto;
  width: max-content;
  max-width: 100%;
  font: 400 13px/1.9 var(--mono);
}

/* The closing slide: the ask, made after the show has argued it. Same
   rhythm as a figure - number, heading, blurb - with the command where the
   drawing goes. */
#install pre {
  margin: 0;
  padding: 22px 26px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  overflow-x: auto;
  width: max-content;
  max-width: 100%;
  font: 400 14.5px/2 var(--mono);
}
code .comment { color: var(--ps-muted); }

/* An invitation rather than an instruction: three nested chevrons at the
   foot of the first slide, a trail fading upward, the pulse travelling the
   way the page wants the reader to go. Each link carries its own weight in
   --cue-k - the keyframes read it, so one set of frames drives all three
   at three intensities, and the stagger is only a delay. Decorative, so it
   is hidden from readers who cannot see it, and still under reduced motion
   rather than gone - the direction is the information, the pulse is only
   the emphasis. */
.scroll-cue {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scroll-cue span {
  width: 18px;
  height: 18px;
  border-right: 3px solid var(--ps-muted);
  border-bottom: 3px solid var(--ps-muted);
  transform: rotate(45deg);
  animation: cue 2.6s ease-in-out infinite;
}
.scroll-cue span + span { margin-top: -12px; }
.scroll-cue span:nth-child(1) { --cue-k: 0.4; }
.scroll-cue span:nth-child(2) { --cue-k: 0.65; animation-delay: 0.18s; }
.scroll-cue span:nth-child(3) { --cue-k: 1; animation-delay: 0.36s; }
@keyframes cue {
  0%, 100% { opacity: calc(0.12 * var(--cue-k, 1)); transform: translateY(0) rotate(45deg); }
  50% { opacity: calc(0.72 * var(--cue-k, 1)); transform: translateY(5px) rotate(45deg); }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-cue span { animation: none; opacity: calc(0.5 * var(--cue-k, 1)); }
}
header.top h1 {
  margin: 0 0 12px;
  font: 400 clamp(30px, 5vw, 46px)/1.15 "Architects Daughter", var(--serif);
  letter-spacing: .01em;
  text-wrap: balance;
}
header.top p { margin: 0; color: var(--ps-muted); }
header.top .meta {
  margin-top: 24px;
  font: 400 13px/1.6 var(--mono);
  color: var(--ps-muted);
}

/* Each figure is a slide: viewport-high, its content centred, the diagram
   as large as the slide can hold. min-height rather than height, so a
   figure whose caption outgrows a small screen scrolls instead of
   clipping. */
.fig {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
  padding: 48px 0;
  border-bottom: 1px solid var(--rule);
}
.fig header { display: grid; gap: 6px; }
.fig .n {
  margin: 0;
  font: 400 12px/1 var(--mono);
  letter-spacing: .14em;
  color: var(--ps-accent);
}
.fig h2 {
  margin: 0;
  font: 400 clamp(21px, 3vw, 27px)/1.25 var(--serif);
  text-wrap: balance;
}
.fig .blurb { margin: 0; color: var(--ps-muted); }

/* One measure rule rather than one per region. Three of those, at three
   specificities in source order, is what the descending-specificity lint
   catches - and a warning left standing is how a gate stops being read. */
.measure { max-width: 62ch; }

figure { margin: 0; }

/* Wide diagrams scroll inside their own frame, never the page.

   The floor is what makes that true. With \`width: 100%\` and a max alone the
   svg can never exceed the frame, so the frame can never overflow, so
   \`overflow-x\` never fires - measured false across 55 figure-by-width
   combinations - and what actually happens is uniform downscaling. On a
   390px phone the widest figure came out at 0.26x, putting its 13.5px
   lettering on screen at 3.6px, which is a smear rather than a diagram.

   0.68 is the smallest scale that keeps that lettering at 9px. Below it the
   figure stops shrinking and the frame scrolls, which is the behaviour the
   \`overflow-x\` was written for. */
.frame {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 4px;
}
svg text { font-family: "Architects Daughter", cursive; }
/* As wide as the slide allows, but never taller than it: the width is the
   lesser of the column and the width whose derived height is 72svh, so the
   drawing scales up past its natural size - it is vector ink - and stops
   exactly where it would push the caption off the slide. No max-height,
   deliberately: on a replaced element that clamps the box and letterboxes
   the ink inside it; deriving the width keeps box and ink the same size. */
.frame svg {
  display: block;
  margin-inline: auto;
  width: min(100%, calc(var(--w) / var(--h) * 72svh));
  min-width: calc(var(--w) * 0.68px);
  height: auto;
}

/* The reveal gate. Each svg carries its own animation rules and would draw
   itself at load, off screen and unseen; this holds every element at its
   first keyframe until the script at the foot of the page marks the figure
   seen. Gated on .js, which only the script in the head sets, so a reader
   without script gets drawings that ran at load - finished by the time they
   scroll there - and never a paused, blank one. A longhand rather than a shorthand,
   and at four classes deep rather than fewer, both deliberately: the scoped
   \`animation\` shorthand inside each svg resets play-state to running, and
   only a separate declaration that outranks the shorthand's (0,2,1)
   specificity can say otherwise. Under prefers-reduced-motion the svg's own
   rules already set \`animation: none\`, and pausing no animation is nothing,
   so the finished picture shows immediately either way. */
.js .fig:not(.seen) .frame svg > * { animation-play-state: paused; }

/* The deck. Only where the screen is wide enough to hold a figure whole:
   on a phone a slide regularly outgrows its viewport, and a mandatory snap
   over an area taller than the snapport is a scroll that fights the
   reader. \`stop: always\` is what makes it a deck rather than a page with
   magnetism - a long flick lands one slide on, not four. */
@media (min-width: 900px) {
  html { scroll-snap-type: y mandatory; }
  header.top, .fig { scroll-snap-align: start; scroll-snap-stop: always; }
  /* The footer is shorter than a slide, so under mandatory snap a scroll
     into it found no snap position and was pulled back to the last figure
     - the footer was unreachable. Aligning its end to the snapport makes
     the bottom of the page a resting place of its own. */
  footer { scroll-snap-align: end; }
}

figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-top: 18px;
  font: 400 12.5px/1.5 var(--mono);
  color: var(--ps-muted);
  font-variant-numeric: tabular-nums;
}
figcaption .src { color: var(--ps-pen); }

/* What the figure uses, counted from the data on the way past rather than
   typed. Every factual claim about a figure lives here; the sentence above
   it makes none. */
.uses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 0;
}
.uses span {
  padding: 3px 9px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  font: 400 11.5px/1.4 var(--mono);
  color: var(--ps-muted);
  font-variant-numeric: tabular-nums;
}

footer {
  padding-top: 48px;
  font: 400 13px/1.7 var(--mono);
  color: var(--ps-muted);
}

footer summary { cursor: pointer; margin-top: 8px; }
footer pre {
  margin: 12px 0 0;
  padding: 16px;
  border: 1px solid var(--rule);
  overflow-x: auto;
  white-space: pre-wrap;
  font: 400 12px/1.6 var(--mono);
}

</style>
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<div class="wrap">

<header class="top">
  <h1>Watch pensketch draw</h1>
  <p class="lede">${ORDER.length} diagrams, sketched in front of you by the
  library that ships them. No mockups, no screenshots: every figure is drawn
  live, from the same data the tests measure and the MCP server hands to
  agents. Scroll, and the pen gets to work.</p>
  <details class="skip">
    <summary>Show me the install line</summary>
    ${INSTALL}
  </details>
  <div class="scroll-cue" aria-hidden="true"><span></span><span></span><span></span></div>
</header>

${figures}

<section class="fig" id="install">
  <header>
    <p class="n">${String(ORDER.length + 1).padStart(2, '0')}</p>
    <h2>Draw your own</h2>
    <p class="blurb measure">Two ways in, one data model. The server carries
    the schema, the reference and five worked examples, so an agent reads the
    rules instead of guessing them.</p>
  </header>
  ${INSTALL}
</section>

<footer>
  <p class="measure">Coordinates are given, never computed &mdash; pensketch performs no layout
  and never measures text.</p>

  <p class="measure">Figures set in Architects Daughter by Kimberly Geswein, under the SIL Open
  Font License 1.1. The face is embedded in this page, so its licence travels
  with it rather than being linked to.</p>

  <details>
    <summary>SIL Open Font License 1.1</summary>
    <pre>${attr(FACE_LICENCE)}</pre>
  </details>
</footer>

</div>
<script>
// One-shot: a figure once seen stays seen, so scrolling back up never
// resets a drawing to blank. Threshold 0 with a bottom margin rather than a
// fraction, because a section taller than the viewport never reaches a
// fractional threshold at all - its ratio tops out below it - and would
// never fire.
const seen = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        entry.target.classList.add('seen');
        seen.unobserve(entry.target);
      }
  },
  { rootMargin: '0px 0px -12% 0px' },
);
for (const fig of document.querySelectorAll('.fig')) seen.observe(fig);
</script>
</body>
</html>
`;

const out = new URL('docs/showcase/index.html', root);
writeFileSync(out, page);
console.log(
  `PASS showcase: ${ORDER.length} figures, ${(page.length / 1024).toFixed(0)} KB, ${out.pathname.replace(root.pathname, '')}`,
);
