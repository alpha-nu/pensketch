import type { McpServer } from '@modelcontextprotocol/server';
import { constants } from '@pensketch/core';

import { EXAMPLES, SCHEMA, SPEC } from './resources.generated';

// What the server publishes rather than restates. Every one of these mirrors
// something that exists for another reason — the reference written for
// machine callers, the schema generated from the types, the diagrams this
// repository ships — and each is generated into source from that single
// origin, so a resource cannot quietly stop matching what it describes.
//
// `constants` is the exception that proves the rule: it is imported from
// `@pensketch/core` at runtime, which is a stronger guarantee than copying it
// would be, not a weaker one.

export const SPEC_URI = 'pensketch://spec';
export const SCHEMA_URI = 'pensketch://schema';
export const CONSTANTS_URI = 'pensketch://constants';
export const exampleUri = (key: string) => `pensketch://example/${key}`;

export function registerResources(server: McpServer): void {
  server.registerResource(
    'spec',
    SPEC_URI,
    {
      title: 'Writing diagrams as a program',
      description:
        'The whole type surface, the constants worth designing around, every error the renderer throws, and the traps a type system cannot express. Read this first.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: SPEC }] }),
  );

  server.registerResource(
    'schema',
    SCHEMA_URI,
    {
      title: 'JSON Schema for a diagram',
      description:
        'Generated from the TypeScript types, so it describes the version installed rather than a copy that has drifted. Covers the JSON-serialisable half: `raw` holds functions and is absent.',
      mimeType: 'application/json',
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: SCHEMA }] }),
  );

  server.registerResource(
    'constants',
    CONSTANTS_URI,
    {
      title: 'Every aesthetic constant, with its value',
      description:
        'The numbers the renderer draws by: font sizes, line height, stroke width, jitter amplitude. Read straight from the installed package.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(constants, null, 2) }],
    }),
  );

  // Worked examples with real coordinates, because that is what taught
  // fastest when this repository's own examples were rebuilt: one complete
  // diagram carries proportion — how wide a labelled box wants to be, how far
  // apart rows sit — in a way no field table does.
  for (const [key, example] of Object.entries(EXAMPLES)) {
    server.registerResource(
      `example-${key}`,
      exampleUri(key),
      {
        title: example.title,
        description: `${example.title}. The data that drew it, exactly as this repository ships it: its \`diagram\` is what render_diagram takes as \`diagram\`, and its \`viewBox\` is the frame to pass beside it. The envelope itself is not the argument.`,
        mimeType: 'application/json',
      },
      async (uri) => ({
        contents: [{ uri: uri.href, text: JSON.stringify(example, null, 2) }],
      }),
    );
  }
}
