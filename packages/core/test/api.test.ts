import { describe, expect, it } from 'vitest';
import * as named from '../src/constants';
import * as barrel from '../src/index';
import { constants, pen } from '../src/index';
import { makeSvg } from './helpers';

// The runtime half of the documented surface. Types are erased before this
// list can see them; they are held to the same contract by the type
// annotations the rest of the suite imports from the barrel, which only
// typecheck while every one of them is exported.
const PUBLIC_EXPORTS = [
  'anchor',
  'constants',
  'defaultTheme',
  'draw',
  'mulberry32',
  'pen',
];

const PEN_MEMBERS = [
  'stroke',
  'arrow',
  'rect',
  'pill',
  'arc',
  'diamond',
  'hatch',
  'label',
  'wash',
  'rng',
];

describe('the public surface is closed', () => {
  // Equality, not containment: an export added by accident is as much a
  // breach of the contract as one missing, and only the package can remove it
  // again once it has shipped.
  it('exports exactly the documented names and nothing else', () => {
    expect(Object.keys(barrel).sort()).toEqual([...PUBLIC_EXPORTS].sort());
  });

  it('gives a pen exactly the documented members', () => {
    expect(Object.keys(pen(makeSvg()))).toEqual(PEN_MEMBERS);
  });

  it('freezes the constants object', () => {
    expect(Object.isFrozen(constants)).toBe(true);
  });

  // The frozen object and the named exports are one set said twice: a
  // constant that reaches the renderer without appearing here would be a
  // magic number no test or document could see.
  it('collects every named aesthetic constant, and only those', () => {
    const { constants: _frozen, ...individual } = named;
    expect({ ...constants }).toEqual(individual);
  });
});

// The aesthetic constants are the look, and the look is the product. Pinning
// their values here means a change to any one of them fails a test that says
// so plainly, rather than surfacing only as moved bytes in a golden file.
describe('constants', () => {
  it('holds exactly these values', () => {
    expect({ ...constants }).toEqual({
      SEG_LEN: 26,
      MIN_STEPS: 2,
      END_DAMP: 0.4,
      WIDTH: 1.6,
      AMP: 2.6,
      PASS2_W: 0.75,
      OP1: 0.92,
      OP2: 0.5,
      DASH: '2 7',
      HEAD_LEN: 10,
      HEAD_SPREAD: 0.5,
      HEAD_AMP: 1.2,
      OVERSHOOT: 4,
      PILL_STEPS: 26,
      PILL_JX: 3,
      PILL_JY: 2,
      PILL_AMP: 1.4,
      ARC_STEPS: 26,
      ARC_MIN_CHORD: 12,
      HATCH_GAP: 11,
      HATCH_W: 1,
      HATCH_AMP: 1.2,
      HATCH_INSET: 4,
      SIZE: 13.5,
      LINE_H: 1.28,
      WASH_RX: 6,
      GROUP_W: 1.4,
      GROUP_AMP: 3.2,
      TITLE_DX: 14,
      TITLE_DY: 18,
      TITLE_SIZE: 14,
      EDGE_SIZE: 12.5,
      LOOP_OUT: 30,
      LOOP_SPAN: 40,
      BRACE_DEPTH: 26,
      BRACE_R: 13,
      NOTE_SIZE: 13,
      NOTE_AMP: 2,
      SEED: 1,
    });
  });
});
