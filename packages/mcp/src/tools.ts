import type { McpServer } from '@modelcontextprotocol/server';
import { animateMarkup } from '@pensketch/animation';
import { check } from '@pensketch/core/check';
import { renderToString } from '@pensketch/core/server';
import { z } from 'zod';

import { EMBEDDED_FAMILY, MAX_SCALE, RASTER_THEME, renderPng } from './render';

// The three tools. Each is a thin layer over `@pensketch/core`: no rendering
// logic, no rules, no geometry lives here. If a tool needs to know something
// about diagrams, that knowledge belongs in core where the browser can reach
// it too.

// The traps a caller cannot discover by reading a type. They are repeated in
// tool descriptions because a description is the only documentation an agent
// is guaranteed to have read, and a test asserts these exact phrases survive:
// a description nobody checks is a description that rots.
export const TRAPS = {
  coordinates:
    'Every coordinate is yours: pensketch performs no layout and routes no edges.',
  text: 'Text is never measured, so a box does not grow to fit its label.',
  font: 'The PNG draws text in a stand-in font, not the handwriting stack the SVG names, so it is authoritative about structure and not about fit; use check_diagram for fit.',
} as const;

// A refusal names the fix, not just the defect. Everything else this project
// throws does - `known ids are "a", "b"`, `expected group, box, pill or
// diamond` - and the caller here is the one least able to work it out for
// itself, since it cannot see what was drawn. zod names the key it rejected;
// what it cannot know is what should have been written instead, so each
// schema says that itself.
const refuses = (subject: string, noun: string, takes: string) => ({
  error: (issue: { code: string; keys?: PropertyKey[] }) => {
    if (issue.code !== 'unrecognized_keys') return undefined;
    const keys = issue.keys ?? [];
    const named = keys.map((key) => JSON.stringify(key)).join(', ');
    return `${subject} has no ${noun}${keys.length > 1 ? 's' : ''} ${named}. It takes ${takes}.`;
  },
});

// The top-level shape only. Every field of a node, an edge, a brace or a
// note is described by the JSON Schema this server publishes as `pensketch://schema`,
// which is generated from the TypeScript types - so restating it here would
// be a second source of truth for a shape that already has one, and the two
// would drift the first time a field moved.
//
// `strictObject`, so a key this does not name is refused by name rather than
// stripped: the schema published alongside it forbids one, and a caller who
// cannot see the picture cannot see a piece of it go missing either. That
// holds at this level and no deeper - a node carrying `line` for `lines` is
// still accepted here and still draws an unlabelled box, because the fields
// inside a member are the schema's business rather than this list's. The cost
// of the list is that a new top-level field is refused until it is added, and
// a test holds it to the schema's own top level so that is a failure rather
// than a surprise.
const diagram = z
  .strictObject(
    {
      nodes: z.array(z.unknown()).optional(),
      edges: z.array(z.unknown()).optional(),
      braces: z.array(z.unknown()).optional(),
      notes: z.array(z.unknown()).optional(),
    },
    refuses(
      'A diagram',
      'field',
      'nodes, edges, braces and notes; read pensketch://schema for the fields inside each',
    ),
  )
  .describe(
    'A diagram: nodes, edges, braces and notes as plain data. Read the pensketch://schema resource for every field. Any other top-level key is refused by name rather than ignored, `raw` included: it holds functions that JSON cannot carry. Fields inside a node, an edge, a brace or a note are not checked here - pensketch://schema is what describes those.',
  );

const viewBox = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .describe('[minX, minY, width, height], the four numbers the <svg> carries.');

// The same four substitutions core makes when it serializes an attribute.
// The label is a caller's text and reaches the only part of the document core
// does not write - an unescaped ampersand here makes the whole thing
// unparseable, which is how resvg first told me about it.
const escapeAttr = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A finding as a line a human or a model can read at a glance. */
const line = (f: {
  severity: string;
  rule: string;
  at: [number, number];
  message: string;
  estimated?: true;
}) =>
  `${f.severity} ${f.rule} at (${f.at.join(', ')}): ${f.message}${f.estimated ? ' [estimated]' : ''}`;

/**
 * Wraps whatever `draw`, `check` or the rasterizer threw as tool output. Core
 * throws messages written to be read by whoever has to fix the diagram, and
 * they are worth more to a caller than a stack trace they cannot see.
 *
 * `String(error)` rather than a test for `Error`: JavaScript lets anything be
 * thrown, and the branch that would handle the other case is one no honest
 * test can reach. The cost is an `Error: ` prefix on a message that already
 * says enough.
 */
const failed = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: String(error) }],
});

export function registerTools(server: McpServer): void {
  server.registerTool(
    'check_diagram',
    {
      title: 'Check a diagram for layout defects',
      description: `Reports what neither the types nor the schema can see: overlapping boxes, a label a connector will be drawn through, text too wide for its box, a node half out of its lane, a node no edge names. Draws nothing. ${TRAPS.coordinates} ${TRAPS.text} Run this before rendering, and again after moving anything.`,
      inputSchema: z.strictObject(
        {
          diagram,
          // Both sentences, because the outer `.describe()` replaces the
          // inner one rather than adding to it - and this is the one tool
          // where viewBox is optional, so it was the one tool whose schema
          // never said what the four numbers are.
          viewBox: viewBox
            .optional()
            .describe(
              '[minX, minY, width, height], the four numbers the <svg> carries. Without it the out-of-bounds rule cannot run and does not.',
            ),
        },
        refuses(
          'check_diagram',
          'argument',
          'a diagram and an optional viewBox',
        ),
      ),
    },
    async ({ diagram: d, viewBox: box }) => {
      try {
        const findings = check(
          d as Parameters<typeof check>[0],
          box ? { viewBox: box } : {},
        );
        const errors = findings.filter((f) => f.severity === 'error').length;
        const warnings = findings.length - errors;
        return {
          content: [
            {
              type: 'text' as const,
              text: findings.length
                ? `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}\n${findings.map(line).join('\n')}`
                : 'No findings.',
            },
          ],
        };
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    'render_diagram',
    {
      title: 'Render a diagram to SVG',
      description: `Returns SVG markup for a diagram. Deterministic: the same diagram and seed produce the same bytes. ${TRAPS.coordinates} ${TRAPS.text} The markup names the handwriting font stack, so a browser draws it in the reader's own hand-drawn face.`,
      inputSchema: z.strictObject(
        {
          diagram,
          viewBox,
          seed: z
            .number()
            .int()
            .optional()
            .describe(
              'Picks which drawing of the same data you get. Default 1.',
            ),
          hops: z
            .boolean()
            .optional()
            .describe(
              "Draw every connector as going over the ones it crosses, breaking the line underneath where they meet. An edge's own `hop` wins over this either way. Default false.",
            ),
          label: z
            .string()
            .optional()
            .describe('An accessible name, set as aria-label on the <svg>.'),
          // The description an agent reads before it reads any resource, so it
          // says what comes back rather than what the flag switches on: a
          // caller who never opens pensketch://spec still has to learn that the
          // result is finished, that there is no stylesheet for them to write,
          // and what a viewer that cannot animate it shows instead.
          animate: z
            .boolean()
            .optional()
            .describe(
              'Return an <svg> that draws itself, stroke by stroke, in the order a hand would have drawn it. It carries its own scoped <style> and is complete on its own: nothing to fetch, no CSS to write, no class or attribute to add. It animates inline in a page, embedded as an <img src>, or opened as a file. Where @scope is not understood the diagram renders finished and static rather than blank. Default false.',
            ),
        },
        refuses(
          'render_diagram',
          'argument',
          'a diagram, a viewBox, and an optional seed, hops, label and animate',
        ),
      ),
    },
    async ({ diagram: d, viewBox: box, seed, hops, label, animate }) => {
      try {
        return {
          content: [
            {
              type: 'text' as const,
              text: svgFor(d, box, { seed, label, hops, animate }),
            },
          ],
        };
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    'render_png',
    {
      title: 'Render a diagram to a PNG you can look at',
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

          scale: z
            .number()
            .optional()
            .describe(`1 to ${MAX_SCALE}. Default 2, for a legible image.`),
        },
        refuses(
          'render_png',
          'argument',
          'a diagram, a viewBox, and an optional seed, hops and scale',
        ),
      ),
    },
    async ({ diagram: d, viewBox: box, seed, hops, scale = 2 }) => {
      try {
        const png = await renderPng(
          svgFor(d, box, { seed, hops, forRaster: true }),
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

/**
 * Everything `svgFor` takes beyond the diagram and the frame it is drawn in.
 *
 * Each field admits `undefined` as well as being optional, which
 * `exactOptionalPropertyTypes` otherwise keeps apart. Not because the parse
 * leaves them present - zod drops an absent optional key entirely - but
 * because each handler passes them on as a shorthand object literal, and
 * `{ seed }` names the key whether or not the parse produced one. Re-omitting
 * each one at every call site would be a second copy of the omission this
 * function already performs when it hands them to `renderToString`.
 */
export interface SvgOptions {
  /** Picks which drawing of the same data is produced. */
  seed?: number | undefined;
  /** An accessible name, escaped and set as `aria-label` on the wrapper. */
  label?: string | undefined;
  /** Draw every connector as hopping over the ones it crosses. */
  hops?: boolean | undefined;
  /** Draw for the rasterizer: the embedded face and a resolved palette. */
  forRaster?: boolean | undefined;
  /** Stamp the drawing order and carry the stylesheet that reads it. */
  animate?: boolean | undefined;
}

/**
 * The `<svg>` wrapper around what `renderToString` draws, which is its
 * contents. `forRaster` names the embedded face instead of the handwriting
 * stack: the rasterizer has only the one font, and naming a face it does not
 * hold draws nothing at all.
 *
 * Named options rather than a row of positionals: `forRaster` and `animate`
 * are both booleans and neither is ever passed by the same caller, so a
 * transposition would be silent - a still PNG of an animated document, or a
 * page-bound SVG drawn in a font the reader has not got.
 */
export function svgFor(
  d: unknown,
  [minX, minY, width, height]: readonly [number, number, number, number],
  { seed, label, hops, forRaster = false, animate = false }: SvgOptions = {},
): string {
  // The rasterizer resolves no CSS custom properties, so it is given the
  // palette already resolved. `render_diagram` keeps the `var()` defaults,
  // because its SVG goes to a page that restyles it by redefining them.
  const inner = renderToString(d as Parameters<typeof renderToString>[0], {
    ...(seed === undefined ? {} : { seed }),
    ...(hops === undefined ? {} : { hops }),
    ...(forRaster ? { theme: RASTER_THEME } : {}),
    // Only when asked for, so the bytes of an unanimated render are the bytes
    // they always were: no `--ps-i`, no `pathLength`, nothing moved.
    ...(animate ? { order: true } : {}),
  });
  const font = forRaster
    ? ` style="font-family:'${EMBEDDED_FAMILY}'"`
    : ` style="font-family:'Chalkboard SE','Bradley Hand','Segoe Print','Comic Sans MS',cursive"`;
  const aria = label ? ` role="img" aria-label="${escapeAttr(label)}"` : '';
  // `animateMarkup` rather than `animate`: this server renders through
  // `@pensketch/core/server`, which has no DOM behind it, so there is no
  // element to insert a `<style>` into and nothing to serialize afterwards.
  // It takes the contents of an `<svg>` and returns contents, which is
  // exactly what `renderToString` hands back and what the wrapper below
  // encloses - so the stylesheet lands inside the element it scopes itself to.
  const body = animate ? animateMarkup(inner) : inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}"${font}${aria}>${body}</svg>`;
}
