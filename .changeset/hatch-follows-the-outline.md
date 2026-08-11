---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

Hatching follows the outline it is drawn inside, not the box that outline sits
in.

**Rendered output changes.** Any diagram with `hatch: true` on a `pill` or a
`diamond` renders different bytes — that is the fix, not a side effect. A
hatched `box` is unchanged down to the byte, and so is every diagram without a
hatched pill or diamond in it: the box path is untouched code, and none of this
repository's parity goldens moved.

Until now `hatch` shaded the node's rectangle whatever outline was drawn round
it. On a box that is the shape. On a pill it overshot the ellipse by up to
15.5 px — a third of the height — on the 150 × 50 this repository ships. On a
diamond it filled all four corners of the box, which is half the box's area and
none of the shape's. Measured on the ink itself: 82 of 340 sampled points
outside the pill's outline, 46 of 78 outside the diamond's.

Now each diagonal is cut to the shape's own outline, and the shading stands
`HATCH_INSET` clear of it measured perpendicular to the line drawn — not clear
of the box, which on a wide diamond was a fraction of that: 1.81 px on the
150 × 76 this repository ships, and nothing at all at 278 × 30, where hatch ink
lay on the outline. Swept over 5566 sizes from 60 × 30 to 300 × 120, ink now
comes no closer than 3.21 px on a diamond and 1.85 px on a pill, against the
3.40 px a box holds.

`pen.hatch` takes an optional sixth argument, a `clip` polygon, which is how
`draw` does it and how a `raw` callback can shade inside a shape it traced
itself:

```js
raw: [
  (p) => {
    const star = [[100, 20], [118, 66], [166, 68], [128, 98], [141, 144],
                  [100, 118], [59, 144], [72, 98], [34, 68], [82, 66]];
    p.stroke([...star, star[0]]);
    p.hatch(34, 20, 132, 124, undefined, star);
  },
],
```

Concave is fine, and so is self-intersecting: crossings are paired in order
along each line, which fills by the even-odd rule. The polygon may repeat its
first point or not.

`@pensketch/mcp` reissues because the reference it serves as
`pensketch://spec`, and the JSON Schema it serves beside it, both describe this.
