import { defineConfig } from 'vitest/config';

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
        test: {
          name: 'react',
          root: 'packages/react',
          environment: 'jsdom',
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
