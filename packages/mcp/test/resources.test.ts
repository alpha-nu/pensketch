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
import { EXAMPLES } from '../src/resources.generated';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const resourcesOf = () =>
  (
    createServer() as unknown as {
      _registeredResources: Record<
        string,
        {
          name: string;
          metadata?: { mimeType?: string; description?: string };
          readCallback?: (
            uri: URL,
          ) => Promise<{ contents: { text: string }[] }>;
          handler?: (uri: URL) => Promise<{ contents: { text: string }[] }>;
        }
      >;
    }
  )._registeredResources;

const describes = (uri: string) =>
  resourcesOf()[uri]?.metadata?.description ?? '';

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
      const { diagram, viewBox, options } = JSON.parse(
        await readResource(exampleUri(key)),
      );
      // The envelope's own options, for the reason `tools/check-diagrams.mjs`
      // carries them: an example drawn with a pair and measured without it is
      // measured as a different picture, and a slab crossing the frame would
      // pass here and clip in the render. The pipeline and the showcase
      // both ship extruded, so this spread carries a real pair for those and
      // an absent key for the rest.
      expect(check(diagram, { ...options, viewBox })).toEqual([]);
    },
  );

  // The envelope is data and its fields are arguments, but not the same
  // argument: two go beside the diagram and one is the diagram. A description
  // that leaves a field out is the failure that costs a caller a wasted call,
  // and `options` was left out from the day the loader started carrying it.
  it.each(EXAMPLE_KEYS)('%s says which of its fields are arguments', (key) => {
    const description = describes(exampleUri(key));
    for (const field of ['`diagram`', '`viewBox`', '`options`'])
      expect(description).toContain(field);
  });

  // `raw` holds functions, and the lifecycle example uses it for the
  // self-transition. JSON cannot carry that, so it must not appear to.
  it('never claims to carry the raw escape hatch', async () => {
    for (const key of EXAMPLE_KEYS)
      expect(await readResource(exampleUri(key))).not.toContain('"raw"');
  });
});

// Two counts the showcase states in its own labels, and the diagram is served
// as `pensketch://example/showcase`, so both are published facts rather than
// decoration. One went stale already - it read "nine rules" for the whole of
// the change that added the tenth - and nothing caught it, because
// `npm run diagrams` fails on errors and a label is only ever a warning.
// Held to the source rather than to a number typed twice: add a rule or a pen
// member and this goes red naming the label to move.
describe('the showcase counts what the code has', () => {
  const WORDS = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ];
  const showcase = () => source('examples/showcase/index.html');

  it('names as many rules as `RuleId` has members', () => {
    const union = /export type RuleId =([\s\S]*?);/.exec(
      source('packages/core/src/check.ts'),
    )?.[1];
    const rules = (union?.match(/'[a-z-]+'/g) ?? []).length;
    expect(rules).toBeGreaterThan(0);
    expect(showcase()).toContain(`'${WORDS[rules]} rules'`);
  });

  it('names as many primitives as `Pen` has members', () => {
    const body = /export interface Pen \{([\s\S]*?)\n\}/.exec(
      source('packages/core/src/types.ts'),
    )?.[1];
    const members = (body?.match(/^ {2}[a-z][A-Za-z]*\(/gm) ?? []).length;
    expect(members).toBeGreaterThan(0);
    expect(showcase()).toContain(`'${WORDS[members]} primitives'`);
  });
});

// A shipped example draws with depth, and this is the only thing that says so.
// `npm run diagrams` measures a page with the page's own options, so an
// extruded example is checked extruded - but a page that quietly went flat
// would pass that gate, pass the suite, and regenerate a clean tree, because
// flat is a valid drawing too. The documentation-and-examples requirement
// says a treatment the data model expresses appears in a shipped example;
// without this, that sentence is a wish.
describe('a shipped example draws with depth', () => {
  it('serves at least one example whose options extrude', () => {
    const extruded = Object.entries(EXAMPLES).filter(
      ([, e]) => (e as { options?: { extrude?: boolean } }).options?.extrude,
    );
    expect(
      extruded.map(([key]) => key),
      'no served example is drawn extruded',
    ).not.toEqual([]);
  });
});

// The package README tells an agent what it can fetch, which makes its two
// counts the same kind of published fact - and both had gone stale: it said
// seven resources where the server registers eight, and four example diagrams
// where it serves five, the showcase having been added without them.
describe('the README counts what the server registers', () => {
  const readme = () => source('packages/mcp/README.md');

  it('counts the resources the server actually registers', () => {
    expect(readme()).toContain(
      `## ${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][Object.keys(resourcesOf()).length]} resources`,
    );
  });

  it('lists every example key it serves', () => {
    for (const key of Object.keys(EXAMPLES))
      expect(readme(), `README does not name ${key}`).toContain(key);
  });
});
