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

  it('leaves them alone when core keeps its API', () => {
    expect(planFor('minor')).toEqual(['@pensketch/core:minor']);
  });

  // The server is dragged along too, and differently: core is a plain
  // dependency there rather than a peer, so a major that puts core outside
  // its range rewrites the range and patches the server. Only the bindings
  // take a major, because only they ask a consumer to resolve core.
  it('majors them when core breaks its API, because the peer range stops matching', () => {
    expect(planFor('major')).toEqual([
      '@pensketch/core:major',
      '@pensketch/mcp:patch',
      '@pensketch/react:major',
    ]);
  });
});
