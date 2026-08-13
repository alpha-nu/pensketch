import { describe, expect, it } from 'vitest';
import type { Diagram, DiagramEdge, DrawOptions } from '../src/index';
import { draw } from '../src/index';
import { makeSvg, nth, pathsOf } from './helpers';

// A break is drawn by cutting one path into runs, and every run is a `stroke`,
// which is two `<path>` elements. So counting paths counts breaks: each one
// adds a run, and each run adds two paths. Nothing here reads coordinates -
// where the break lands is settled by the geometry tests below it, and what
// this counts is whether a break happened at all.
const paths = (diagram: Diagram, options: DrawOptions = {}): number => {
  const svg = makeSvg();
  draw(svg, diagram, { seed: 7, ...options });
  return pathsOf(svg).length;
};

// Two nodes far apart, so an edge between them is a long line with room for a
// crossing in the middle of it rather than under either arrowhead.
const NODES: Diagram['nodes'] = [
  { id: 'nw', shape: 'box', x: 0, y: 0, w: 40, h: 20 },
  { id: 'ne', shape: 'box', x: 360, y: 0, w: 40, h: 20 },
  { id: 'sw', shape: 'box', x: 0, y: 360, w: 40, h: 20 },
  { id: 'se', shape: 'box', x: 360, y: 360, w: 40, h: 20 },
];

// `nw.r -> se.l` and `ne.l -> sw.r` cross in the middle of the frame, well
// clear of both arrowheads.
const CROSSING: DiagramEdge[] = [
  { from: ['nw', 'r'], to: ['se', 'l'] },
  { from: ['ne', 'l'], to: ['sw', 'r'] },
];

describe('a connector that goes over breaks the one underneath', () => {
  it('draws exactly what it drew before when nothing asks for a hop', () => {
    const d: Diagram = { nodes: NODES, edges: CROSSING };
    expect(paths(d, { hops: true })).toBeGreaterThan(paths(d));
    // And the default is off at both levels, so the two ways of saying
    // "nothing" agree with each other.
    expect(paths(d)).toBe(
      paths({ ...d, edges: CROSSING.map((e) => ({ ...e, hop: false })) }),
    );
  });

  it('breaks the other edge, not the one carrying the field', () => {
    const d: Diagram = { nodes: NODES, edges: CROSSING };
    const base = paths(d);
    // Whichever of the pair goes over, exactly one break appears - one extra
    // run, so one extra `stroke`, so two extra paths.
    const first = paths({
      ...d,
      edges: [{ ...nth(CROSSING, 0), hop: true }, nth(CROSSING, 1)],
    });
    const second = paths({
      ...d,
      edges: [nth(CROSSING, 0), { ...nth(CROSSING, 1), hop: true }],
    });
    expect(first).toBe(base + 2);
    expect(second).toBe(base + 2);
  });

  it('lets one edge opt out of a diagram-wide switch', () => {
    const d: Diagram = { nodes: NODES, edges: CROSSING };
    const both = paths(d, { hops: true });
    // With both hopping the later index wins, so edge 0 is the one broken.
    // Taking edge 1 out of it moves the break onto edge 1 rather than
    // removing it: the crossing is still a crossing, and edge 0 still hops.
    const out = paths(
      {
        ...d,
        edges: [nth(CROSSING, 0), { ...nth(CROSSING, 1), hop: false }],
      },
      { hops: true },
    );
    expect(both).toBe(paths(d) + 2);
    expect(out).toBe(paths(d) + 2);
    // `??` and not `||`: `false` has to be a value here, not an absence.
    const off = paths(
      {
        ...d,
        edges: CROSSING.map((e) => ({ ...e, hop: false })),
      },
      { hops: true },
    );
    expect(off).toBe(paths(d));
  });

  it('leaves a fan-out at one anchor whole', () => {
    // Three connectors leaving one anchor meet at a shared endpoint, which is
    // not an interior crossing. A test that admitted endpoints would decorate
    // this fan with breaks it should not have.
    const d: Diagram = {
      nodes: [
        { id: 'src', shape: 'box', x: 180, y: 0, w: 40, h: 20 },
        { id: 'a', shape: 'box', x: 0, y: 200, w: 40, h: 20 },
        { id: 'b', shape: 'box', x: 180, y: 200, w: 40, h: 20 },
        { id: 'c', shape: 'box', x: 360, y: 200, w: 40, h: 20 },
      ],
      edges: [
        { from: ['src', 'b'], to: ['a', 't'] },
        { from: ['src', 'b'], to: ['b', 't'] },
        { from: ['src', 'b'], to: ['c', 't'] },
      ],
    };
    expect(paths(d, { hops: true })).toBe(paths(d));
  });

  it('is not broken by a connector that ends on it', () => {
    // The case the strict interior test actually earns its keep on, and the
    // only one in this file that does. A fan-out is protected one step later
    // anyway - a crossing at a shared *start* has `t0 <= 0`, which the
    // high-water guard drops whatever the interior test said - so relaxing
    // `>=` to `>` leaves the fan-out assertion above green and proves nothing.
    //
    // Here the vertical *terminates* on the horizontal: interior to the run
    // being considered, but an endpoint of the run doing the crossing. Strict,
    // that is not a crossing and nothing is cut. Inclusive, the horizontal is
    // broken in the middle by a line that merely arrives at it.
    const d: Diagram = {
      nodes: [
        { id: 'left', shape: 'box', x: 0, y: 90, w: 40, h: 20 },
        { id: 'right', shape: 'box', x: 300, y: 90, w: 40, h: 20 },
        { id: 'top', shape: 'box', x: 140, y: 0, w: 40, h: 20 },
        // Its top edge sits exactly on the line `left -> right` draws.
        { id: 'meets', shape: 'box', x: 140, y: 100, w: 40, h: 20 },
      ],
      edges: [
        { from: ['left', 'r'], to: ['right', 'l'] },
        { from: ['top', 'b'], to: ['meets', 't'] },
      ],
    };
    expect(paths(d, { hops: true })).toBe(paths(d));
  });

  it('leaves two connectors drawn along one another whole', () => {
    // Parallel, and collinear for part of their length: there is no crossing
    // to break for, and a break here would decorate a defect rather than
    // clarify anything.
    const d: Diagram = {
      nodes: [
        { id: 'top', shape: 'box', x: 0, y: 0, w: 40, h: 20 },
        { id: 'mid', shape: 'box', x: 0, y: 200, w: 40, h: 20 },
        { id: 'end', shape: 'box', x: 0, y: 400, w: 40, h: 20 },
      ],
      edges: [
        { from: ['top', 'b'], to: ['end', 't'] },
        { from: ['mid', 'b'], to: ['end', 't'] },
      ],
    };
    expect(paths(d, { hops: true })).toBe(paths(d));
  });

  it('drops a break that would fall under the arrowhead', () => {
    // A gap there would eat the head, and `arrow` takes its angle from the
    // last two points of the run it is handed - which would be the run that
    // stops short of the head rather than the edge's own direction.
    //
    // `at` places the crossing that many px before the horizontal edge lands,
    // and the crossing has to be *interior* to be dropped by the guard rather
    // than by the strict-interior test: a vertical through the anchor itself
    // is excluded one step earlier and would prove nothing about `HEAD_LEN`.
    const crossedAt = (at: number): Diagram => {
      const x = 300 - at;
      return {
        nodes: [
          { id: 'from', shape: 'box', x: 0, y: 100, w: 40, h: 20 },
          { id: 'to', shape: 'box', x: 300, y: 100, w: 40, h: 20 },
          { id: 'up', shape: 'box', x: x - 20, y: 0, w: 40, h: 20 },
          { id: 'down', shape: 'box', x: x - 20, y: 220, w: 40, h: 20 },
        ],
        // Neither carries `hop`, so the `hops` option is the only thing that
        // varies between the two measurements below.
        edges: [
          { from: ['from', 'r'], to: ['to', 'l'] },
          { from: ['up', 'b'], to: ['down', 't'] },
        ],
      };
    };
    // 4 px short of the head: inside `HEAD_LEN`, so no break.
    const near = crossedAt(4);
    expect(paths(near, { hops: true })).toBe(paths(near));
    // The control, without which the assertion above passes for any reason at
    // all: the same crossing well clear of the head does break.
    const far = crossedAt(100);
    expect(paths(far, { hops: true })).toBe(paths(far) + 2);
  });
});
