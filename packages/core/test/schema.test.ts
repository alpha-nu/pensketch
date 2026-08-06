import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import { describe, expect, it } from 'vitest';
import type { Diagram } from '../src/index';

// The schema is generated from `Diagram`, so it cannot drift from the types.
// It can still be wrong: generated output nobody validates against is a
// plausible-looking file, not a contract. These run a real validator over real
// diagrams, and over the mistakes the schema exists to catch.
const CORE = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts: string[]) =>
  JSON.parse(readFileSync(join(CORE, ...parts), 'utf8'));

const SCHEMA = read('schema', 'diagram.schema.json');

const validate = new Ajv({ allErrors: true }).compile(SCHEMA);
const accepts = (value: unknown) => validate(value) === true;

// A real diagram, not a minimal one: groups, every shape, waypoints, a note.
const REAL = {
  nodes: [
    { id: 'lane', shape: 'group', x: 20, y: 20, w: 200, h: 300, lines: ['a'] },
    { id: 'a', shape: 'box', x: 40, y: 60, w: 150, h: 46, lines: ['step'] },
    { id: 'b', shape: 'pill', x: 40, y: 160, w: 150, h: 46, accent: true },
    { id: 'c', shape: 'diamond', x: 40, y: 240, w: 150, h: 60, hatch: true },
  ],
  edges: [
    { from: ['a', 'b'], to: ['b', 't'] },
    {
      from: ['b', 'r'],
      to: ['c', 'r'],
      via: [
        [220, 183],
        [220, 270],
      ],
      dotted: true,
      label: 'no',
      lx: 230,
      ly: 220,
      anchor: 'start',
    },
  ],
  notes: [
    {
      x: 300,
      y: 90,
      lines: ['see this'],
      arrowFrom: [300, 100],
      arrowTo: [200, 120],
    },
  ],
} satisfies Omit<Diagram, 'raw'>;

describe('the generated diagram schema', () => {
  it('accepts a diagram using every phase and every shape', () => {
    expect(validate(REAL)).toBe(true);
  });

  it('accepts an empty diagram, since every phase is optional', () => {
    expect(accepts({})).toBe(true);
  });

  // The discriminated union is the reason an untitled group is a compile
  // error. The schema has to carry that across to callers writing JSON, who
  // have no compiler.
  it('requires a group to be titled, and lets other shapes go unlabelled', () => {
    const group = { id: 'g', shape: 'group', x: 0, y: 0, w: 10, h: 10 };
    expect(accepts({ nodes: [group] })).toBe(false);
    expect(accepts({ nodes: [{ ...group, lines: ['t'] }] })).toBe(true);
    expect(accepts({ nodes: [{ ...group, shape: 'box' }] })).toBe(true);
  });

  it('rejects a node missing part of its box', () => {
    expect(
      accepts({ nodes: [{ id: 'a', shape: 'box', x: 0, y: 0, w: 10 }] }),
    ).toBe(false);
  });

  it('rejects an unknown shape', () => {
    expect(
      accepts({
        nodes: [{ id: 'a', shape: 'hexagon', x: 0, y: 0, w: 1, h: 1 }],
      }),
    ).toBe(false);
  });

  it('rejects an unknown side on an edge', () => {
    expect(accepts({ edges: [{ from: ['a', 'up'], to: ['b', 'l'] }] })).toBe(
      false,
    );
  });

  // A typo is the mistake a caller writing JSON has nothing else to catch.
  it('rejects a misspelled key rather than ignoring it', () => {
    expect(accepts({ nodez: [] })).toBe(false);
    expect(
      accepts({
        nodes: [
          { id: 'a', shape: 'box', x: 0, y: 0, w: 1, h: 1, hatched: true },
        ],
      }),
    ).toBe(false);
  });

  // Deliberate: `raw` holds functions. Pinned so that widening the generated
  // type back would fail here rather than quietly promise callers something
  // JSON cannot deliver.
  it('rejects the raw escape hatch, which cannot survive JSON', () => {
    expect(accepts({ raw: [] })).toBe(false);
    expect(SCHEMA.properties.raw).toBeUndefined();
  });
});

// A schema a caller cannot install is one they will copy and let go stale, so
// the file ships in the package. Nothing else here reads the manifest: without
// these, a generator writing somewhere `files` does not reach would be found
// only by publishing.
describe('shipping the schema', () => {
  const manifest = read('package.json');
  const subpath = manifest.exports['./schema.json'];

  it('exports the validated file as @pensketch/core/schema.json', () => {
    expect(subpath).toBe('./schema/diagram.schema.json');
    expect(read(subpath)).toEqual(SCHEMA);
  });

  it('packs the directory the export points into', () => {
    expect(manifest.files).toContain('schema');
  });
});
