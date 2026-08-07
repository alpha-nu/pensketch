import { existsSync, readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { HERO, HERO_VIEW_BOX } from './hero-diagram.mjs';

// Runs the published checker over every diagram this repository ships. The
// project that writes the rules is the first thing held to them: rules their
// own author's diagrams break are rules nobody else will keep either.
//
// The diagrams are not modules. Two of them live inside self-contained HTML
// pages, deliberately - an example you can open with no build step is worth
// more than one that is easy for this tool to read - so the pages are run
// with `draw` recording its argument instead of drawing it. Nothing is
// parsed or pattern-matched out of the source: what gets checked is what the
// page actually passes.
//
// Run locally after `npm run build`: `npm run diagrams`.

const root = new URL('../', import.meta.url);

const CHECKER = new URL('packages/core/dist/check.js', root);
if (!existsSync(CHECKER)) {
  console.error(
    'FAIL packages/core/dist/check.js is missing - run `npm run build`',
  );
  process.exit(1);
}
const { check } = await import(CHECKER.href);

const read = (file) => readFileSync(new URL(file, root), 'utf8');

// `draw` records rather than draws, `pen` swallows whatever it is asked to
// do, and `document` hands back an object that knows only its own id - which
// is all that is needed to find the `<svg>` a diagram was drawn into.
const PRELUDE = `
const draw = (target, diagram, options) => {
  globalThis.__shots.push({ id: target.id, diagram, options });
};
const pen = () => new Proxy({}, { get: () => () => 0 });
`;

globalThis.document = { getElementById: (id) => ({ id }) };

const run = async (code) => {
  await import(`data:text/javascript,${encodeURIComponent(code)}`);
};

/** The `viewBox` of the `<svg>` with this id, as four numbers. */
const viewBoxOf = (html, id) => {
  const tag = html.match(new RegExp(`<svg[^>]*id="${id}"[^>]*>`))?.[0];
  const box = tag?.match(/viewBox="([^"]+)"/)?.[1];
  return box?.trim().split(/\s+/).map(Number);
};

/** Every diagram an HTML example draws, with the frame it is drawn into. */
const fromHtml = async (file) => {
  const html = read(file);
  globalThis.__shots = [];
  for (const [, code] of html.matchAll(
    /<script type="module">([\s\S]*?)<\/script>/g,
  )) {
    // The import line is the page's only tie to the build; everything the
    // page then calls comes from the prelude instead.
    await run(PRELUDE + code.replace(/^\s*import\s[^;]*;.*$/gm, ''));
  }
  if (!globalThis.__shots.length)
    throw new Error(
      `${file} drew nothing - has its script tag or import changed?`,
    );
  return globalThis.__shots.map(({ id, diagram }) => ({
    name: `${file} #${id}`,
    diagram,
    viewBox: viewBoxOf(html, id),
  }));
};

/** The React example keeps its diagram in a TypeScript module of its own. */
const fromReact = async () => {
  const source = read('examples/react/src/oauth.ts');
  const { code } = await transform(source, { loader: 'ts' });
  const { OAUTH } = await import(
    `data:text/javascript,${encodeURIComponent(code)}`
  );
  return [
    {
      name: 'examples/react/src/oauth.ts',
      diagram: OAUTH,
      viewBox: read('examples/react/src/App.tsx')
        .match(/viewBox="([^"]+)"/)?.[1]
        .trim()
        .split(/\s+/)
        .map(Number),
    },
  ];
};

const shipped = [
  ...(await fromHtml('examples/vanilla/index.html')),
  ...(await fromHtml('examples/custom-pen/index.html')),
  ...(await fromReact()),
  { name: 'docs/assets/hero', diagram: HERO, viewBox: HERO_VIEW_BOX },
];

let errors = 0;
let warnings = 0;

for (const { name, diagram, viewBox } of shipped) {
  if (!viewBox)
    throw new Error(`${name}: no viewBox found, so out-of-bounds cannot run`);

  const findings = check(diagram, { viewBox });
  errors += findings.filter((f) => f.severity === 'error').length;
  warnings += findings.filter((f) => f.severity === 'warning').length;

  console.log(
    `${findings.some((f) => f.severity === 'error') ? 'FAIL' : 'PASS'} ${name} (${findings.length || 'no'} findings)`,
  );
  for (const f of findings)
    console.log(
      `  ${f.severity} ${f.rule} at (${f.at.join(', ')}): ${f.message}`,
    );
}

console.log(
  `\n${errors} errors, ${warnings} warnings across ${shipped.length} diagrams`,
);

// Warnings are reported and do not fail: `orphan-node` fires on a legend and
// `text-overflow` is an estimate, and a gate that cries wolf gets removed.
if (errors) {
  process.exit(1);
}
