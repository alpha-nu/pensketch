import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The react package reaches core by its public specifier, which resolves
// through built output. Pointing it at core's source instead means tests and
// typecheck need no prior build, cannot silently run against a stale one, and
// report failures in real source rather than in a minified bundle.
const CORE_SRC = fileURLToPath(
  new URL('./packages/core/src/index.ts', import.meta.url),
);

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
    ],
    coverage: {
      provider: 'v8',
      // Source files no test imports still count: without an explicit
      // include, an unimported module is simply absent from the report and
      // the thresholds below pass vacuously.
      include: ['packages/*/src/**'],
      exclude: ['examples/**', 'tools/**', '**/dist/**'],
      // Per-package thresholds, so a well-covered package cannot mask a
      // poorly covered one. Globs match paths relative to the repo root.
      thresholds: {
        'packages/core/src/**': { lines: 90, branches: 90 },
        'packages/react/src/**': { lines: 90, branches: 90 },
      },
    },
  },
});
