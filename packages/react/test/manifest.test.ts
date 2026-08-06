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

  // react-dom is a root dev dependency the tests render with; the package
  // itself must never ask a consumer for it.
  it('never mentions react-dom', () => {
    expect(JSON.stringify(manifest)).not.toContain('react-dom');
  });
});
