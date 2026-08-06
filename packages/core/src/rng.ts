/**
 * The mulberry32 generator: the only source of randomness in the package. It
 * is pure and never reseeded from a clock, so a seed replays the same
 * sequence of floats in `[0, 1)` every time, out of integer arithmetic that
 * ECMAScript specifies exactly. The order in which callers consume that
 * sequence is part of the rendered output - reordering draw operations moves
 * every wobble after the change - which is what makes a diagram rendered on a
 * given engine safe to compare byte for byte.
 *
 * The seed is truncated to 32 bits, so it is an integer's worth of choice.
 */
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
