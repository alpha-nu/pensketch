import { mkdirSync, writeFileSync } from 'node:fs';
import { createGenerator } from 'ts-json-schema-generator';

// Generates the JSON Schema for a diagram from the TypeScript types, so the
// two cannot drift: the schema is derived from `Diagram` rather than written
// alongside it. Regenerated in CI, where the tree is then asserted unchanged.
//
// It is written inside the package rather than at the repository root because
// it ships: npm packs nothing from outside a package directory, and a schema
// callers cannot install is a schema they will copy and let go stale.
//
// Run locally: `npm run schema`.

const root = new URL('../', import.meta.url);
const out = new URL('packages/core/schema/diagram.schema.json', root);

function fail(message) {
  console.error(`FAIL generate-schema: ${message}`);
  process.exit(1);
}

let schema;
try {
  schema = createGenerator({
    path: new URL('tools/schema-type.ts', root).pathname,
    tsconfig: new URL('tsconfig.base.json', root).pathname,
    type: 'PensketchDiagram',
    // A diagram with an unknown key is a typo, and saying so is most of the
    // value here: the types already reject one, and a caller writing JSON
    // has nothing else to catch it.
    additionalProperties: false,
    topRef: false,
  }).createSchema('PensketchDiagram');
} catch (error) {
  fail(error.message);
}

// `raw` is deliberately absent - see tools/schema-type.ts. Asserted rather
// than assumed, because it would return silently if the type were ever
// widened back.
if (schema.properties?.raw) {
  fail('`raw` reached the schema; it holds functions and cannot be JSON');
}
for (const required of ['nodes', 'edges', 'notes']) {
  if (!schema.properties?.[required]) fail(`the schema lost \`${required}\``);
}

schema.title = 'Pensketch diagram';
schema.description =
  'A hand-sketched diagram as plain data. Coordinates are given, never ' +
  'computed: pensketch performs no layout and never measures text, so a box ' +
  'does not grow to fit its label. The `raw` escape hatch is absent because ' +
  'it holds functions, which JSON cannot carry.';

mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, `${JSON.stringify(schema, null, 2)}\n`);
const count = Object.keys(schema.definitions ?? {}).length;
console.log(
  `wrote packages/core/schema/diagram.schema.json (${count} definitions)`,
);
