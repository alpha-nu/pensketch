import { writeFileSync } from 'node:fs';
import { renderToString } from '../packages/core/dist/server.js';
import { shippedDiagrams } from './shipped-diagrams.mjs';
import { FACE, MONO, P, SERIF } from './tokens.mjs';

// One page showing every diagram this repository ships, drawn by the shipped
// renderer from the shipped data. Generated rather than written, so it cannot
// claim a figure the repository stopped drawing, and held to a fresh
// generation in CI on the same terms as the goldens and the schema.
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
    'Five nodes, a group behind them, a brace, one bowed arrow and one hatched box. Most of the data model, at the size most diagrams actually are.',
  ],
  [
    'pipeline',
    'A CI pipeline',
    'Two groups, all three drawn shapes, and the diagram-wide extrusion turned on - so every box is a slab lit from the top left. The dotted arrow is the failure path.',
  ],
  [
    'lifecycle',
    'An order lifecycle',
    'Six pills and a self-transition: the retry leaves one side of a node and returns to it, with the arrowhead landing where it left.',
  ],
  [
    'atm',
    'A cash machine',
    'Ten arrows through seven nodes, two of them bowed apart - a transition and its reverse, which would otherwise draw as one line twice.',
  ],
  [
    'incident',
    'An incident, mid-flight',
    'The React example, at the stage where the most is visible. The diagram is computed from application state; the renderer is told nothing about why any of it is shaded.',
  ],
  [
    'showcase',
    'Everything at once',
    'Twenty nodes, four groups, both kinds of brace, hatching, accents, five orthogonal runs and a loop - and not one `raw` callback. That is the point of it: no escape hatch was needed.',
  ],
  [
    'fig-overview',
    'Photosynthesis, in one line',
    'The first of five figures from the animation example, which explains photosynthesis and is drawn by the library it is demonstrating. Every arrow here takes corners.',
  ],
  [
    'fig-zoom',
    'Down to the chloroplast',
    'A leaf, a cell, an organelle. One group bounds the whole descent and the accent marks where the machinery finally is.',
  ],
  [
    'fig-light',
    'The light reactions',
    'The most crowded figure on this page: twelve nodes, nineteen pieces of text and three accents inside a single group. The checker reports nothing on it.',
  ],
  [
    'fig-calvin',
    'The Calvin cycle',
    'Seven boxes and seven arrows, four of them routed through corners so the cycle closes without a line crossing the middle of it.',
  ],
  [
    'fig-loop',
    'Why it is one process',
    'Two boxes and an arrow each way, both given the same bow. A bow is measured against the direction of travel, so one number puts the pair on opposite sides and they stay two readable lines.',
  ],
];

const attr = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The file a diagram was loaded from, off the name the loader built. */
const sourceOf = (name) =>
  String(name)
    .split(/ (?:at "|#)/)[0]
    .trim();

const shipped = await shippedDiagrams();
const byKey = new Map(shipped.filter((s) => s.key).map((s) => [s.key, s]));

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
 * `order` is dropped: it stamps the attributes an animation reads, and these
 * figures do not animate. `label` goes on the wrapper as the accessible name,
 * which is where it belongs and not in the drawing.
 */
const svgFor = ({ diagram, viewBox, options }, fallbackLabel) => {
  const [minX, minY, width, height] = viewBox;
  const { seed, extrude, depth, hops, label } = options ?? {};
  const inner = renderToString(diagram, {
    ...(seed === undefined ? {} : { seed }),
    ...(extrude === undefined ? {} : { extrude }),
    ...(depth === undefined ? {} : { depth }),
    ...(hops === undefined ? {} : { hops }),
  });
  // The data's own label where there is one - five of the eleven carry it -
  // and this page's title for the rest. A figure with no accessible name is
  // an image a screen reader announces as nothing at all, and "the data
  // already holds it" was true of under half of them.
  const aria = ` role="img" aria-label="${attr(label || fallbackLabel)}"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}"${aria}>${inner}</svg>`;
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
    <p class="blurb">${attr(blurb)}</p>
  </header>
  <figure><div class="frame" style="--w:${w}">${svg}</div>
    <figcaption>
      <span>${nodes} node${nodes === 1 ? '' : 's'}</span>
      <span>${edges} edge${edges === 1 ? '' : 's'}</span>
      <span>${w} &times; ${h}</span>
      <span class="src">${attr(sourceOf(s.name))}</span>
    </figcaption>
  </figure>
</section>`;
}).join('\n\n');

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
    --paper: #15191F;
    --rule: rgba(217, 223, 231, .18);
    --ps-ink: #D9DFE7;
    --ps-pen: #7FA9DB;
    --ps-accent: #DB8570;
    --ps-muted: #93A0AD;
    --ps-wash: rgba(127, 169, 219, .07);
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

.wrap { max-width: 62rem; margin: 0 auto; }

header.top {
  padding: 88px 0 40px;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 8px;
}
header.top h1 {
  margin: 0 0 12px;
  font: 400 clamp(30px, 5vw, 46px)/1.15 "Architects Daughter", var(--serif);
  letter-spacing: .01em;
  text-wrap: balance;
}
header.top p { margin: 0; max-width: 46ch; color: var(--ps-muted); }
header.top .meta {
  margin-top: 24px;
  font: 400 13px/1.6 var(--mono);
  color: var(--ps-muted);
}

.fig { padding: 56px 0; border-bottom: 1px solid var(--rule); }
.fig header { display: grid; gap: 6px; margin-bottom: 28px; }
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
.fig .blurb { margin: 0; max-width: 58ch; color: var(--ps-muted); }

figure { margin: 0; }

/* Wide diagrams scroll inside their own frame, never the page. \`--w\` is the
   drawing's own width, so a figure narrower than the column is not stretched
   to fill it. */
.frame {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 4px;
}
svg text { font-family: "Architects Daughter", cursive; }
.frame svg {
  display: block;
  width: 100%;
  max-width: calc(var(--w) * 1px);
  height: auto;
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

footer {
  padding-top: 48px;
  font: 400 13px/1.7 var(--mono);
  color: var(--ps-muted);
}

</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <h1>Every diagram pensketch ships</h1>
  <p>Drawn by the library itself, from the same data its tests measure and its
  MCP server serves to agents. Nothing on this page was placed by hand except
  the sentences.</p>
  <p class="meta">
    ${figures.split('<section class="fig"').length - 1} figures &middot;
    generated by <a href="https://github.com/alpha-nu/pensketch/blob/main/tools/build-showcase.mjs">tools/build-showcase.mjs</a> &middot;
    <a href="https://github.com/alpha-nu/pensketch">the repository</a>
  </p>
</header>

${figures}

<footer>
  <p>This page is regenerated from the repository and CI fails if it drifts, so
  a figure here is a figure that still draws. Coordinates are given, never
  computed &mdash; pensketch performs no layout and never measures text.</p>
</footer>

</div>
</body>
</html>
`;

const out = new URL('docs/showcase/index.html', root);
writeFileSync(out, page);
console.log(
  `PASS showcase: ${ORDER.length} figures, ${(page.length / 1024).toFixed(0)} KB, ${out.pathname.replace(root.pathname, '')}`,
);
