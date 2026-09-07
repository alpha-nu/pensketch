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

  // The shape check above says the range survives a rewrite. It says nothing
  // about the range being *right*, and the two came apart when `shape` went
  // optional: an mcp serving the relaxed schema against a core that predates
  // the default answers a node omitting the field with
  // `unknown shape "undefined"`. `changeset version` does move the floor on a
  // minor, so the mechanism is sound - what was missing is anything that
  // notices when it does not, and a hand-edited range or a publish of one
  // package without the other goes red nowhere.
  //
  // The workspace copy is what this server is built and tested against, so
  // it is the floor the published range has to admit.
  it.each(internal)('declares a floor %s can actually satisfy', (name) => {
    const range = manifest.dependencies?.[name] ?? '';
    const floor = range.slice(1).split('.').map(Number);
    const built = (
      JSON.parse(
        readFileSync(
          join(
            dirname(fileURLToPath(import.meta.url)),
            '..',
            '..',
            name.split('/')[1] ?? '',
            'package.json',
          ),
          'utf8',
        ),
      ) as { version: string }
    ).version
      .split('.')
      .map(Number);

    expect(floor).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const declared = floor[i] ?? 0;
      const actual = built[i] ?? 0;
      if (declared !== actual) {
        expect(declared).toBeGreaterThan(actual);
        return;
      }
    }
  });
});
