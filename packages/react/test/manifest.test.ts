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
  it('takes core as its only regular dependency', () => {
    expect(manifest.dependencies).toEqual({ '@pensketch/core': '^0.0.1' });
  });

  it('peers on react alone, across both supported majors', () => {
    expect(manifest.peerDependencies).toEqual({ react: '^18 || ^19' });
  });

  // react-dom is a root dev dependency the tests render with; the package
  // itself must never ask a consumer for it.
  it('never mentions react-dom', () => {
    expect(JSON.stringify(manifest)).not.toContain('react-dom');
  });
});
