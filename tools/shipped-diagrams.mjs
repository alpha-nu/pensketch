import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { HERO, HERO_VIEW_BOX } from './hero-diagram.mjs';

// Every diagram this repository ships, loaded as data. Two things need this
// and neither should own it: the checker that holds these diagrams to the
// rules the project publishes, and the generator that serves them to agents
// as examples.
//
// They are not all modules. Most live inside self-contained HTML pages,
// deliberately — an example you can open with no build step is worth more
// than one that is easy to read from a script — so the pages are executed
// with `draw` recording its argument instead of drawing it. Nothing is parsed
// or pattern-matched out of the source: what comes back is what the page
// actually passes.

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

// `draw` records rather than draws, `pen` swallows whatever it is asked to
// do, `animate` has nothing to decorate, and `document` hands back an object
// that knows only its own id and has no children — which is all that is
// needed to find the `<svg>` a diagram was drawn into and to leave whatever a
// page measures off its own output reading zero.
//
// A page looking for a set of elements finds none, so the chrome a page hangs
// off what it drew — a scroll trigger, a replay button — is skipped here
// rather than faked. That is the line: this stands in for the browser far
// enough to collect what a page passes to `draw`, and no further.
const PRELUDE = `
const draw = (target, diagram, options) => {
  globalThis.__shots.push({ id: target.id, diagram, options });
};
const pen = () => new Proxy({}, { get: () => () => 0 });
const animate = () => {};
`;

const viewBoxOf = (html, id) => {
  const tag = html.match(new RegExp(`<svg[^>]*id="${id}"[^>]*>`))?.[0];
  return tag
    ?.match(/viewBox="([^"]+)"/)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
};

const fromHtml = async (file) => {
  const html = read(file);
  globalThis.document = {
    getElementById: (id) => ({ id, children: [] }),
    querySelectorAll: () => [],
  };
  globalThis.__shots = [];
  for (const [, code] of html.matchAll(
    /<script type="module">([\s\S]*?)<\/script>/g,
  )) {
    // The import line is the page's only tie to the build; everything the
    // page then calls comes from the prelude instead.
    await import(
      `data:text/javascript,${encodeURIComponent(PRELUDE + code.replace(/^\s*import\s[^;]*;.*$/gm, ''))}`
    );
  }
  if (!globalThis.__shots.length)
    throw new Error(
      `${file} drew nothing - has its script tag or import changed?`,
    );
  // The third argument travels with the first two. A page that extrudes says
  // so in its options and nowhere else, so a loader that keeps the diagram and
  // drops the options hands its callers a picture the page does not draw:
  // measured flat where the page draws slabs, and served to an agent without
  // the pair that made it look like that. `{}` where a page passed none, so
  // every caller can spread it without asking.
  return globalThis.__shots.map(({ id, diagram, options }) => ({
    key: id,
    name: `${file} #${id}`,
    diagram,
    options: options ?? {},
    viewBox: viewBoxOf(html, id),
  }));
};

// Which stage the served copy of the React example is drawn at. The middle
// one, where all three of the things the stage decides are visible at once:
// an accented node, shaded stages behind it, and arrows both taken and untaken.
const SERVED_STAGE = 2;

// The React example draws a diagram computed from application state, so there
// is no single object to import - and no stage that stands for the rest.
// Every one of them is loaded, so every one of them is checked: a picture
// correct only at stage 3 is a picture this repository would ship broken four
// times out of five. Only one carries a `key`, and that one is served as a
// resource; the rest carry a name and nothing else, because a name is for a
// report and a key is for a URI.
//
// The frame comes from the module too, rather than out of `App.tsx` by
// regular expression: the page and the checker read the same export.
const fromReact = async () => {
  const { code } = await transform(read('examples/react/src/incident.ts'), {
    loader: 'ts',
  });
  const { STAGES, VIEW_BOX, incident } = await import(
    `data:text/javascript,${encodeURIComponent(code)}`
  );
  const viewBox = VIEW_BOX.trim().split(/\s+/).map(Number);
  return STAGES.map((label, i) => ({
    ...(i === SERVED_STAGE ? { key: 'incident' } : {}),
    name: `examples/react/src/incident.ts at "${label}"`,
    diagram: incident(i),
    // Empty, and it is a fact about the bindings rather than a gap here.
    // `PenSketchProps` takes `animate`, `diagram`, `seed` and `theme`; there
    // is no `extrude` and no `depth` on it, so this page cannot pass a pair
    // and there is none to read off the module the way the frame is. If the
    // bindings grow one, it belongs beside `VIEW_BOX` in `incident.ts` and is
    // read from there, so the page and the checker go on reading one export.
    options: {},
    viewBox,
  }));
};

/**
 * Every shipped diagram, with the frame it is drawn into and the options it
 * is drawn with. The options are what the page passed `draw`, which is where
 * `extrude` and `depth` live: a caller measuring or serving one of these has
 * to carry them or it is describing a different picture.
 */
export async function shippedDiagrams() {
  const all = [
    ...(await fromHtml('examples/vanilla/index.html')),
    ...(await fromHtml('examples/custom-pen/index.html')),
    ...(await fromHtml('examples/state-machine/index.html')),
    ...(await fromHtml('examples/showcase/index.html')),
    // Five panels of one explanation, each drawn from its own object. All of
    // them are loaded for the same reason every stage of the React example is:
    // a page ships as many diagrams as it holds, and one of them being right
    // says nothing about the other four.
    ...(await fromHtml('examples/animation/index.html')),
    ...(await fromReact()),
    {
      key: 'hero',
      name: 'docs/assets/hero',
      diagram: HERO,
      options: {},
      viewBox: HERO_VIEW_BOX,
    },
  ];
  for (const { name, viewBox } of all)
    if (!viewBox)
      throw new Error(`${name}: no viewBox found, so out-of-bounds cannot run`);
  return all;
}
