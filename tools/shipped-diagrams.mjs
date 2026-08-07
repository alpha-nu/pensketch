import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { HERO, HERO_VIEW_BOX } from './hero-diagram.mjs';

// Every diagram this repository ships, loaded as data. Two things need this
// and neither should own it: the checker that holds these diagrams to the
// rules the project publishes, and the generator that serves them to agents
// as examples.
//
// They are not modules. Two live inside self-contained HTML pages,
// deliberately — an example you can open with no build step is worth more
// than one that is easy to read from a script — so the pages are executed
// with `draw` recording its argument instead of drawing it. Nothing is parsed
// or pattern-matched out of the source: what comes back is what the page
// actually passes.

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

// `draw` records rather than draws, `pen` swallows whatever it is asked to
// do, and `document` hands back an object that knows only its own id — which
// is all that is needed to find the `<svg>` a diagram was drawn into.
const PRELUDE = `
const draw = (target, diagram, options) => {
  globalThis.__shots.push({ id: target.id, diagram, options });
};
const pen = () => new Proxy({}, { get: () => () => 0 });
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
  globalThis.document = { getElementById: (id) => ({ id }) };
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
  return globalThis.__shots.map(({ id, diagram }) => ({
    key: id,
    name: `${file} #${id}`,
    diagram,
    viewBox: viewBoxOf(html, id),
  }));
};

const fromReact = async () => {
  const { code } = await transform(read('examples/react/src/oauth.ts'), {
    loader: 'ts',
  });
  const { OAUTH } = await import(
    `data:text/javascript,${encodeURIComponent(code)}`
  );
  return [
    {
      key: 'oauth',
      name: 'examples/react/src/oauth.ts',
      diagram: OAUTH,
      viewBox: read('examples/react/src/App.tsx')
        .match(/viewBox="([^"]+)"/)?.[1]
        ?.trim()
        .split(/\s+/)
        .map(Number),
    },
  ];
};

/** Every shipped diagram, with the frame it is drawn into. */
export async function shippedDiagrams() {
  const all = [
    ...(await fromHtml('examples/vanilla/index.html')),
    ...(await fromHtml('examples/custom-pen/index.html')),
    ...(await fromReact()),
    {
      key: 'hero',
      name: 'docs/assets/hero',
      diagram: HERO,
      viewBox: HERO_VIEW_BOX,
    },
  ];
  for (const { name, viewBox } of all)
    if (!viewBox)
      throw new Error(`${name}: no viewBox found, so out-of-bounds cannot run`);
  return all;
}
