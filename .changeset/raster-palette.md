---
'@pensketch/mcp': patch
---

`render_png` draws the diagram again. In `0.1.0` it drew none of it.

The markup core writes paints with `var(--ps-ink, #232B36)` and friends, which
a browser resolves and the WebAssembly rasterizer does not — in a presentation
attribute or a `style` declaration alike, and it does not fall back to the
fallback either. An unparseable paint takes the property's initial value, and
those differ by property: `stroke` initially draws nothing, `fill` initially
draws black. So every line disappeared — box outlines, arrows, group borders,
all of it — every group wash became a solid black slab, and the labels kept
drawing in black, close enough to the ink to look deliberate. The result was a
picture of a structure it did not contain, from a tool whose description calls
it authoritative about structure.

It now resolves the palette before rasterizing, taking the literal colours
from `defaultTheme` rather than a transcription of them, so a palette change
reaches the PNG on its own. `render_diagram` is untouched and still paints
with the variables, because its SVG goes to a page that restyles them.

The image also comes on warm paper (`#FCFAF5`) instead of transparency. A
transparent PNG of near-black ink is invisible in a client with a dark panel,
which is the same failure in a different costume, and the wash is five percent
blue and needs something to sit on.

Nothing caught this because nothing looked. The suite asserted a PNG signature
and a byte count, and blank paper satisfies both. It now reads the pixels and
demands ink of the right hue, which fails on the old code with `0` drawn.

Also: the `bin` path loses its `./`, which npm silently rewrote on every
publish while warning that it had been "invalid and removed" — it had not, but
the warning is alarming and now does not appear. And the README said the
server serves five resources; it serves six.
