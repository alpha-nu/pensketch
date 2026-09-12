import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { MAX_SCALE } from './raster-constants';
import { renderPng } from './render';
import {
  depth,
  diagram,
  extrude,
  failed,
  refuses,
  svgFor,
  TRAPS,
  viewBox,
} from './tools';
import { refuseDiagram } from './validate';

// `render_png`, alone in its own file because of what it drags behind it.
//
// `render.ts` reaches `node:fs`, `node:module` and 2.5 MB of WebAssembly. Any
// module that imports it is a module no edge runtime can load, so the entry
// that serves HTTP must not be able to reach this file - not through a
// dynamic import either, which a bundler follows and tries to resolve.
//
// So the tool set is decided by which factory you call rather than by a flag
// passed to one. `factory.ts` builds the pair every transport serves;
// `index.ts` is that plus this. A boolean would have left the import in the
// graph and the property untestable.

export function registerRasterTool(server: McpServer): void {
  server.registerTool(
    'render_png',
    {
      title: 'Render a diagram to a PNG you can look at',
      annotations: { readOnlyHint: true },
      description: `Rasterizes a diagram so it can be displayed. ${TRAPS.font} ${TRAPS.coordinates} Scale is capped at ${MAX_SCALE}, and an oversized request is refused rather than served.`,
      // `animate` is absent here on purpose, and its absence is a refusal
      // rather than an omission: a PNG is one frame, and the strict boundary
      // this schema draws answers `animate: true` by name - `render_png has no
      // argument "animate"` - where a declared-and-ignored field would hand
      // back a still image as though the request had been honoured. A caller
      // who cannot see the picture would have no way to tell the two apart.
      inputSchema: z.strictObject(
        {
          diagram,
          viewBox,
          seed: z.number().int().optional(),
          hops: z
            .boolean()
            .optional()
            .describe(
              "Draw every connector as going over the ones it crosses, breaking the line underneath where they meet. An edge's own `hop` wins over this either way. Default false.",
            ),
          extrude,
          depth,
          scale: z
            .number()
            .optional()
            .describe(`1 to ${MAX_SCALE}. Default 2, for a legible image.`),
        },
        refuses(
          'render_png',
          'argument',
          'a diagram, a viewBox, and an optional seed, hops, extrude, depth and scale',
        ),
      ),
    },
    async ({
      diagram: d,
      viewBox: box,
      seed,
      hops,
      extrude,
      depth,
      scale = 2,
    }) => {
      const refusal = refuseDiagram(d);
      if (refusal) return failed(refusal);
      try {
        const png = await renderPng(
          svgFor(d, box, { seed, hops, extrude, depth, forRaster: true }),
          {
            width: box[2],
            height: box[3],
            scale,
          },
        );
        return {
          content: [
            {
              type: 'image' as const,
              data: Buffer.from(png).toString('base64'),
              mimeType: 'image/png',
            },
          ],
        };
      } catch (error) {
        return failed(error);
      }
    },
  );
}
