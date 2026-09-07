import { defaultTheme, type Theme } from '@pensketch/core';

// The three things `tools.ts` needs to know about the rasterizer without
// loading it.
//
// `render.ts` reaches `node:fs`, `node:module` and 2.5 MB of WebAssembly, and
// a static import of any of those three constants dragged the lot into every
// graph that imported the tools - including the HTTP entry, which passes
// `raster: false` and never registers the tool at all. The rasterizer is now
// behind a dynamic import at its one call site, and these live here so that
// import stays the only one.

export const EMBEDDED_FAMILY = 'Architects Daughter';

/**
 * The default palette with its `var()` wrappers taken off.
 *
 * Core writes a theme value into the markup verbatim, and its defaults are
 * `var(--ps-ink, #232B36)` and friends, which a browser resolves. This
 * rasterizer supports custom properties nowhere - not in a presentation
 * attribute, not in a `style` declaration - and it does not fall back to the
 * fallback either. An unparseable paint takes the property's initial value,
 * and those differ: `stroke` initially draws nothing, `fill` initially draws
 * black. So every line vanished and every group wash became a solid black
 * slab, while the labels kept drawing, in black, close enough to the ink to
 * look deliberate. The image was of a structure it never contained.
 *
 * Derived from `defaultTheme` rather than transcribed, so a palette change
 * reaches the PNG without anyone remembering this file exists. Adding a role
 * to `Theme` fails to compile here, which is the correct way to find out.
 */
const literal = (value: string): string =>
  value.startsWith('var(')
    ? value.slice(value.indexOf(',') + 1, -1).trim()
    : value;

export const RASTER_THEME: Theme = Object.freeze({
  ink: literal(defaultTheme.ink),
  pen: literal(defaultTheme.pen),
  accent: literal(defaultTheme.accent),
  muted: literal(defaultTheme.muted),
  wash: literal(defaultTheme.wash),
});

/** The largest scale a caller may ask for. Above this, the answer is no. */
export const MAX_SCALE = 4;
