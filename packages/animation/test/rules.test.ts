import { describe, expect, it } from 'vitest';
import { rules } from '../src/rules';
import { declaredIn, rulesIn, splitKeyframes } from './helpers';

// Everything below is read off the stylesheet by parsing it, never by matching
// a string somebody wrote twice. jsdom cannot compute `@scope` or run an
// animation, so what is provable here is the shape of the rules; what they do
// is measured in a browser.
const { keyframes, rest } = splitKeyframes(rules);
const styleRules = rulesIn(rest);
const animating = styleRules.filter(({ body }) => body !== 'animation:none');
const switched = styleRules.filter(({ body }) => body === 'animation:none');

const unique = (names: string[]) => [...new Set(names)].sort();

const keyframeOf = (name: string): string => {
  const found = keyframes.find((block) =>
    block.startsWith(`@keyframes ${name}{`),
  );
  if (!found)
    throw new Error(
      `no @keyframes ${name}; the stylesheet has ${keyframes.length}`,
    );
  return found;
};

/** Which reveal each selector names, and what that reveal moves. */
const REVEALS = [
  {
    what: 'a solid stroke, dashed the length of itself and slid home',
    selector: ':scope>path:not([stroke-dasharray])',
    keyframes: 'ps-draw',
    channels: ['stroke-dasharray', 'stroke-dashoffset'],
  },
  {
    what: 'a dashed stroke, faded so its dashes survive',
    selector: ':scope>path[stroke-dasharray]',
    keyframes: 'ps-fade',
    channels: ['stroke-opacity'],
  },
  {
    what: 'text and anything else that is not a path',
    selector: ':scope>:not(path)',
    keyframes: 'ps-write',
    channels: ['opacity'],
  },
];

describe('every starting state lives inside a keyframe', () => {
  // The clause the whole degradation story rests on. A `--ps-i` that is absent -
  // an older core, a bare `pen`, a caller who forgot `order` - makes the
  // shorthand invalid at computed-value time and `animation-name` computes to
  // `none`. Anything set outside the keyframes survives that, and a
  // `stroke-dasharray: 1` surviving alone on a path declared one unit long
  // puts the gap over the whole line.
  it('declares one property outside the keyframes, and it is the animation', () => {
    expect(unique(declaredIn(rest))).toEqual(['animation']);
  });

  it('gives every reveal a `from` block and `both` for its fill mode', () => {
    for (const { keyframes: name } of REVEALS)
      expect(keyframeOf(name)).toContain('from{');
    for (const { body } of animating) expect(body.endsWith(' both')).toBe(true);
  });

  it.each(REVEALS)('hides $what only in its keyframes', (reveal) => {
    expect(unique(declaredIn(keyframeOf(reveal.keyframes)))).toEqual(
      [...reveal.channels].sort(),
    );
  });
});

describe('the reveal each element gets', () => {
  it('pairs each selector with its own keyframes and nothing else', () => {
    expect(
      animating.map(({ selector, body }) => [selector, body.split(' ')[0]]),
    ).toEqual(
      REVEALS.map(({ selector, keyframes: name }) => [
        selector,
        `animation:${name}`,
      ]),
    );
  });

  // The pen carries its two-pass weighting - a dark pass and a lighter one,
  // which is what reads as pressure - in an `opacity` attribute, and a CSS
  // `opacity` beats it. A dashed stroke is a path and has one; text does not.
  it('fades a dashed stroke on `stroke-opacity`, never on `opacity`', () => {
    const dashed = keyframeOf('ps-fade');
    expect(declaredIn(dashed)).toEqual(['stroke-opacity']);
    expect(declaredIn(dashed)).not.toContain('opacity');
  });
});

describe('the rules are scoped to the drawing they came in', () => {
  // No prelude: the scoping root is then the stylesheet's own parent, which is
  // the `<svg>` it was put inside.
  it('opens an `@scope` with no prelude', () => {
    expect(rules).toContain('@scope{');
    expect(rules).not.toMatch(/@scope\s*\(/);
  });

  it('stamps no class and no id, matching on what the renderer wrote', () => {
    for (const { selector } of styleRules) {
      expect(selector).not.toContain('.');
      expect(selector).not.toContain('#');
    }
  });
});

describe('the stagger is inside the shorthand', () => {
  // A delay in a separate, lower-specificity `animation-delay` declaration is
  // silently reset to zero by this shorthand and the entire drawing lands at
  // once - which looks like a working animation that is merely fast, and so is
  // not caught by looking. The assertion above that `animation` is the only
  // property declared outside the keyframes is the other half of this.
  it.each(REVEALS)('gives $what a duration then a delay', ({ selector }) => {
    const rule = animating.find((found) => found.selector === selector);
    expect(rule?.body).toMatch(
      /^animation:ps-\w+ var\(--ps-stroke,[^)]+\) calc\(.+\) var\(--ps-ease,[^)]+\) both$/,
    );
    expect(rule?.body).toContain('var(--ps-i)');
  });

  it('gives `--ps-i` no fallback, so its absence switches the animation off', () => {
    expect(rules).not.toMatch(/var\(\s*--ps-i\s*,/);
  });

  // A stroke longer than the whole drawing is a span below zero, and nothing
  // downstream refuses it: the delays go negative, most of the drawing is
  // already part drawn at t=0 and the stagger runs backwards. `duration:
  // STEP - 400` is the shape that reaches it, and it is the pattern this
  // project's own React example uses, so the smaller step is the caller's to
  // pick and not a hypothetical.
  it('clamps the span at zero, so a stroke past the duration cannot reverse it', () => {
    for (const { body } of animating)
      expect(body).toContain(
        'calc(var(--ps-i)*max(0s,var(--ps-dur,2s) - var(--ps-stroke,.5s)))',
      );
  });
});

// The three numbers this package publishes. They are documented in three places
// that cannot see this file - `docs/agents.md`, which is served to agents as
// `pensketch://spec`, this package's README, and the React example - and they
// live only in the `var()` fallbacks below, which is the arrangement the doc
// comment on `rules` promises ("the defaults live here ... and nowhere else").
//
// Every other assertion in this file matches a fallback with `[^)]+` or `.+`,
// which swallows whatever is written there, and `tools/check-animation.mjs`
// always passes an explicit duration - so `.5s` was changed to `.8s` and 441
// unit tests and 10 browser checks stayed green. This is the one exact match.
describe('the published defaults', () => {
  it('are 2s, .5s and ease-out, and there are exactly three of them', () => {
    const fallbacks = [...rules.matchAll(/var\((--ps-[a-z]+),\s*([^)]+)\)/g)];
    expect(
      Object.fromEntries(fallbacks.map(([, name, value]) => [name, value])),
    ).toEqual({
      '--ps-dur': '2s',
      '--ps-stroke': '.5s',
      '--ps-ease': 'ease-out',
    });
  });
});

describe('reduced motion is one declaration', () => {
  it('switches the animation off and does nothing else', () => {
    expect(switched).toHaveLength(1);
    const only = switched[0] as { selector: string; body: string };
    expect(rest).toContain(
      `@media (prefers-reduced-motion:reduce){${only.selector}{animation:none}}`,
    );
  });

  // "At least as specific" is settled by being the same selector: repeated
  // verbatim, each one ties with the rule it switches off and wins on order. A
  // lower-specificity `animation: none` would lose, and the drawing would keep
  // running under `reduce`.
  it('repeats every animating selector verbatim, so none outranks it', () => {
    const only = switched[0] as { selector: string };
    const list = only.selector.split(',').map((one) => one.trim());
    expect(list).toEqual(animating.map(({ selector }) => selector));
  });
});
