import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as barrel from '../src/index';

// Path joins rather than `new URL()`: the bundler rewrites a `new URL()`
// against `import.meta.url` into an asset URL of its own, which no longer
// names a file on disk.
const manifest: {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
} = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
    'utf8',
  ),
);

// Equality, not containment: an export added by accident is as much a breach
// of the contract as one missing, and only the package can remove it again
// once it has shipped.
describe('the public surface is closed', () => {
  it('exports exactly the documented names and nothing else', () => {
    expect(Object.keys(barrel).sort()).toEqual(['PenSketch', 'useSketch']);
  });
});

describe('the dependency shape', () => {
  // Core is a peer, not a dependency: the bindings render through whichever
  // copy the application already has. Owning one instead would let an app
  // hold two renderers whose output for the same seed disagrees.
  it('takes no regular dependency at all', () => {
    expect(manifest.dependencies).toBeUndefined();
  });

  // The shape, not the ranges: the release's own version bump rewrites the
  // core range, and asserting it literally makes every release fail its own
  // tests.
  it('peers on core and on react, and nothing else', () => {
    expect(Object.keys(manifest.peerDependencies ?? {}).sort()).toEqual([
      '@pensketch/core',
      'react',
    ]);
    expect(manifest.peerDependencies?.react).toBe('^18 || ^19');
  });

  // The core peer states API compatibility, so it is deliberately wider than
  // a caret range: a core minor must not drag these bindings to a new major
  // for a range rewrite that changes nothing. Wide, but not open-ended.
  //
  // It stays wide even though a core minor may now remove a published name -
  // which is what the release rules classify as a break. A range cannot say
  // "compatible until a name goes", so narrowing it would refuse every future
  // minor in advance against the chance that one of them removes something
  // these bindings call. They call `draw` and `pen`, and CI runs this suite
  // against the core in the same tree, so a removal that reached them fails in
  // the commit that removed it rather than at a consumer's install.
  //
  // `onlyUpdatePeerDependentsWhenOutOfRange` leaves it alone while core stays
  // inside it, which is why it still reads as written. The day core takes a
  // major, changesets rewrites it — and it rewrites by leading operator plus
  // version, so `>=0.0.1 <1.0.0` would come back as `>=1.0.0` and the bindings
  // would claim to work with every core ever published. This is that alarm.
  it('bounds the core peer above', () => {
    const range = manifest.peerDependencies?.['@pensketch/core'] ?? '';
    expect(range).toMatch(/^[\^~]\d+\.\d+\.\d+$|<\s*\d/);
  });

  // react-dom is a root dev dependency the tests render with; the package
  // itself must never ask a consumer for it.
  it('never mentions react-dom', () => {
    expect(JSON.stringify(manifest)).not.toContain('react-dom');
  });
});
