import { existsSync } from 'node:fs';
import { shippedDiagrams } from './shipped-diagrams.mjs';

// Runs the published checker over every diagram this repository ships. The
// project that writes the rules is the first thing held to them: rules their
// own author's diagrams break are rules nobody else will keep either.
//
// Loading them is `shipped-diagrams.mjs`, shared with the generator that
// serves the same diagrams to agents as examples.
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

const shipped = await shippedDiagrams();

let errors = 0;
let warnings = 0;

for (const { name, diagram, options, viewBox } of shipped) {
  if (!viewBox)
    throw new Error(`${name}: no viewBox found, so out-of-bounds cannot run`);

  // The page's own options, so a diagram drawn extruded is measured extruded.
  // Checking it flat would report a different picture from the one the page
  // renders - a slab crossing the frame would pass here and clip there, which
  // is the exact defect `depth` taught the checker to find.
  //
  // Spread whole rather than picked apart: `DrawOptions` and `CheckOptions`
  // share `extrude` and `depth` and nothing else, so the pair arrives and the
  // rest - `seed`, `theme`, `label`, `hops`, `order` - is inert here. The
  // frame comes last because it is read off the `<svg>` the page declares and
  // no page passes one to `draw`.
  const findings = check(diagram, { ...options, viewBox });
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
