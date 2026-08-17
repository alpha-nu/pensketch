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
const RENDERING = ['core', 'react', 'animation'];

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
  //
  // Five, and each is a decision worth failing a test to revisit: the SDK
  // speaks the protocol, core does the drawing, the animation package writes
  // the stylesheet an animated render carries, the rasterizer turns an SVG
  // into something a client can display, and zod is what the SDK wants a tool
  // schema written in. A sixth arriving quietly is what this asserts against.
  //
  // The animation package is a plain dependency here and a peer nowhere,
  // which is the carve-out this package has and the rendering packages do
  // not: it is spawned rather than bundled into a page, so it owns its copies
  // and adds nothing to anybody's bundle.
  //
  // zod is declared even though the SDK would supply it: a package that
  // imports something should say so rather than reach through a dependency's
  // tree for it.
  it('depends on the SDK, core, the motion, the rasterizer and zod, and nothing else', () => {
    expect(Object.keys(mcp.dependencies ?? {}).sort()).toEqual([
      '@modelcontextprotocol/server',
      '@pensketch/animation',
      '@pensketch/core',
      '@resvg/resvg-wasm',
      'zod',
    ]);
  });

  // Pinned exact, unlike the SDK: it renders the images this server returns,
  // and a patch that shifts a glyph by a pixel changes bytes a caller may be
  // comparing.
  it('pins the rasterizer exactly', () => {
    expect(mcp.dependencies).toMatchObject({ '@resvg/resvg-wasm': '2.6.2' });
  });

  // The licence has to travel with the font it covers.
  it('ships the embedded font and its licence', () => {
    expect(mcp.files).toContain('fonts');
  });

  // Pinned to the major deliberately. The SDK's published layout moved to
  // scoped packages at 2.0, and the older single-package one is what most
  // material in circulation still shows, so the range says which applies.
  it('takes the split SDK layout, at its major', () => {
    expect(mcp.dependencies).toMatchObject({
      '@modelcontextprotocol/server': '^2.0.0',
    });
  });

  // No leading `./`: npm normalises the path on publish and then reports it
  // as `"bin[pensketch-mcp]" script name dist/stdio.js was invalid and
  // removed`, which is alarming and wrong - the entry is kept, one line later,
  // under the normalised value. Writing what npm would write leaves the
  // published manifest identical and the publish log quiet.
  it('is runnable by name', () => {
    expect(mcp.bin).toEqual({ 'pensketch-mcp': 'dist/stdio.js' });
  });
});
