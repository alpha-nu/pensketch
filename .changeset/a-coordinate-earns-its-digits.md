---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

Every number the renderer writes into markup carries at most two decimals,
rounded as the last act before the value becomes text. Rendered output
changes on every diagram — anyone snapshot-testing their own drawings will
see every snapshot move, once — and shrinks by about 40%: a typical figure
drops from 28.3 kB to 16.7 kB, which for a caller who pays by the token is
roughly four thousand of them back on every render.

What a reader can see does not move. The geometry is computed at full
precision throughout — anchors, findings, the seeded jitter and the order
it is consumed in are all untouched — and the written digits quantize by at
most 0.005 viewBox units, 0.4% of the smallest deliberate wobble the pen
makes and 0.02 device pixels at the raster boundary's largest scale. The
same rule ends a wart: IEEE-754 noise no longer reaches the file, so the
second pass writes `stroke-width="1.2"`, not `1.2000000000000002`.

`@pensketch/mcp` is named here because its rendered output is core's: the
markup `render_diagram` returns and `render_png` rasterizes moves with the
same release, and a dependency-only patch would claim a byte-stability this
version does not have.
