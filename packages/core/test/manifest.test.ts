import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Path joins rather than `new URL()`: the bundler rewrites a `new URL()`
// against `import.meta.url` into an asset URL of its own, which no longer
// names a file on disk.
const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const manifestOf = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(PACKAGES, name, 'package.json'), 'utf8'));

// The rule is about the packages a browser loads, not about every workspace.
// `@pensketch/mcp` is a tool an agent spawns; it may depend on things, and
// saying "no package here has dependencies" would have made that a violation
// of an invariant it was never meant to cover.
const RENDERING = ['core', 'react'];

describe('the rendering packages stay out of a consumer lockfile', () => {
  it.each(RENDERING)('%s takes no runtime dependency', (name) => {
    expect(manifestOf(name).dependencies).toBeUndefined();
  });

  // The server carries a WebAssembly rasterizer and an MCP SDK. A dependency
  // edge from either rendering package would drag all of it into every page
  // that draws a diagram.
  it.each(RENDERING)('%s never mentions the server package', (name) => {
    expect(JSON.stringify(manifestOf(name))).not.toContain('@pensketch/mcp');
  });
});

describe('the server package', () => {
  const mcp = manifestOf('mcp');

  // The shape, not the ranges: a release rewrites the core range, and
  // asserting it literally makes every release fail its own tests.
  it('depends on the SDK and on core, and nothing else', () => {
    expect(Object.keys(mcp.dependencies ?? {}).sort()).toEqual([
      '@modelcontextprotocol/server',
      '@pensketch/core',
    ]);
  });

  // Pinned to the major deliberately. The SDK's published layout moved to
  // scoped packages at 2.0, and the older single-package one is what most
  // material in circulation still shows, so the range says which applies.
  it('takes the split SDK layout, at its major', () => {
    expect(mcp.dependencies).toMatchObject({
      '@modelcontextprotocol/server': '^2.0.0',
    });
  });

  it('is runnable by name', () => {
    expect(mcp.bin).toEqual({ 'pensketch-mcp': './dist/stdio.js' });
  });
});
