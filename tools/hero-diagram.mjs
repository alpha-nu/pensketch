// The hero diagram's data half, in one place because two things read it: the
// asset pipeline that renders `docs/assets/hero-{light,dark}.png`, and the
// checker that holds every diagram this repository ships to the rules it
// publishes. A picture in the README that broke its own rules would be the
// least defensible diagram in the project.
//
// The `raw` callbacks stay in `render-assets.mjs`. They are functions, and the
// page function that draws this is handed its argument as JSON, so a callback
// cannot cross that boundary - and the checker has nothing to say about `raw`
// in any case.

/** The `<svg viewBox>` the hero is drawn into, as the checker wants it. */
export const HERO_VIEW_BOX = [0, 0, 880, 300];

export const HERO = {
  nodes: [
    {
      id: 'g',
      shape: 'group',
      x: 30,
      y: 30,
      w: 620,
      h: 240,
      lines: ['a diagram, from plain data'],
    },
    {
      id: 'in',
      shape: 'pill',
      x: 60,
      y: 95,
      w: 150,
      h: 52,
      lines: ['request'],
    },
    {
      id: 'gate',
      shape: 'diamond',
      x: 270,
      y: 85,
      w: 150,
      h: 76,
      lines: ['cached?'],
      size: 13,
    },
    {
      id: 'work',
      shape: 'box',
      x: 480,
      y: 95,
      w: 150,
      h: 52,
      lines: ['render'],
      accent: true,
    },
    {
      id: 'store',
      shape: 'box',
      x: 270,
      y: 200,
      w: 150,
      h: 52,
      lines: ['cache'],
      hatch: true,
    },
  ],
  edges: [
    { from: ['in', 'r'], to: ['gate', 'l'] },
    {
      from: ['gate', 'r'],
      to: ['work', 'l'],
      label: 'miss',
      lx: 450,
      ly: 105,
    },
    {
      from: ['gate', 'b'],
      to: ['store', 't'],
      dotted: true,
      label: 'hit',
      lx: 352,
      ly: 186,
      anchor: 'start',
    },
    {
      from: ['store', 'l'],
      to: ['in', 'b'],
      via: [[135, 226]],
    },
    // What a miss does after it renders, and the edge that finishes the story
    // the other four only half told. Bowed away from the corner it would
    // otherwise cut, which is `bow` doing the one thing a straight run and a
    // list of corners between them could not.
    {
      from: ['work', 'b'],
      to: ['store', 'r'],
      bow: -22,
      label: 'fill',
      lx: 520,
      ly: 214,
      anchor: 'start',
    },
  ],
  // A brace over the whole drawing, which is what the sentence beside it is
  // about. It replaced a note carrying these same two lines with a pointer
  // that aimed them at one box: "same seed, same bytes" is a claim about every
  // stroke here, and a brace marks a span without enclosing it, where a second
  // rectangle round the group would have read as another stage.
  //
  // The words are the note's unchanged, deliberately. "same data" would have
  // been a stronger claim than this project makes anywhere else: the README
  // says same data, same seed, same version, same engine, same bytes, and a
  // test asserts that one diagram at two seeds serializes differently.
  braces: [
    {
      from: [666, 42],
      to: [666, 258],
      depth: -22,
      lines: ['same seed,', 'same bytes'],
      lx: 700,
      ly: 120,
    },
  ],
};
