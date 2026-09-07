import { readFileSync } from 'node:fs';

// The visual system, in one tracked file because more than one tool draws
// from it and a palette copied into a second file is exactly the drift the
// generators here exist to prevent.
//
// It lived under `content/` until 2026-09-07, which is untracked, so nothing
// tracked could import it. The values are the owner-approved system and do
// not move; what moved is their address, and `content/tools/tokens.mjs`
// re-exports this rather than holding a copy.

const root = new URL('../', import.meta.url);

/**
 * The hand face the figures are set in, base64 for embedding as a data: URI.
 *
 * The MCP server's copy, rather than a second one: it is already in the
 * repository because the rasterizer needs a face it may redistribute, and a
 * second checkout of the same 30 KB is a second thing to keep in step.
 */
export const FACE = readFileSync(
  new URL('packages/mcp/fonts/ArchitectsDaughter-Subset.ttf', root),
).toString('base64');

/**
 * The palette. `ink`, `pen`, `accent`, `muted` and `wash` are the five names
 * `@pensketch/core` reads as `--ps-*`; `paper` and `rule` are the page around
 * a drawing rather than anything inside one.
 */
export const P = {
  paper: '#F6F4EE',
  ink: '#232B36',
  pen: '#2B5B8A',
  accent: '#B3402E',
  muted: '#5A6572',
  wash: 'rgba(43, 91, 138, .05)',
  rule: 'rgba(35, 43, 54, .16)',
};

/** Prose. */
export const SERIF = 'Charter, "Iowan Old Style", Georgia, serif';

/** Anything a reader is meant to read as data: counts, coordinates, code. */
export const MONO = 'Menlo, ui-monospace, monospace';
