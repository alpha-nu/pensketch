import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assembleReleasePlan from '@changesets/assemble-release-plan';
import { read } from '@changesets/config';
import { getPackages } from '@manypkg/get-packages';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Core is a peer of this package rather than a dependency, and the release
// tool treats a peer that moves as breaking for whoever peers on it. That is
// the wrong reading here: the range says which core APIs work, and a core
// release that keeps the API is not a break. The tool is configured
// accordingly, and these assert the configuration still does what it says -
// the alternative is finding out from a release pull request proposing a
// major nobody asked for.
describe('what a core release does to the bindings', () => {
  let packages: Awaited<ReturnType<typeof getPackages>>;
  let config: Awaited<ReturnType<typeof read>>;

  beforeAll(async () => {
    packages = await getPackages(ROOT);
    config = await read(ROOT, packages);
  });

  const planFor = (type: 'minor' | 'major') =>
    assembleReleasePlan(
      [
        {
          id: 'probe',
          summary: 'probe',
          releases: [{ name: '@pensketch/core', type }],
        },
      ],
      packages,
      config,
      undefined,
    ).releases.map((release) => `${release.name}:${release.type}`);

  // The server is in this plan too, and answers differently: core is a plain
  // dependency there rather than a peer, and its range is a caret one so that
  // the version bump cannot flatten away the upper bound. On a 0.x version a
  // caret is left behind by a minor, so the server follows core out of range
  // and takes a patch with a rewritten range every time core moves at all.
  // That is the standing cost of a bound that survives a release, and it is
  // paid automatically. See packages/mcp/test/manifest.test.ts.
  it('leaves the bindings alone when core keeps its API; the server follows', () => {
    expect(planFor('minor')).toEqual([
      '@pensketch/core:minor',
      '@pensketch/mcp:patch',
    ]);
  });

  // Only the packages that peer on core take a major, because only they ask a
  // consumer to resolve it. The server is patched here for the same reason as
  // above.
  //
  // `@pensketch/animation` is one of them now, and it answers exactly as the
  // bindings do: left alone by the minor above, because its compound peer
  // range still holds, and majored here, because the `<1.0.0` half of that
  // range stops holding the moment core takes a major. That is the range doing
  // its job - it is the whole reason a compound peer is allowed at all - and
  // this is where a release that quietly widened it would show up.
  it('majors them when core breaks its API, because the peer range stops matching', () => {
    expect(planFor('major')).toEqual([
      '@pensketch/core:major',
      '@pensketch/animation:major',
      '@pensketch/mcp:patch',
      '@pensketch/react:major',
    ]);
  });
});
