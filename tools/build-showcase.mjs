import { writeFileSync } from 'node:fs';
import { animateMarkup } from '../packages/animation/dist/index.js';
import { defaultTheme } from '../packages/core/dist/index.js';
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
// sees every figure drawn exactly as a visitor sees it.
//
// One exception, and it is the only request this page makes: the assistant's
// bundle, from a third-party CDN. Until 2026-09-18 the sentence above ended
// "and no request leaves the page", which the chat widget made false. The
// figures are still untouched by it - they draw with no network at all, so
// the file:// reader loses the assistant and nothing else. Self-hosting the
// bundle beside this file would restore the stronger claim and is a one-line
// change to STEWARD_SRC below.
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
    'What the extrusion is for: a flat drawing and a stack of slabs are the same data and one option apart. The one figure here drawn in flow order - it follows the story from the push instead of laying every box down first.',
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
 * alone. A diagram that names its own `order` keeps it - `'flow'` is a
 * different animation, and overriding it here is the dropped-option failure
 * the KNOWN tripwire above exists to prevent. The page then holds every element paused until its figure scrolls
 * into view - the gate and its reasons live beside the `.js` rule in the
 * stylesheet below. `label` goes on the wrapper as the accessible name,
 * which is where it belongs and not in the drawing.
 */
const svgFor = ({ diagram, viewBox, options }, name) => {
  const [minX, minY, width, height] = viewBox;
  const { seed, extrude, depth, hops, order } = options ?? {};
  const inner = renderToString(diagram, {
    ...(seed === undefined ? {} : { seed }),
    ...(extrude === undefined ? {} : { extrude }),
    ...(depth === undefined ? {} : { depth }),
    ...(hops === undefined ? {} : { hops }),
    order: order ?? true,
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" role="img"><title>${attr(name)}</title>${animateMarkup(inner)}</svg>`;
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
claude mcp add pensketch -- npx -y @pensketch/mcp@0.13.0
<span class="comment"># zero install, hosted: checks and SVG, no PNG</span>
claude mcp add --transport http pensketch https://pensketch.alpha-nu.workers.dev</code></pre>`;

/**
 * A four-pointed star as a closed polyline: four tips, and between each
 * neighbouring pair a quadratic bowed toward the centre, sampled into
 * points. `waist` is how far in the control point sits as a fraction of the
 * radius, and it is the whole character of the mark: at 0.1 the sides are
 * deeply concave and the points are points; by 0.16 the thing has puffed
 * into a cushion.
 *
 * Sampled rather than curved because the pen draws polylines. It jitters
 * every point it is given, so a curve handed over as a curve could not
 * wobble.
 */
const star = (cx, cy, r, waist, per = 7) => {
  const tips = [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = tips[i];
    const b = tips[(i + 1) % 4];
    const c = [
      cx + ((a[0] + b[0]) / 2 - cx) * waist * 2,
      cy + ((a[1] + b[1]) / 2 - cy) * waist * 2,
    ];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const u = 1 - t;
      pts.push([
        u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
        u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
      ]);
    }
  }
  return [...pts, pts[0]];
};

/**
 * The mark the assistant is asked for by, drawn by the library this page
 * exists to show rather than imported as a font icon or copied off a design
 * system.
 *
 * A speech bubble around the four-pointed star the industry has settled on
 * for "ask the model", so the mark says both halves of what the control
 * does instead of only the second.
 *
 * Drawn as five strokes rather than as a `rect` and a tail, because the
 * bottom edge has to be open where the tail leaves it. Closed, the tail
 * was a triangle parked under a box; open, the outline runs out of the
 * bottom edge, down to the point and back, which is the one line that
 * makes a bubble a bubble. The two bottom strokes each carry half the
 * tail for that reason, and every stroke overshoots its corner by about
 * 3px, which is what `rect` does for itself and the whole reason this
 * reads as drawn rather than as a div with a radius.
 *
 * It is the same renderer, the same seeded sequence and the same default
 * theme as every figure below it, which is why it carries no colours of its
 * own: the theme writes the `--ps-ink` and `--ps-pen` references into the
 * strokes, so the glyph follows the page into dark mode with nothing added
 * here. A mark for this page that was not drawn by this library would have
 * been the one picture on it making a claim the repository cannot back.
 *
 * Wider and shakier than a figure would be drawn, deliberately: at 40px a
 * 1.6px stroke with the default wobble resolves to a clean vector curve,
 * and the hand this page is selling disappears exactly where a reader first
 * meets it.
 */
const SPARK_BODY = renderToString(
  {
    raw: [
      (pen) => {
        const frame = { color: defaultTheme.ink, width: 2.4 };
        pen.stroke(
          [
            [5, 8],
            [95, 8],
          ],
          frame,
        );
        pen.stroke(
          [
            [92, 5],
            [92, 77],
          ],
          frame,
        );
        pen.stroke(
          [
            [95, 74],
            [50, 74],
            [26, 92],
          ],
          frame,
        );
        pen.stroke(
          [
            [26, 92],
            [30, 74],
            [5, 74],
          ],
          frame,
        );
        pen.stroke(
          [
            [8, 77],
            [8, 5],
          ],
          frame,
        );
        pen.stroke(star(55, 36.5, 18, 0.1), {
          color: defaultTheme.pen,
          width: 2.6,
          amplitude: 2.94,
        });
        pen.stroke(star(37, 54.5, 9, 0.1), {
          color: defaultTheme.pen,
          width: 2.39,
          amplitude: 2.05,
        });
      },
    ],
  },
  { seed: 3 },
);

const SPARK = `<svg viewBox="0 0 100 100" aria-hidden="true">${SPARK_BODY}</svg>`;

/**
 * Where the assistant's bundle comes from. The one URL this page fetches,
 * and the whole of the "no request leaves the page" exception in the header
 * above: point it at a copy beside this file and the exception goes away.
 */
const STEWARD_SRC = 'https://cdn.steward.link/steward-chat.min.js';

/**
 * The publishable key, baked in at build time because there is no server
 * here to set it at run time. Absent, the page still builds and the
 * assistant still renders; it just cannot authenticate, which the build
 * says out loud rather than leaving to be discovered in a console.
 *
 * `<` is escaped even though a key has no business containing one: the
 * value lands inside a `<script>` element, where a literal `</script>` in
 * any string ends the block early and takes the rest of the page with it.
 */
const STEWARD_PK = JSON.stringify(process.env.STEWARD_PK ?? '').replace(
  /</g,
  '\\u003c',
);

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
  /* The one colour on this page that is not from the palette, and
     deliberately so: the chat scrim is not a palette role, it is a shade
     cast over the deck, and it has to be dark in both themes. Mixed from
     --ps-ink it would have been, in the dark theme, a light haze poured
     over a dark page - a scrim that lightens is not a scrim. Warm rather
     than neutral, so on the cream paper it reads as shade and not as
     dirt. */
  --scrim: rgba(30, 26, 20, .46);
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
    --scrim: rgba(3, 5, 8, .66);
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

/* The way out to the source, riding every slide: fixed to the middle of
   the right edge, muted until wanted. */
.github {
  position: fixed;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  color: var(--ps-muted);
  opacity: 0.65;
}
.github:hover, .github:focus-visible { color: var(--ps-pen); opacity: 1; }
.github svg { display: block; width: 39px; height: 39px; fill: currentColor; }

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

/* The component blocks close the stylesheet, below every generic rule:
   their selectors outrank the spans, summaries and pres the page styles
   loosely above, and a sheet that descends in specificity is the lint
   failure that moved them here. The closing slide is addressed by class -
   its id stays for deep links, but an id in a selector outranks every
   class after it. */

/* The closing slide: the ask, made after the show has argued it. Same
   rhythm as a figure - number, heading, blurb - with the command where the
   drawing goes. */
.install pre {
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
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scroll-cue span {
  width: 27px;
  height: 27px;
  border-right: 4.5px solid var(--ps-muted);
  border-bottom: 4.5px solid var(--ps-muted);
  transform: rotate(45deg);
  animation: cue 2.6s ease-in-out infinite;
}
.scroll-cue span + span { margin-top: -18px; }
.scroll-cue span:nth-child(1) { --cue-k: 0.4; }
.scroll-cue span:nth-child(2) { --cue-k: 0.65; animation-delay: 0.18s; }
.scroll-cue span:nth-child(3) { --cue-k: 1; animation-delay: 0.36s; }
@keyframes cue {
  0%, 100% { opacity: calc(0.12 * var(--cue-k, 1)); transform: translateY(0) rotate(45deg); }
  50% { opacity: calc(0.72 * var(--cue-k, 1)); transform: translateY(8px) rotate(45deg); }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-cue span { animation: none; opacity: calc(0.5 * var(--cue-k, 1)); }
}

/* The assistant: a launcher, and the box a chat widget mounts into.

   Two pieces and no more. The embed takes its size, its surface, its type
   and its palette from the box, so those are declared here and nothing
   else is. Below the panel header this page draws nothing at all: the
   widget is the chat surface, and a drawn imitation of one would only be
   something to delete on the day it arrives.

   The star is drawn by the library rather than styled here, so it carries
   its own colour: the default theme writes the same --ps-pen reference into
   its stroke that every figure below is drawn with, and it follows the page
   into dark mode for free. Nothing on this rail sets a fill, and the hover
   is opacity alone. */

/* The launcher rides the same right edge as the way out to the source, one
   glyph above it. Both marks are 39px, so 65px between centres is one
   glyph and a 26px gap, and the github CTA keeps the position it was given
   rather than being shifted by a group that now has two members.
   Script-gated, like the reveal: without script the dialog cannot open,
   and a control that does nothing is worse than no control at all. */
.chat-launch {
  display: none;
  position: fixed;
  right: 22px;
  top: 50%;
  transform: translateY(calc(-50% - 65px));
  z-index: 10;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  opacity: 0.62;
  cursor: pointer;
}
.js .chat-launch { display: block; }
.chat-launch:hover, .chat-launch:focus-visible { opacity: 1; }
.chat-launch svg { display: block; width: 44px; height: 44px; }

/* A native dialog opened modally, so the focus trap, the Esc key and the
   inertness of the deck behind it are the platform's rather than ours.

   The dialog element is the scrim and the panel is its child, which looks
   like one div too many until you try the obvious thing: a gradient on
   ::backdrop needs the custom properties to inherit into it, that
   inheritance only arrived in 2023, and where it has not landed the whole
   declaration fails and the scrim disappears. Painted here it resolves
   everywhere.

   The scrim is a halo, not a blind. It holds full strength out to roughly
   the panel's own edge and is gone before the corners, so the deck stays
   visible as context instead of being switched off, and the panel gets its
   separation from the darkest part of the gradient rather than from a
   shadow this page does not use. The first draft put the peak at dead
   centre, where the panel covers it, and spent the whole falloff on the
   part a reader can see: a wide grey smear, weakest exactly where the edge
   needed it. */
.chat-scrim {
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  opacity: 0;
  transition: opacity 0.2s ease, display 0.2s allow-discrete, overlay 0.2s allow-discrete;
  /* Declared here rather than on the panel because two things need the
     same rectangle: the panel, and the shade cast around it. */
  --panel-w: min(680px, calc(100vw - 44px));
  --panel-h: min(680px, calc(100svh - 96px));
}
.chat-scrim::backdrop { background: none; }
/* \`display\` belongs to the open rule and to no other: a dialog is
   display:none until it opens, and a bare \`display: flex\` on the element
   overrides that and leaves the panel sitting on the page from load. */
.chat-scrim[open] { display: flex; align-items: center; justify-content: center; opacity: 1; }
/* The deck behind is scroll-snapped, and a mandatory snap left running
   under a modal pulls the page out from under the reader on the first
   wheel event. */
html:has(.chat-scrim[open]) { overflow: hidden; }

/* The container, and everything this page has to say about the assistant:
   a box of a stated size, on the page's surface, in the page's type and
   palette. It has no header and no close control because the widget draws
   its own, and it has no drawn chat surface because the widget *is* the
   chat surface. There was a panel and a mount inside it until the chrome
   came off; with nothing between them they were one box described twice.

   Esc and a click on the scrim close it. Both are the dialog's, and both
   work with nothing focusable inside. */
.chat-panel {
  display: flex;
  flex-direction: column;
  /* Positioned so it paints over the shade: an absolutely positioned
     ::before outranks a static sibling in paint order whatever the source
     order says, and the panel would have come up underneath its own
     shadow. */
  position: relative;
  width: var(--panel-w);
  height: var(--panel-h);
  border: 1px solid var(--rule);
  border-radius: 2px;
  /* A frame, not a surface. The embed paints the surface, and since it
     paints it as glass, anything opaque here would be the thing its
     backdrop blur found - the deck would never show through and the glass
     would come out as a flat tint. */
  background: none;
  /* The shade, in the panel's own shape because it is cast by the panel.
     Two earlier attempts and what each got wrong: a radial gradient is an
     ellipse by definition, so it could only ever draw a circle around a
     square box; a blurred rectangle behind the panel had the right shape
     but sat *under* the glass, and a flat scrim is all the backdrop blur
     then had to work with, which is a grey card rather than a pane.

     An outer box-shadow is the one that is clipped to outside the border
     box, so it is a halo and nothing more: the deck itself is what shows
     through the glass. No drop shadow lives anywhere else on this page;
     this is the scrim the panel was always meant to have, drawn by the
     thing that casts it. */
  box-shadow: 0 0 112px 40px var(--scrim);
  color: var(--ps-ink);
  font: 400 16px/1.6 var(--serif);
  overflow: hidden;
  opacity: 1;
  transform: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

/* The embed, filling the container it was handed. It sets no size of its
   own in embedded mode, which is why this says the size twice: the panel
   has the definite height, and the element resolves against it. */
steward-chat { display: block; width: 100%; height: 100%; }

/* On a phone the panel is the screen, less a margin wide enough to show
   that something is behind it. */
@media (max-width: 720px) {
  .chat-scrim { --panel-w: calc(100vw - 20px); --panel-h: calc(100svh - 40px); }
}

@starting-style {
  .chat-scrim[open] { opacity: 0; }
  .chat-scrim[open] .chat-panel { opacity: 0; transform: translateY(10px) scale(0.985); }
}
@media (prefers-reduced-motion: reduce) {
  .chat-scrim, .chat-panel { transition-duration: 0.01s; }
  .chat-scrim[open] .chat-panel { transform: none; }
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

<section class="fig install" id="install">
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
<a class="github" href="https://github.com/alpha-nu/pensketch" aria-label="pensketch on GitHub">
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
</a>
<button class="chat-launch" type="button" aria-haspopup="dialog" aria-label="Ask pensketch">${SPARK}</button>
<dialog class="chat-scrim" aria-label="Ask pensketch">
  <!-- The container the embed fills, and the only thing this page draws
       for the assistant. mode="embedded" is what stops the widget adding
       a launcher and positioning of its own: the rail already has one.
       theme="auto" follows the OS, as the page does. The title and tagline
       are set because the defaults name the vendor rather than this page,
       and a reader who clicked a pensketch mark should not be greeted by
       somebody else's product. -->
  <div class="chat-panel" id="pensketch-chat">
    <steward-chat
      mode="embedded"
      theme="auto"
      widget-title="Ask pensketch"
      tagline="Ask about the data model, the draw options, or any figure on this page."
    ></steward-chat>
  </div>
</dialog>
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

// The assistant. showModal() rather than an open attribute, because the
// focus trap, the Esc key and the inertness of the deck behind the panel
// all come with it and none of them is worth hand-writing. With nothing
// focusable inside, focus lands on the dialog itself, which is what keeps
// Esc working - so the container needs no close control of its own until
// the widget brings one.
//
// A click that lands on the dialog itself landed on the scrim: the panel
// is what fills the middle of it, and a click there stops at the panel.
const chat = document.querySelector('.chat-scrim');
document
  .querySelector('.chat-launch')
  .addEventListener('click', () => chat.showModal());
chat.addEventListener('click', (event) => {
  if (event.target === chat) chat.close();
});
</script>
<script>window.STEWARD_PK = ${STEWARD_PK}</script>
<script src="${STEWARD_SRC}"></script>
<script>
// The assistant's styling, handed over as tokens rather than as CSS: the
// widget renders into a shadow tree, so the page's cascade does not reach
// inside it and every value it needs has to be passed in. Each key becomes
// \`--steward-<key>\` on the widget's host.
//
// Read off the document rather than written out here, because the palette
// already exists on it and a second copy of seven colours is the drift the
// tokens module exists to prevent. Reading them resolved is also what makes
// one map serve both themes: the same names come back light or dark.
//
// Every key below is one the widget's own stylesheet reads, checked against
// it rather than taken on trust. That check was worth running: the first
// draft of this map set \`surface\`, \`muted\`, four \`radius-*\`, four
// \`shadow-*\` and three \`send-*\` keys, all of which the widget writes to its
// host and none of which its CSS ever reads. It looked configured and was
// inert. The live names are different - the panel colour is \`bg\` behind a
// \`panel-bg-alpha\`, the radius is one \`border-radius\`, the shadow is one
// \`panel-shadow\` - and the four \`svg-grad-*\` keys are what turn the
// widget's own star from its brand gold to this page's pen.
//
// That check has to be run per component, which the first pass of it was
// not: the widget nests a \`<steward-input>\` with its own shadow root and
// its own stylesheet, and four of the names it reads are invisible from
// the outer one. \`signature-hover\` and \`focus-rgb\` were dropped as inert
// on the outer evidence and are live in there; \`border-radius-sm\` and
// \`on-signature\` were never seen at all.
//
// Not everything reachable: a few inner shadows are written into the
// widget's CSS with literal values and no token in front of them, and its
// header carries a theme toggle this page does not want. Neither is
// addressable from out here.
(async () => {
  await customElements.whenDefined('steward-chat');
  const widget = document.querySelector('steward-chat');
  widget.apiKey = window.STEWARD_PK;

  const tok = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hexTriplet = (hex) => {
    const h = hex.replace('#', '');
    return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)]
      .map((p) => parseInt(p, 16))
      .join(', ');
  };

  const applyOverrides = () => {
    const ink = tok('--ps-ink');
    const muted = tok('--ps-muted');
    const signature = tok('--ps-pen');
    const alert = tok('--ps-accent');
    const surface = tok('--paper');
    const wash = tok('--ps-wash');
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;

    // Glass is the one part of this map that cannot be one setting read
    // twice, because the two themes make it out of opposite materials.
    //
    // In light the pane is the page's own cream and the blur is what does
    // the work: it smears the dark strokes behind into the cream and the
    // pane reads as frosted. In dark that mechanism is gone. The pane
    // colour and the deck are both \${surface}, so a pane tinted with it
    // over a deck painted with it is the deck, at any alpha - which is
    // what shipped, and what a pane with no visible edge looks like. The
    // widget's own stylesheet says so in a comment on its launcher: real
    // frosted glass scatters light, so dark glass should lighten what is
    // behind it rather than darken it.
    //
    // So the dark pane is the ground lifted a fifth of the way to the ink,
    // and the alpha and blur go up with it because the lift, not the blur,
    // is now what makes the pane visible. Measured over the message band
    // with a figure behind it: the pane sits at 3.5x the luminance of the
    // page ground where it shipped at 1.5x, and the ink holds 6.37:1
    // against the brightest pixel coming through where it held 5.80. The
    // deck pays a little for both - the band's spread falls from 0.025 to
    // 0.022 - because deck-through and legibility pull against each other
    // in dark in a way they do not in light: there the strokes behind are
    // brighter than the pane and punch up through it rather than down.
    // Alpha 0.65 buys 6.98:1 and was the first pick, but the figure behind
    // stops being readable and starts being a suggestion.
    //
    // The lift is not only for the glass: the widget's
    // \`prefers-reduced-transparency\` rule repaints the panel opaque in
    // \`bg\`, which in dark used to be the page colour exactly, leaving a
    // panel with nothing but a border. Lifted, that fallback is a surface.
    const glass = dark
      ? {
          bg: \`color-mix(in srgb, \${ink} 20%, \${surface})\`,
          'panel-bg-alpha': '0.55',
          'panel-blur': '14px',
          // White at half strength over a dark chip is the brightest thing
          // in the panel. The widget's own dark default is 0.12 for the
          // same reason.
          'glass-edge-light': '0.18',
        }
      : {
          bg: surface,
          'panel-bg-alpha': '0.35',
          'panel-blur': '10px',
          'glass-edge-light': '0.5',
        };

    // A lit pane costs every coloured text on it about a third of its
    // contrast, and the two that are not ink had none to spare: the pen
    // fell to 4.22:1 and the rust to 3.49, both under AA, on a page where
    // they clear it easily against the deck. So in dark the link is lifted
    // toward the ink until it clears - 70% of the pen reads 5.09 - and the
    // error bubble goes the other way, mixed from the page rather than from
    // the pane, which is the one surface in the panel that should be darker
    // than the glass it sits on and buys the rust 4.85 at full strength.
    const link = dark
      ? \`color-mix(in srgb, \${signature} 70%, \${ink})\`
      : signature;

    widget.overrides = {
      // Surfaces, and the glass. Each surface colour is mixed from \`bg\` by
      // its own alpha and sat behind its own backdrop blur, so the pair is
      // what decides whether a surface is paper or glass.
      //
      // The panel is the one that has to be let through for any of it to
      // show: the deck behind it is what the blur has to work on, which is
      // why the container around it stops painting paper and becomes a
      // frame. The scrim stays behind the panel rather than only around it,
      // so what comes through the glass is a dimmed deck rather than a
      // figure at full strength under running text.
      //
      // The pane itself, its alpha, its blur and its lit edge all come from
      // \`glass\` above, because all four are the theme's rather than the
      // map's.
      ...glass,
      'bg-secondary': wash,
      // Swept rather than guessed, twice over, because the first two
      // settings could not be seen at all. Cream at seven-tenths over cream
      // is still cream: on a light page the alpha is not what shows the
      // deck through, the blur is what hides it. Measured across a 664x238
      // band of the panel with a figure behind it, the backdrop's luminance
      // spread went 0.15 at a 24px blur, 0.25 at 16, and 0.44 at 10, with
      // the alpha moving it by a third of that. So: a small blur, and the
      // alpha set for legibility instead, which holds the ink above 7:1
      // against the worst pixel in that band.
      'bubble-bg-alpha': '0.62',
      'bubble-blur': '10px',
      'chip-bg-alpha': '0.55',
      'chip-blur': '10px',
      // Still no drop shadow. The panel's separation is the scrim's job,
      // and the scrim is a shape this page asked for rather than depth
      // borrowed from a material.
      'panel-shadow': 'none',
      'shadow-rgb': hexTriplet(ink),
      // Text, all of it the page's ink rather than the widget's near-black.
      //
      // The two bubble colours below are a correction. The audit that built
      // this map read them as inert, and the reason it was wrong is worth
      // keeping: \`<steward-message>\` and \`<steward-thinking>\` are
      // registered and not instantiated until a conversation exists, so
      // their stylesheets sit in no shadow root there is anything to dump.
      // Walking the live tree finds about thirty live names; constructing
      // every registered element first finds fifty-four. Everything in this
      // paragraph and the three below was in the missing half, which is to
      // say the panel has been rendering the vendor's colours in the places
      // only a reader with a conversation open would ever have seen.
      text: ink,
      'user-text': ink,
      'assistant-text': ink,
      primary: ink,
      'text-secondary': muted,
      'header-text': muted,
      // Links inside an answer, which were the widget's teal. \`primary\` does
      // not cover this: the widget reads a link as
      // \`var(--accent, var(--primary))\` and its own palette always sets the
      // accent, so the fallback never arrives.
      accent: link,
      // Code, as the page sets it: no fill, the mono face, the ink. The
      // widget's dark default is a near-black teal chip.
      'code-bg': 'transparent',
      'code-text': ink,
      'font-mono': tok('--mono'),
      // The rust, which this page spends on figure numbers and on the one
      // arrow that says "only from a tag". An error bubble is the one thing
      // in the panel it also belongs on.
      'error-text': alert,
      'error-bg': \`color-mix(in srgb, \${alert} 10%, \${surface})\`,
      border: tok('--rule'),
      // The pen, on everything the widget treats as its own colour. The
      // hover holds the same hue rather than lightening it, as the marks
      // on the rail do.
      signature,
      'signature-hover': signature,
      'on-signature': surface,
      // The reader's own message, as a tint rather than a fill. It was the
      // signature at full strength, which put ink on a saturated blue at
      // roughly 2:1 and was the one illegible thing in the panel. The fill
      // came down rather than the text going pale, which the owner settled
      // on seeing it: at 14% the page gains no filled surface it does not
      // have anywhere else. \`user-text\` would now take a pale ink instead -
      // it is live, and this map was wrong to call it inert - but that is
      // the filled bubble again, and it is not what was chosen.
      //
      // Tinted from the pane rather than from the page, so that the bubble
      // stays a shade of the surface it is sitting on. In dark those two
      // parted company when the pane lifted, and mixing from the page would
      // have made the reader's own message the one dark hole in a lit panel.
      // It costs the dark theme most of its headroom: composited over the
      // pane the ink reads 11.5:1 in light and 6.79 in dark, against 10.37
      // before the lift. Everything in the dark panel now lands in the same
      // band - pane 6.37, user bubble 6.79, assistant 6.92 - which is the
      // lit pane's price and is paid once rather than by one element.
      'user-bg': \`color-mix(in srgb, \${signature} 14%, \${glass.bg})\`,
      'assistant-bg': wash,
      'halo-rgb': hexTriplet(signature),
      'focus-rgb': hexTriplet(signature),
      'svg-grad-left-edge': signature,
      'svg-grad-left-mid': signature,
      'svg-grad-right-edge': signature,
      'svg-grad-right-mid': signature,
      // One radius token for the whole widget, the header's two, and the
      // composer's, which is read by the nested input rather than the
      // panel and would otherwise have kept the vendor's curve.
      'border-radius': '2px',
      'border-radius-sm': '2px',
      'header-btn-radius': '2px',
      'header-group-radius': '2px',
      // The composer at rest, against the widget's 40px. Asked for as a
      // multiple, and a multiple is the wrong unit above 120px: that is
      // where the textarea's own \`max-height\` stops it growing, and a
      // \`min-height\` larger than a \`max-height\` wins outright, so 4x
      // would have frozen the box and made it scroll from the first line
      // over. At 90px it is a composer that opens two lines and a quarter
      // deep and still grows the last line and a half before it scrolls.
      //
      // The earlier attempt at this adopted a stylesheet into the nested
      // input's shadow root, which the owner reverted and was right to:
      // the supported lever was a token on the host the whole time.
      'input-height': '90px',
      'font-family': 'Charter, "Iowan Old Style", Georgia, serif',
      'font-size': '16px',
      'line-height': '1.6',
    };
  };

  applyOverrides();
  // The tokens are read already resolved, so a scheme change cannot be
  // recomputed from what was read before: it has to be read again.
  matchMedia('(prefers-color-scheme: dark)').addEventListener(
    'change',
    applyOverrides,
  );

  // The rail is the widget's launcher, so its open state follows the
  // dialog's. Both halves of that are needed: embedded mode draws no
  // launcher of its own, and the widget draws no panel at all until it is
  // opened, which is why the container came up empty before this.
  //
  // Watched rather than wired to the button, so it holds however the
  // dialog was opened or closed - Esc, a click on the scrim, or a call
  // from anywhere else - and does not depend on which of two scripts
  // registered its click listener first.
  const dialog = document.querySelector('.chat-scrim');
  const sync = () => (dialog.open ? widget.open() : widget.close());
  new MutationObserver(sync).observe(dialog, { attributeFilter: ['open'] });
  sync();

  // And the other direction: the widget's header has a close control of its
  // own, which only closes the widget. Left alone it emptied the container
  // and left the scrim up over a blank box.
  widget.addEventListener('steward-open-change', (event) => {
    if (!event.detail.open) dialog.close();
  });
})();
</script>
</body>
</html>
`;

const out = new URL('docs/showcase/index.html', root);
writeFileSync(out, page);
console.log(
  `PASS showcase: ${ORDER.length} figures, ${(page.length / 1024).toFixed(0)} KB, ${out.pathname.replace(root.pathname, '')}`,
);
// A page built without the key is a page whose assistant cannot
// authenticate. Said here rather than left to a console on the deployed
// site, and a warning rather than a failure: every other reason to run
// this generator is unrelated to the chat.
if (!process.env.STEWARD_PK)
  console.warn(
    'WARN showcase: STEWARD_PK is unset, so the assistant will load and fail to authenticate. Set it in the environment that builds the page.',
  );
