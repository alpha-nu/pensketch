import { describe, expect, it } from 'vitest';
import type { Diagram } from '../src/index';
import { draw } from '../src/index';
import { SAMPLER } from './fixtures';
import { makeSvg } from './helpers';
import { serialize } from './serialize.mjs';

// The witness for the two-decimal write. The rule lives at pen.ts's two
// funnels - `pass()` where path data becomes text, `el()` where a numeric
// attribute does - and a rule enforced at two sites is watched over the whole
// surface those sites write: one render, serialized by the serializer the
// goldens are written with, scanned number by number. A writer that bypasses
// either funnel fails here by existing.
//
// Two spans are exempt, and each exemption is the rule stated precisely
// rather than a hole in it:
//
// - the `style` attribute. `el()` never stringifies it - it is text composed
//   upstream of the funnel, `pen.label`'s base and `draw`'s stagger stamp
//   alike - and it carries draw's own fixed-format variables,
//   whose formats are their own pinned contracts: `--ps-i` at three decimals,
//   because the thousandths are 1,000 distinct stagger steps (order.test.ts
//   pins the format; the animation package's rules.test.ts spends it), and
//   `--ps-len` at two.
// - text content. A label's words are the caller's data: a label saying
//   "27.123" is not the renderer writing a number, and brevity is not owed
//   on someone else's behalf.

// SAMPLER already reaches the shapes, the group, the hatch, the dotted edge,
// the note's arrow, the multi-line labels and the raw callbacks; the writers
// it stops short of are added here rather than kept in a parallel fixture.
const FIXTURE: Diagram = {
  ...SAMPLER,
  edges: [
    ...(SAMPLER.edges ?? []),
    // A bow, labelled at coordinates that are themselves fractional, so an
    // edge label's x and y enter the scan already carrying decimals.
    {
      from: ['p', 'r'],
      to: ['b', 'r'],
      bow: 30,
      label: 'bows back',
      lx: 552.5,
      ly: 178.25,
    },
    // A loop: a self-transition at the default reach and span.
    { from: ['h', 'b'], to: ['h', 'b'] },
  ],
  braces: [
    { from: [60, 415], to: [240, 415], lines: ['a brace'], lx: 150, ly: 440 },
  ],
};

// Both options are load-bearing. `order: true` stamps a three-decimal
// `--ps-i` into the very serialization under scan, so the style carve-out is
// exercised rather than decorative; `extrude: true` puts a slab behind every
// box, pill and diamond - a group never extrudes - so the depth writer's
// coordinates go through the scan too.
const rendered = (): SVGSVGElement => {
  const svg = makeSvg();
  draw(svg, FIXTURE, { seed: 7, order: true, extrude: true });
  return svg;
};

// A number as a reader of the file meets it: digits, a point, and the
// fractional digits whose count is the whole claim. Sorted into the numbers
// the rule permits - one or two decimals - and the ones it forbids.
const fractions = (text: string) => {
  const brief: string[] = [];
  const long: string[] = [];
  for (const found of text.matchAll(/-?\d+\.(\d+)/g))
    ((found[1] ?? '').length >= 3 ? long : brief).push(found[0]);
  return { brief, long };
};

// The carve-outs are taken structurally, off a clone: drop the one exempt
// attribute and every <text>'s words, then hand the clone to the shared
// serializer, so the scanned text is the file's own bytes minus exactly the
// two exempt spans. Excising `style="..."` from composed lines with a regex
// instead would have to reason about where a span ends inside a line that
// also holds the caller's label text.
const scannable = (svg: SVGSVGElement): string => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  for (const el of Array.from(clone.querySelectorAll('*'))) {
    el.removeAttribute('style');
    if (el.tagName.toLowerCase() === 'text') el.textContent = '';
  }
  return serialize(clone);
};

describe('the two-decimal write, witnessed over a whole render', () => {
  it('writes no number past two decimals, path data and attributes alike', () => {
    const { brief, long } = fractions(scannable(rendered()));
    // The offenders by their own text, so a red run names the numbers.
    expect(long).toEqual([]);
    // Green is not evidence on its own: a scan over integers would pass with
    // both funnels gutted. The fixture demonstrably feeds it - measured at
    // 2,978 numbers of one or two decimals at this seed, asserted at a round
    // floor so a fixture tweak moves the count without failing the claim.
    expect(brief.length).toBeGreaterThanOrEqual(1000);
  });

  it('spares the three-decimal --ps-i that style carries by design', () => {
    const whole = serialize(rendered());
    // Both halves, or the exemption tests nothing: the file as written does
    // hold three-decimal numbers - the stagger rank `order: true` stamps -
    // and they live only where the scan above deliberately does not look.
    expect(whole).toMatch(/--ps-i:0\.\d{3};/);
    expect(fractions(whole).long.length).toBeGreaterThan(0);
  });
});
