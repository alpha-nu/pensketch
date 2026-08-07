import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/check.ts', 'src/server.ts'],
  // Each entry stands alone. Left on, esbuild hoists what two entries share
  // into a chunk, and both of this package's promises break at once: the
  // root entry becomes a 197-byte re-export - so its 5120-byte budget
  // measures nothing - and importing the checker pulls in a chunk carrying
  // the whole renderer. The cost of turning it off is that the handful of
  // constants and helpers the checker shares with `draw` are emitted twice,
  // which is a few hundred bytes against those two guarantees.
  splitting: false,
  format: ['esm', 'cjs'],
  dts: true,
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
});
