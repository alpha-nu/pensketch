import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Diagram, Theme } from '../src/index';
import { draw } from '../src/index';
import { BUDGETS, SAMPLER } from './fixtures';
import { serialize } from './serialize.mjs';

// The reference emits the CSS variables of the page it was extracted from.
// Rendering through them - rather than through the package's own --ps-*
// defaults - is what lets the attribute bytes be compared directly; the
// default palette is a separate concern with its own tests.
const REFERENCE_THEME: Theme = {
  ink: 'var(--ink)',
  pen: 'var(--pen)',
  accent: 'var(--red)',
  muted: 'var(--muted)',
  wash: 'var(--wash)',
};

const NS = 'http://www.w3.org/2000/svg';

// Read off disk rather than inlined, so the checked-in files themselves are
// what the port is measured against. The directory is resolved with path
// joins: the bundler rewrites `new URL()` with a non-literal specifier into
// an asset URL of its own.
const GOLDENS = join(dirname(fileURLToPath(import.meta.url)), 'goldens');

const CASES: Array<{
  name: string;
  diagram: Diagram;
  seed: number;
  file: string;
}> = [
  { name: 'SAMPLER', diagram: SAMPLER, seed: 7, file: 'sampler.seed7.svg.txt' },
  {
    name: 'BUDGETS',
    diagram: BUDGETS,
    seed: 11,
    file: 'budgets.seed11.svg.txt',
  },
];

// Byte parity with reference/renderer.html, whose output the goldens are
// generated from and from nothing else. A failure here means the port moved:
// goldens are never regenerated to make a test pass.
describe('golden parity with the reference implementation', () => {
  it.each(CASES)(
    'renders $name at seed $seed byte-for-byte',
    ({ diagram, seed, file }) => {
      const svg = document.createElementNS(NS, 'svg');
      draw(svg, diagram, { seed, theme: REFERENCE_THEME });
      // The golden file ends in a newline that the serializer does not emit.
      expect(`${serialize(svg)}\n`).toBe(
        readFileSync(join(GOLDENS, file), 'utf8'),
      );
    },
  );
});
