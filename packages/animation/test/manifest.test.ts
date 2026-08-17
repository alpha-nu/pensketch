import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as barrel from '../src/index';

// Path joins rather than `new URL()`: the bundler rewrites a `new URL()`
// against `import.meta.url` into an asset URL of its own, which no longer
// names a file on disk.
const here = dirname(fileURLToPath(import.meta.url));

const manifest: {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
} = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

// Equality, not containment: an export added by accident is as much a breach
// of the contract as one missing, and only the package can remove it again
// once it has shipped.
describe('the public surface is closed', () => {
  it('exports exactly the documented names and nothing else', () => {
    expect(Object.keys(barrel).sort()).toEqual([
      'animate',
      'animateMarkup',
      'rules',
    ]);
  });
});

describe('the dependency shape', () => {
  // Core is a peer, not a dependency, for the reason the react bindings
  // already record: a package that owned its own copy of the renderer would
  // let one application hold two whose output for the same diagram and seed
  // disagrees, and a package manager resolves that silently. This package
  // does not even call core - it reads what core wrote - but it is useless
  // against a core that wrote nothing, which is what the range is for.
  it('takes no regular dependency at all', () => {
    expect(manifest.dependencies).toBeUndefined();
  });

  it('peers on core, and on nothing else', () => {
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([
      '@pensketch/core',
    ]);
  });

  // The shape, not the literal range: the release's own version bump may
  // rewrite it, and asserting it literally makes every release fail its own
  // tests. What has to hold is the upper bound. Changesets rewrites a range by
  // its leading operator plus the new version, reading that operator from the
  // first two characters, so the day core takes a major `>=0.5.0 <1.0.0` would
  // come back as `>=1.0.0` and this package would claim to work with every
  // core ever published. This is that alarm.
  //
  // `onlyUpdatePeerDependentsWhenOutOfRange` leaves the range alone while core
  // stays inside it, which is why a compound range may stand here at all.
  //
  it('bounds the core peer above', () => {
    const range = manifest.peerDependencies?.['@pensketch/core'] ?? '';
    expect(range).toMatch(/^[\^~]\d+\.\d+\.\d+$|<\s*\d/);
  });

  // The floor is the other half, and it cannot be written yet. A range open
  // below the minor that ships `order` admits a core that stamps no `--ps-i`, and
  // that install is the version skew nothing here can detect at runtime - so
  // the floor is what T-05 asks for. It is unwritable today, and the reason is
  // measured rather than argued: 0.5.0 is the newest core the registry has, so
  // `>=0.6.0 <1.0.0` fails a cold `npm install` with ETARGET and writes no
  // lockfile at all, leaving `npm ci` - which is what CI runs - nothing to run
  // from. `--legacy-peer-deps` writes one, and `npm ci` fails against it too.
  //
  // What makes the floor writable is core carrying it: with 0.6.0 in the tree
  // npm satisfies the peer from the workspace link and never asks the
  // registry, so the raise and the release that makes it installable are the
  // same commit. This asserts that pairing rather than the range, and so goes
  // red in exactly that commit and never before. `onlyUpdatePeerDependents-
  // WhenOutOfRange` will not do it for you: 0.6.0 satisfies `>=0.5.0`, so
  // changesets leaves this range exactly as written.
  it('floors the core peer at the minor that ships `order`, once there is one', () => {
    const core = JSON.parse(
      readFileSync(join(here, '..', '..', 'core', 'package.json'), 'utf8'),
    ) as { version: string };
    const [, major = '', minor = ''] =
      /^(\d+)\.(\d+)\./.exec(core.version) ?? [];
    const shipsOrder = Number(major) > 0 || Number(minor) >= 6;
    if (!shipsOrder) return;

    const range = manifest.peerDependencies?.['@pensketch/core'] ?? '';
    const [, floorMajor = '', floorMinor = ''] =
      /^>=(\d+)\.(\d+)\./.exec(range) ?? [];
    expect(
      Number(floorMajor) > 0 || Number(floorMinor) >= 6,
      `core is ${core.version}, so the peer floor must be at least 0.6.0 - the minor that ships \`order\` - but the range reads "${range}"`,
    ).toBe(true);
  });

  // The motion is CSS. Nothing from this package runs while a diagram draws,
  // so nothing here may reach for a framework to run it with.
  it('never asks a consumer for react', () => {
    expect(JSON.stringify(manifest)).not.toContain('react');
  });
});

// The requirement is that the browser does the drawing and this package only
// writes the rules. That is a claim about what the source may contain, not
// about what any one call does - a per-element loop would satisfy every other
// test in this suite and still break it - so it is asserted over the source
// itself. Read from disk rather than imported: a callback scheduled inside a
// function nothing calls would be invisible to an import.
describe('nothing runs per frame', () => {
  const SCHEDULERS =
    /\brequestAnimationFrame\b|\bsetTimeout\b|\bsetInterval\b|\bqueueMicrotask\b|\bgetTotalLength\b/;

  it('schedules nothing and measures no path', () => {
    for (const file of readdirSync(join(here, '..', 'src'))) {
      const source = readFileSync(join(here, '..', 'src', file), 'utf8');
      expect(source, `${file} schedules work of its own`).not.toMatch(
        SCHEDULERS,
      );
    }
  });
});
