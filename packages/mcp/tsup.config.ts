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
  // The factory and the transports are separate entries so that a second
  // transport stays additive: `stdio.ts` and `http.ts` are each a few lines
  // over `index.ts`, and `serve-http.ts` is the bin over `http.ts`.
  entry: ['src/index.ts', 'src/stdio.ts', 'src/http.ts', 'src/serve-http.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  // On here and off everywhere else. The rule is written for the budgeted
  // entries, where a shared chunk would make a budget measure a re-export
  // rather than the code it stands for; this package has no budget. What it
  // has is a tarball an `npx` user waits for, and four entries each inlining
  // their own copy of the SDK packed it at 556 KB against 165 KB as shared
  // chunks - less than the 270 KB two entries packed at, because the
  // duplication predated the fourth. Both measured with `shims` on.
  shims: true,
  splitting: true,
  define: { __MCP_VERSION__: JSON.stringify(version) },
});
