import type { McpServer } from '@modelcontextprotocol/server';
import { animateMarkup } from '@pensketch/animation';
import { constants } from '@pensketch/core';
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
/**
 * The most of any one thing a diagram may carry.
 *
 * Not a style rule - a bound on work. Several of `check`'s rules compare every
 * pair, so both the time and the findings grow with the square, and both are
 * spent before anything can be returned. Measured on a worst case where every
 * node overlaps every other:
 *
 * | nodes | draw | check | findings held in memory |
 * |---|---|---|---|
 * | 200 | 15 ms | 20 ms | 29,184 |
 * | 500 | 34 ms | 84 ms | 182,400 |
 * | 1000 | 64 ms | 314 ms | 729,600 |
 * | 2000 | 127 ms | 1299 ms | 2,918,400 |
 * | 8000 | - | - | out of memory |
 *
 * 500 is where that stays a request rather than an outage: 118 ms, twenty
 * times under the 2416 ms raster this transport declines to serve for exactly
 * this reason. It is also twenty-five times the largest diagram this
 * repository ships, which is 20 nodes.
 *
 * The cap on the findings *listing* does not help here. It shortens what is
 * printed; the array is built in full before anything is printed at all.
 *
 * Applied on both transports, deliberately. Nobody hand-writes 500 nodes, and
 * a bound that held only where an attacker could reach it would be a bound
 * this repository never ran against itself.
 */
const MAX_ITEMS = 500;

const many = (what: string) =>
  z
    .array(z.unknown())
    .max(MAX_ITEMS, {
      error: `A diagram takes at most ${MAX_ITEMS} ${what}. Several rules compare every pair, so the work grows with the square: 500 is 118 ms and 2000 is 1.4 s. Split the drawing, or draw fewer things.`,
    })
    .optional();

const diagram = z
  .strictObject(
    {
      nodes: many('nodes'),
      edges: many('edges'),
      braces: many('braces'),
      notes: many('notes'),
    },
    refuses(
      'A diagram',
      'field',
      'nodes, edges, braces and notes; read pensketch://schema for the fields inside each',
    ),
  )
  .describe(
    'A diagram: nodes, edges, braces and notes as plain data. Read the pensketch://schema resource for every field. Any other top-level key is refused by name rather than ignored, `raw` included: it holds functions that JSON cannot carry. Fields inside a node, an edge, a brace or a note are not checked here - pensketch://schema is what describes those. Write it compact - no indentation, no line breaks between fields - which costs about half the tokens of the same diagram pretty-printed. That is a request rather than a rule: nothing here refuses pretty JSON, and nothing can tell afterwards which you sent.',
  );

const viewBox = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .describe('[minX, minY, width, height], the four numbers the <svg> carries.');

// The size a pill has to reach before it has an outline to extrude at all:
// three chords, which a full sweep first draws at `3 x ARC_MIN_CHORD / PI` =
// 11.4592 px on its *larger* dimension. Derived from the constant rather than
// typed, as `depth`'s default is, and rounded *up* to the hundredth (the
// x 100 in the middle), so the number this promises is one that does extrude:
// the bound itself carries faces, and a rounded-down 11.45 would name a pill
// that draws flat.
const FACE_MIN = Math.ceil((3 * constants.ARC_MIN_CHORD * 100) / Math.PI) / 100;

// The diagram-wide depth pair, declared once and taken by all three tools -
// two rendering tools because it moves where the ink lands, and the checker
// because it moves what every rule measures. Both defaults are stated, and
// `depth`'s is read off the package rather than typed here: a number a
// description promises has to be the number the renderer uses.
const extrude = z
  .boolean()
  .optional()
  .describe(
    `Draw every node as a slab: its outline redrawn offset up and to the right and joined to it. A node's own \`extrude\` wins over this either way, so an extruded diagram can flatten one node and a flat one can raise one. A group never extrudes. Nor does a shape too small to carry a face: it draws flat, with nothing thrown, and its anchors stay where they were. A pill needs a larger dimension of ${FACE_MIN} px or more; a box and a diamond carry faces at any non-zero size. Default false.`,
  );

const depth = z
  .number()
  .optional()
  .describe(
    `How deep a slab is drawn, in px, for every node without a \`depth\` of its own. Default ${constants.DEPTH}, calibrated on a box; a pill wants about a third of its height, and a diamond reads as a folded corner at every depth probed, so prefer it flat. Must be a positive finite number wherever it could be read - whenever extrude is on, and through any node extruding on its own - or the render is refused naming the field. A value nothing reads is ignored, except a non-finite one: the boundary refuses that before anything decides whether to read it.`,
  );

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
 * How many findings are spelled out before the rest are counted instead.
 *
 * Findings are quadratic in overlapping nodes: 40 nodes laid one pixel apart
 * produce 1,249 of them, 122 KB, some 30,000 tokens - in a tool whose whole
 * reason for reporting findings at all is to save an agent a few hundred.
 * A diagram in that state has one defect, not 1,249, and the first lines say
 * what it is.
 *
 * 50 is past anything a caller is actually repairing by a wide margin: every
 * diagram this repository ships reports nought, and the worst turn of the
 * measured scenario reported six. It is not a judgement about which findings
 * matter - the count above the list is always the true total, and nothing is
 * silently dropped.
 */
const MAX_LINES = 50;

/**
 * The findings as one block of text, counted. Shared, because `check_diagram`
 * and `render_diagram` now both report them and two spellings of the same
 * answer is how a caller learns to trust one tool over the other.
 */
const report = (findings: Parameters<typeof line>[0][]) => {
  if (!findings.length) return 'No findings.';
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  const head = `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`;
  const rest = findings.length - MAX_LINES;
  return [
    head,
    ...findings.slice(0, MAX_LINES).map(line),
    ...(rest > 0
      ? [
          `... and ${rest} more, not listed. A diagram reporting ${findings.length} findings has few causes and many symptoms; fix what the lines above name and check again.`,
        ]
      : []),
  ].join('\n');
};

/**
 * The findings for a drawing already made, as text, or a note that they could
 * not be taken.
 *
 * `check` refuses inputs `draw` accepts - a bare string where it wants an
 * array of lines is the known one - so it can fail on a diagram that rendered
 * perfectly well. When it does, the caller keeps the markup and is told the
 * report is missing rather than being handed an error in place of a picture.
 */
const reportOf = (
  diagram: unknown,
  viewBox: [number, number, number, number],
  extrude?: boolean,
  depth?: number,
): string => {
  try {
    return report(
      check(diagram as Parameters<typeof check>[0], {
        viewBox,
        ...(extrude === undefined ? {} : { extrude }),
        ...(depth === undefined ? {} : { depth }),
      }),
    );
  } catch (error) {
    return `The drawing was made; the check of it could not run: ${error instanceof Error ? error.message : String(error)}`;
  }
};

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

/** What a server may do, beyond the two tools every server has. */
export interface ToolOptions {
  /**
   * Whether to register `render_png`. Default: `true`.
   *
   * The one tool a transport can have an opinion about, and only because of
   * how it is implemented rather than what it does: the rasterizer is
   * synchronous WebAssembly and holds the event loop for the whole of a
   * raster - 2416 ms measured on a 1760 x 1000 frame at 2x. Under stdio each
   * client owns a process and that is its own business. In a process serving
   * many clients it is everyone else's latency, so a transport that serves
   * many callers declines it here rather than serving it slowly.
   *
   * Not registered is better than registered-and-refusing: an agent pays for
   * every tool description it is sent, and a tool it cannot call is a
   * description it paid for and a turn it may spend discovering that.
   */
  raster?: boolean;
}

export function registerTools(
  server: McpServer,
  { raster = true }: ToolOptions = {},
): void {
  server.registerTool(
    'check_diagram',
    {
      title: 'Check a diagram for layout defects',
      // All three tools compute from their arguments and touch nothing - a
      // host that honours the hint can approve them without asking. Declared
      // on each because the default reads as false when absent (T-111,
      // owner-ruled 2026-08-26).
      annotations: { readOnlyHint: true },
      description: `Reports what neither the types nor the schema can see: overlapping boxes, a label a connector will be drawn through, text too wide for its box, a node half out of its lane, a node no edge names, a depth the renderer would refuse. Draws nothing. ${TRAPS.coordinates} ${TRAPS.text} It takes extrude and depth, where it refuses hops: hops change no finding - though where a hop breaks the very line a \`label-collision\` names, the finding stands and the sentence naming that edge does not - and depth changes the geometry every finding measures - an extruded node is measured over the box its slab sweeps, so a slab that crosses the frame or its neighbour is reported here rather than seen in the picture. Pass the pair you will render with, or the findings are for a drawing you are not making. \`render_diagram\` reports these same findings for the drawing it just made, so reach for this one when you want findings without markup, or before spending a \`render_png\` on a diagram you have not checked.`,
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
          extrude,
          depth,
        },
        refuses(
          'check_diagram',
          'argument',
          'a diagram and an optional viewBox, extrude and depth',
        ),
      ),
    },
    async ({ diagram: d, viewBox: box, extrude, depth }) => {
      try {
        // Key by key rather than an object literal carrying undefineds:
        // `CheckOptions` keeps an absent field apart from one present and
        // undefined, and `depth: undefined` reads as a caller asking for a
        // depth of nothing rather than for the default.
        const findings = check(d as Parameters<typeof check>[0], {
          ...(box === undefined ? {} : { viewBox: box }),
          ...(extrude === undefined ? {} : { extrude }),
          ...(depth === undefined ? {} : { depth }),
        });
        return {
          content: [{ type: 'text' as const, text: report(findings) }],
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
      annotations: { readOnlyHint: true },
      description: `Returns SVG markup for a diagram, and beside it the layout findings for the drawing it just made: overlapping boxes, text too wide for its box, a node out of frame. The markup is first and the findings second, so one call both draws and checks. Deterministic: the same diagram and seed produce the same bytes. ${TRAPS.coordinates} ${TRAPS.text} The markup names the handwriting font stack, so a browser draws it in the reader's own hand-drawn face.`,
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
          extrude,
          depth,
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
          'a diagram, a viewBox, and an optional seed, hops, extrude, depth, label and animate',
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
      label,
      animate,
    }) => {
      try {
        const svg = svgFor(d, box, {
          seed,
          label,
          hops,
          extrude,
          depth,
          animate,
        });
        // The findings for the drawing just made, not for a neighbouring one:
        // the same viewBox, the same extrude and the same depth, which are
        // the three arguments that move what every rule measures. `hops` is
        // absent because `check` refuses it and it changes no finding.
        //
        // Second, never first. The markup stays `content[0]` exactly as it
        // was, so a caller already reading that index is untouched by this.
        //
        // Its own `try`, and this is the whole reason for it: `check` is not
        // a superset of `draw`. It accepts less - `lines: 'a string'` draws
        // and does not check - so a shared `try` would turn a diagram that
        // rendered into an error and throw away 2.5 KB of correct markup for
        // a report nobody asked for. Ink you already have is never lost to a
        // second opinion about it.
        return {
          content: [
            { type: 'text' as const, text: svg },
            { type: 'text' as const, text: reportOf(d, box, extrude, depth) },
          ],
        };
      } catch (error) {
        return failed(error);
      }
    },
  );

  if (!raster) return;

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
  /** Draw every node as a slab, unless the node itself says otherwise. */
  extrude?: boolean | undefined;
  /** How deep, in px, for every extruded node carrying no depth of its own. */
  depth?: number | undefined;
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
  {
    seed,
    label,
    hops,
    extrude,
    depth,
    forRaster = false,
    animate = false,
  }: SvgOptions = {},
): string {
  // The rasterizer resolves no CSS custom properties, so it is given the
  // palette already resolved. `render_diagram` keeps the `var()` defaults,
  // because its SVG goes to a page that restyles it by redefining them.
  const inner = renderToString(d as Parameters<typeof renderToString>[0], {
    ...(seed === undefined ? {} : { seed }),
    ...(hops === undefined ? {} : { hops }),
    ...(extrude === undefined ? {} : { extrude }),
    ...(depth === undefined ? {} : { depth }),
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
