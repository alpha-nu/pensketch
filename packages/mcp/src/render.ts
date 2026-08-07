import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

// Rasterization, kept away from the tools so that the tools stay a thin layer
// over `@pensketch/core`.
//
// Two files are read here, once, when the server starts: the WebAssembly
// binary and the embedded font. Both are the package's own, resolved by
// specifier rather than by a path a caller can influence, and neither is
// touched again while a tool is running. That is the line the purity rule
// draws — a tool is a pure function of its arguments; a process still has to
// load its own code.

const require = createRequire(import.meta.url);

/**
 * The face the PNG is drawn in. Not the one the SVG names: that stack is
 * Chalkboard SE and friends, proprietary system faces that cannot be
 * redistributed. This is the open-licence face whose measured glyph advance
 * sits closest to theirs, so the picture is honest about how much room text
 * takes even though it cannot be honest about the letterforms.
 */
const FONT = new URL('../fonts/ArchitectsDaughter-Subset.ttf', import.meta.url);

/** The name the embedded face answers to, written into the SVG we rasterize. */
export const EMBEDDED_FAMILY = 'Architects Daughter';

/** The largest scale a caller may ask for. Above this, the answer is no. */
export const MAX_SCALE = 4;

/** Refused above this many pixels on either side, whatever the scale. */
export const MAX_PIXELS = 4096;

let ready: Promise<void> | undefined;
let font: Uint8Array | undefined;

// Once per process, and only when the first PNG is asked for: an agent that
// only ever calls `check_diagram` should not pay for a rasterizer.
const load = () => {
  ready ??= initWasm(
    readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')),
  );
  font ??= new Uint8Array(readFileSync(FONT));
  return ready;
};

/** Everything `renderPng` needs that the caller did not draw. */
export interface RasterOptions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Rasterizes complete SVG markup. Deterministic: the same markup and scale
 * produce the same bytes, because the only font in play is the one shipped
 * beside this file and system fonts are never consulted — in this build they
 * could not be anyway, the WebAssembly module having no filesystem behind it.
 *
 * Throws when the result would exceed `MAX_PIXELS` on a side, rather than
 * spending the memory and handing back an image no client will display.
 */
export async function renderPng(
  svg: string,
  { width, height, scale }: RasterOptions,
): Promise<Uint8Array> {
  if (scale < 1 || scale > MAX_SCALE)
    throw new Error(
      `scale must be between 1 and ${MAX_SCALE}; ${scale} was asked for`,
    );

  const side = Math.max(width, height) * scale;
  if (side > MAX_PIXELS)
    throw new Error(
      `${width}x${height} at ${scale}x is ${Math.round(side)}px on its longest side, over the ${MAX_PIXELS}px limit; ask for a smaller scale`,
    );

  await load();
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.round(width * scale) },
    font: {
      // `load` has just resolved, so the font is here. Asserted rather than
      // guarded: a fallback for a state that cannot arise is a branch no test
      // can reach, and an empty buffer list would silently draw no text.
      fontBuffers: [font as Uint8Array],
      loadSystemFonts: false,
      defaultFontFamily: EMBEDDED_FAMILY,
    },
  })
    .render()
    .asPng();
}
