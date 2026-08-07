import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Read here rather than imported by the source: a JSON module has only a
// default export, so `import { version }` is not a thing esbuild will do, and
// a default import inlines the entire manifest - dependency ranges, scripts
// and all - into a published bundle for the sake of one string.
const { version } = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  // The factory and the transport are separate entries so that a second
  // transport stays additive: `stdio.ts` is a few lines over `index.ts`.
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  splitting: false,
  define: { __MCP_VERSION__: JSON.stringify(version) },
});
