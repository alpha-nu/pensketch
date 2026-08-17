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

describe('the ranges this server declares on its own packages', () => {
  const internal = Object.keys(manifest.dependencies ?? {}).filter((name) =>
    name.startsWith('@pensketch/'),
  );

  // Which packages they are is held closed by core's manifest suite, and a
  // second copy of that list here would be a second thing to remember. All
  // this needs is that there is at least one, so that the cases below cannot
  // quietly become none and pass by having nothing to check.
  it('declares at least one, so the shape check below is not vacuous', () => {
    expect(internal.length).toBeGreaterThan(0);
  });

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
  it.each(internal)(
    'bounds %s above, in a form the version bump cannot flatten',
    (name) => {
      expect(manifest.dependencies?.[name]).toMatch(/^[\^~]\d+\.\d+\.\d+$/);
    },
  );
});
