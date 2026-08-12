import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { constants } from '@pensketch/core';
import { check } from '@pensketch/core/check';
import { describe, expect, it } from 'vitest';
import { createServer } from '../src/index';
import {
  CONSTANTS_URI,
  exampleUri,
  SCHEMA_URI,
  SPEC_URI,
} from '../src/resources';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const resourcesOf = () =>
  (
    createServer() as unknown as {
      _registeredResources: Record<
        string,
        {
          name: string;
          metadata?: { mimeType?: string };
          readCallback?: (
            uri: URL,
          ) => Promise<{ contents: { text: string }[] }>;
          handler?: (uri: URL) => Promise<{ contents: { text: string }[] }>;
        }
      >;
    }
  )._registeredResources;

const readResource = async (uri: string) => {
  const entry = resourcesOf()[uri];
  const handler = entry?.handler ?? entry?.readCallback;
  if (!handler) throw new Error(`no resource registered at ${uri}`);
  const result = await handler(new URL(uri));
  return result.contents[0]?.text ?? '';
};

describe('the resource surface', () => {
  it('publishes the spec, the schema, the constants and every example', () => {
    expect(Object.keys(resourcesOf()).sort()).toEqual([
      CONSTANTS_URI,
      exampleUri('atm'),
      exampleUri('incident'),
      exampleUri('lifecycle'),
      exampleUri('pipeline'),
      exampleUri('showcase'),
      SCHEMA_URI,
      SPEC_URI,
    ]);
  });
});

// The failure this design set out to remove: a resource that says something
// the repository stopped doing. Each of these compares served bytes with the
// file they come from, so drift fails here rather than misleading an agent.
describe('a resource cannot drift from its source', () => {
  it('serves docs/agents.md as the spec, byte for byte', async () => {
    expect(await readResource(SPEC_URI)).toBe(source('docs/agents.md'));
  });

  it('serves the generated schema, byte for byte', async () => {
    expect(await readResource(SCHEMA_URI)).toBe(
      source('packages/core/schema/diagram.schema.json'),
    );
  });

  // Not generated at all: read from the installed package, which cannot drift
  // because there is nothing to keep in step.
  it('serves the constants the renderer actually uses', async () => {
    expect(JSON.parse(await readResource(CONSTANTS_URI))).toEqual(constants);
  });
});

// Every example, from one list. Three of these blocks named their keys
// inline and the fourth example was served, listed, and covered by none of
// them - the one an agent is most likely to read, at that.
const EXAMPLE_KEYS = ['pipeline', 'lifecycle', 'incident', 'atm', 'showcase'];

describe('the examples are served as data', () => {
  it.each(EXAMPLE_KEYS)(
    '%s is a diagram render_diagram would accept',
    async (key) => {
      const example = JSON.parse(await readResource(exampleUri(key)));
      expect(example.viewBox).toHaveLength(4);
      expect(Array.isArray(example.diagram.nodes)).toBe(true);
      expect(typeof example.title).toBe('string');
    },
  );

  // They are the diagrams this repository ships, and CI holds those to the
  // checker. An example that broke the rules it is meant to teach would be
  // the worst thing in here.
  it.each(EXAMPLE_KEYS)(
    '%s passes the checker it is meant to demonstrate',
    async (key) => {
      const { diagram, viewBox } = JSON.parse(
        await readResource(exampleUri(key)),
      );
      expect(check(diagram, { viewBox })).toEqual([]);
    },
  );

  // `raw` holds functions, and the lifecycle example uses it for the
  // self-transition. JSON cannot carry that, so it must not appear to.
  it('never claims to carry the raw escape hatch', async () => {
    for (const key of EXAMPLE_KEYS)
      expect(await readResource(exampleUri(key))).not.toContain('"raw"');
  });
});
