import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Path joins rather than `new URL()`: the bundler rewrites a `new URL()`
// against `import.meta.url` into an asset URL of its own, which no longer
// names a file on disk.
const manifest: {
  dependencies?: Record<string, string>;
} = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
    'utf8',
  ),
);

describe('the range this server declares on core', () => {
  // Not the literal range - the release's own version bump rewrites it, and
  // asserting it literally makes every release fail its own tests. The shape
  // is the contract, because the shape is what survives the rewrite.
  //
  // Changesets replaces an internal range with its leading operator plus the
  // new version, and it reads that operator from the first two characters.
  // A compound range therefore loses everything after them: `>=0.0.1 <1.0.0`
  // comes back as `>=0.1.0`, which accepts a core major this server was never
  // built against. Caret and tilde carry their upper bound in the operator, so
  // they survive intact.
  it('is bounded above, in a form the version bump cannot flatten', () => {
    const range = manifest.dependencies?.['@pensketch/core'];
    expect(range).toMatch(/^[\^~]\d+\.\d+\.\d+$/);
  });
});
