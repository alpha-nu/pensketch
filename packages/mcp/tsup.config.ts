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
  // The factory and the transport are separate entries, so everything worth
  // testing is reachable without a process to talk to.
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  minify: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  // On here and off everywhere else. The rule is written for the budgeted
  // entries, where a shared chunk would make a budget measure a re-export
  // rather than the code it stands for; this package has no budget. What it
  // has is a tarball an `npx` user waits for. Two entries each inlining their
  // own copy of the SDK pack at 284 KB; as shared chunks, 152 KB. Measured
  // 2026-09-07 on this exact configuration, and dated because the figure
  // moves with the source rather than being held by a budget - this package
  // is forbidden one.
  //
  // The saving is not a consequence of entry count, which is worth writing
  // down because it was once credited to a transport that has since been
  // removed: at four entries the same pair of measurements read 566 KB and
  // 162 KB, so dropping two entries moved the split figure by 7 KB and the
  // unsplit one by 278. The duplication is between the factory and the
  // transport, and two entries is enough to have it.
  //
  // `shims` is what makes `require` of this package work at all - both
  // published `require` conditions threw on load without it - and costs 1 KB
  // of the 152.
  shims: true,
  splitting: true,
  define: { __MCP_VERSION__: JSON.stringify(version) },
});
