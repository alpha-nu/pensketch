import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The react package reaches core by its public specifier, which resolves
// through built output. Pointing it at core's source instead means tests and
// typecheck need no prior build, cannot silently run against a stale one, and
// report failures in real source rather than in a minified bundle.
const CORE_SRC = fileURLToPath(
  new URL('./packages/core/src/index.ts', import.meta.url),
);

// `@pensketch/mcp` reports its own version to a client. tsup substitutes it
// from the manifest at build time; the suite runs the source, so it needs the
// same substitution. Read once here rather than imported by the source: a
// default import of package.json inlines the whole manifest into the bundle.
const MCP_VERSION = JSON.parse(
  readFileSync(new URL('./packages/mcp/package.json', import.meta.url), 'utf8'),
).version;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: 'packages/core',
          environment: 'jsdom',
        },
      },
      {
        resolve: {
          alias: { '@pensketch/core': CORE_SRC },
        },
        test: {
          name: 'react',
          root: 'packages/react',
          environment: 'jsdom',
          // Testing Library self-registers its cleanup only when `afterEach`
          // is a global, which it is not here, so the setup file runs it.
          setupFiles: ['./test/setup.ts'],
        },
      },
      {
        // Per project, not at the root: a project gets its own Vite config
        // and does not inherit `define` from the one wrapping it.
        define: { __MCP_VERSION__: JSON.stringify(MCP_VERSION) },
        test: {
          name: 'mcp',
          root: 'packages/mcp',
          // No DOM: the server renders through `@pensketch/core/server`,
          // which is the entire reason that subpath exists.
          environment: 'node',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Source files no test imports still count: without an explicit
      // include, an unimported module is simply absent from the report and
      // the thresholds below pass vacuously.
      include: ['packages/*/src/**'],
      // `stdio.ts` starts talking on stdin the moment it is imported, so it
      // cannot be covered by importing it. It is a transport entry of a few
      // lines, verified by spawning the built server and completing a real
      // round trip instead.
      exclude: [
        'examples/**',
        'tools/**',
        '**/dist/**',
        'packages/mcp/src/stdio.ts',
      ],
      // Per-package thresholds, so a well-covered package cannot mask a
      // poorly covered one. Globs match paths relative to the repo root.
      thresholds: {
        'packages/core/src/**': { lines: 90, branches: 90 },
        'packages/react/src/**': { lines: 90, branches: 90 },
        'packages/mcp/src/**': { lines: 90, branches: 90 },
      },
    },
  },
});
