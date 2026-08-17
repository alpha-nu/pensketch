import { readdirSync, readFileSync } from 'node:fs';
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

// The `animate` prop takes a function from a package this one declares no
// relationship with, and the requirement is a literal one: the manifest, the
// source and the published types are searched for the name, and none of them
// carries it. A structural type is how that is possible; this is what keeps it
// true, because the way it breaks is not an import.
//
// It broke exactly that way once. The name went into the prop's doc comment -
// prose and a usage example, never a specifier - and rode into `index.d.ts`,
// `index.d.cts` and both sourcemaps, all four of which this package publishes.
// Nothing failed: not tsc, which never resolves a comment, not the build, not
// `npm run exports`. Where the name belongs is the README, beside the two
// peers that are declared, and it is there.
//
// Source rather than `dist/`, because the suite deliberately never loads built
// output - but every published file derives from these, so a name absent here
// cannot appear there.
describe('the motion is not named here', () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

  // The directory, not a list. A hand-written list of the three files here
  // today is a list a fourth source file escapes, silently, in the commit that
  // adds it - and the way this requirement broke was a doc comment, which is
  // the kind of thing a new file arrives carrying. `packages/animation`'s own
  // manifest test reads its `src/` the same way.
  it.each(readdirSync(src))(
    '%s does not name the animation package',
    (file) => {
      expect(readFileSync(join(src, file), 'utf8')).not.toContain(
        '@pensketch/animation',
      );
    },
  );

  it('is not in the manifest either, in any position', () => {
    expect(JSON.stringify(manifest)).not.toContain('@pensketch/animation');
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
