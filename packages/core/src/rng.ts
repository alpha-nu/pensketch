// The only source of randomness in the package. It is seeded, pure, and
// never reseeded from a clock, so the same seed always replays the same
// sequence. The order in which callers consume that sequence is part of the
// rendered output: reordering draw operations moves every wobble after it.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
