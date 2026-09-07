import { readFileSync } from 'node:fs';

// The visual system, in one tracked file because more than one tool draws
// from it and a palette copied into a second file is exactly the drift the
// generators here exist to prevent.
//
// It lived under `content/` until 2026-09-07, which is untracked, so nothing
// tracked could import it. The values are the owner-approved system and do
// not move; what moved is their address, and `content/tools/tokens.mjs`
// re-exports this rather than holding a copy.
//
// That re-export makes `content/` a downstream consumer of the font path
// below, and `content/` is excluded from git - so no gate in this repository
// can see it break. Moving `packages/mcp/fonts/` fails `npm run showcase`
// loudly and fails the post pipeline silently, which is why the coupling is
// written down here rather than left to be discovered when a deck stops
// building.

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
 * The licence that face is under, read rather than transcribed.
 *
 * OFL 1.1 clause 2: a Modified Version may be redistributed "provided that
 * each copy contains the above copyright notice and this license". Subsetting
 * is modification - the OFL FAQ says so in as many words - and the subset's
 * `name` table keeps the copyright but carries no licence record, so anything
 * that embeds these bytes has to carry the text itself.
 *
 * The npm tarball already does, beside the font. Anything else that
 * redistributes it reads this, so the notice cannot drift from the file it
 * quotes.
 */
export const FACE_LICENCE = readFileSync(
  new URL('packages/mcp/fonts/OFL.txt', root),
  'utf8',
);

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

/**
 * The same five roles for a dark viewer, which the repository's own example
 * pages already carry a copy of each.
 *
 * Here because this module exists to stop a palette living in two files, and
 * the first draft of the showcase generator hand-typed these five values -
 * making it the seventh copy, added by the very generator that motivated
 * moving the first six.
 */
export const DARK = {
  paper: '#15191F',
  ink: '#D9DFE7',
  pen: '#7FA9DB',
  accent: '#DB8570',
  muted: '#93A0AD',
  wash: 'rgba(127, 169, 219, .07)',
  rule: 'rgba(217, 223, 231, .18)',
};

/** Prose. */
export const SERIF = 'Charter, "Iowan Old Style", Georgia, serif';

/** Anything a reader is meant to read as data: counts, coordinates, code. */
export const MONO = 'Menlo, ui-monospace, monospace';
