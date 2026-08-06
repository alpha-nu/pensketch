import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  // Every export here calls a hook, so a framework that renders components on
  // the server by default has to be told this module is not one of those. The
  // directive has to be the first thing in the file, which is why it is a
  // banner rather than something written in the source: the bundler would
  // otherwise hoist imports above it and it would stop being a directive.
  banner: { js: '"use client";' },
});
