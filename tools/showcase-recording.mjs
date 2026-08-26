import { shippedDiagrams } from './shipped-diagrams.mjs';

// The README's architecture GIF, as `record.mjs` wants a recording described:
//
// Regenerate both, from the repo root, after any change to the showcase:
//
//   npm run record -- tools/showcase-recording.mjs --scale 1.5 --fps 15 \
//     --duration 6000 --hold 2500 --out docs/assets/showcase-light.gif
//   npm run record -- tools/showcase-recording.mjs --scale 1.5 --fps 15 \
//     --duration 6000 --hold 2500 --theme dark --background '#161B21' \
//     --out docs/assets/showcase-dark.gif
//
// 1.5x rather than the stills' 2x, priced before it was chosen: 2x costs
// 1.22 MB a theme against 1.5x's 0.94, and 2010 px covers a retina reader at
// the width a README renders. 15 fps gives a 500 ms stroke seven frames;
// 6 s of drawing because twenty nodes at the default 4 read as a race.
//
// the showcase, read from the example page the way the checker and the asset
// pipeline already read it, so the recording cannot drift from the diagram it
// is a recording of. Nothing here is a second copy - the one thing this file
// owns is the decision that the README animates this diagram at this seed.
const page = (await shippedDiagrams()).find(({ key }) => key === 'showcase');

export default {
  diagram: page.diagram,
  viewBox: page.viewBox,
  options: page.options,
  seed: page.options?.seed ?? 7,
  label:
    "pensketch's own architecture, drawing itself: every drawn shape raised into a slab",
};
