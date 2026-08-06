import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const sources = readdirSync(SRC)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, text: readFileSync(join(SRC, name), 'utf8') }));

// Determinism is a contract, not a habit. Every one of these would produce
// output that changes between runs or between machines, and none of them can
// be caught by comparing rendered bytes on a single machine: an ambient
// document reference renders identically here and breaks in any host that
// passes in an element from another document.
const FORBIDDEN: Array<[string, RegExp]> = [
  ['Math.random', /Math\s*\.\s*random/],
  ['Date', /\bnew\s+Date\b|\bDate\s*\.\s*now\b/],
  ['performance', /\bperformance\s*\./],
  ['timers', /\bset(?:Timeout|Interval|Immediate)\s*\(/],
  ['locale-dependent formatting', /toLocale[A-Za-z]*\s*\(|\bIntl\s*\./],
  ['the global window', /(?<![.\w])window\b/],
  ['the global document', /(?<!ownerDocument\.)(?<![.\w])document\b/],
];

describe('package source is free of nondeterminism', () => {
  it.each(sources)('$name', ({ text }) => {
    // Comments may legitimately discuss what the code avoids.
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const [label, pattern] of FORBIDDEN)
      expect(
        pattern.test(code),
        `${label} must not appear in package source`,
      ).toBe(false);
  });
});
