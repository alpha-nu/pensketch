import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { serialize } from '../packages/core/test/serialize.mjs';

// Goldens are produced from the reference implementation and from nothing
// else: they are what the port is measured against, so deriving them from the
// port would make every parity test a tautology.
const root = new URL('../', import.meta.url);
const reference = new URL('reference/renderer.html', root);
const goldens = new URL('packages/core/test/goldens/', root);

const TARGETS = [
  { id: 'sampler', file: 'sampler.seed7.svg.txt' },
  { id: 'budgets', file: 'budgets.seed11.svg.txt' },
];

function fail(message) {
  console.error(`FAIL generate-goldens: ${message}`);
  process.exit(1);
}

if (!existsSync(reference)) fail(`${reference.pathname} is missing`);

// The reference draws both diagrams from an inline script, which only runs
// with scripting enabled. It is our own local file, not remote content.
const dom = new JSDOM(readFileSync(reference, 'utf8'), {
  runScripts: 'dangerously',
});

// Serialize every target before writing any of them, so a reference that
// satisfies the first target and fails the second cannot leave one golden
// rewritten and the other stale.
const rendered = TARGETS.map(({ id, file }) => {
  const svg = dom.window.document.getElementById(id);
  if (!svg) fail(`the reference has no element with id "${id}"`);
  const body = serialize(svg);
  // Empty output means the reference's script did not draw: writing that out
  // would quietly replace the contract with nothing.
  if (body === '') fail(`the reference drew nothing into "${id}"`);
  return { file, body };
});

mkdirSync(goldens, { recursive: true });

for (const { file, body } of rendered) {
  // The trailing newline is the file's, not the serializer's: it keeps the
  // golden a well-formed text file, and the parity tests add it back before
  // comparing.
  writeFileSync(new URL(file, goldens), `${body}\n`);
  console.log(`wrote ${file} (${body.split('\n').length} elements)`);
}
