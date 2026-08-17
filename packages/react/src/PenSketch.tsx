import { type Diagram, draw, type Theme } from '@pensketch/core';
import {
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

/**
 * Everything an `<svg>` takes, minus its children - the diagram owns them -
 * plus what pensketch needs to draw one.
 */
export interface PenSketchProps
  extends Omit<ComponentPropsWithoutRef<'svg'>, 'children'> {
  /**
   * Makes the diagram draw itself. Applied to the element after `draw` has
   * filled it and inside the same effect, so what it decorates is what that
   * effect has just created - and the drawing is stamped with the renderer's
   * `order` whenever this is present, which is what the motion reads.
   *
   * A function rather than a flag, and typed structurally on purpose: these
   * bindings declare no relationship with the package that supplies the motion
   * - not a dependency, not a peer, not an optional peer - and import nothing
   * from it, not even a type. A type-only import would put the specifier into
   * the `.d.ts` this package publishes, where a consumer who has not installed
   * that package fails `tsc` - and types are not dependencies, so no package
   * manager would have warned them. Which package it is, and why it is not
   * named here, is in this package's README beside the two peers that *are*
   * declared. The caller imports the function and passes it:
   *
   * ```tsx
   * <PenSketch diagram={FLOW} viewBox="0 0 700 150" animate={animate} />
   * ```
   *
   * Held in a ref and read when the drawing runs, so - unlike `diagram`,
   * `seed` and `theme` - **changing its identity does not re-animate**. That
   * is deliberate rather than an oversight: the natural way to pass options is
   * an inline arrow, `animate={svg => animate(svg, { duration: 3000 })}`,
   * which is a fresh identity on every render, and a prop that redrew on
   * identity would restart the drawing from blank every time the parent
   * re-rendered. A redraw that `diagram`, `seed` or `theme` does cause applies
   * whatever function is current by then, and animates again.
   *
   * It runs inside a synchronous effect and is expected to be synchronous
   * itself. This component cannot enforce that, and says so rather than
   * promising what it does not control: anything awaited between `draw`
   * clearing the element and the work that follows opens the window that
   * idempotence - and with it the absence of any cleanup here - rests on
   * being closed.
   */
  animate?: (svg: SVGSVGElement) => void;
  /**
   * The picture as data. Compared by identity, never by value, so keep it
   * module-level or memoized: a fresh object literal on every render redraws
   * the diagram on every render.
   */
  diagram: Diagram;
  /**
   * Seeds the drawing's PRNG. Two diagrams with the same seed wobble
   * identically, so a seed is a choice of drawing rather than a source of
   * noise. Default: `1`.
   */
  seed?: number;
  /**
   * The roles to override, shallow-merged over `defaultTheme`. Compared by
   * identity like `diagram`, and with the same consequence when it is a fresh
   * object literal.
   */
  theme?: Partial<Theme>;
  /**
   * Required: pensketch places every shape in the diagram's own coordinate
   * space, and the viewBox is what maps that space onto the element.
   */
  viewBox: string;
}

/**
 * Renders `diagram` into a bare `<svg>`, redrawing whenever `diagram`, `seed`
 * or `theme` changes identity. Every other prop is spread onto the element, so
 * `className`, `aria-label` and the rest behave exactly as they would on a
 * hand-written `<svg>`.
 *
 * The drawing happens in an effect, which means the server renders the empty
 * element and the client fills it in after hydration - no mismatch, and no DOM
 * API touched while rendering.
 *
 * `animate` is applied at the end of each of those drawings and is pointedly
 * not one of the identities that causes one - see the prop.
 *
 * @example
 * ```tsx
 * import { PenSketch } from '@pensketch/react';
 * import type { Diagram } from '@pensketch/core';
 *
 * const FLOW: Diagram = {
 *   nodes: [
 *     { id: 'in',   shape: 'pill',    x: 40,  y: 50, w: 160, h: 50, lines: ['request'] },
 *     { id: 'gate', shape: 'diamond', x: 260, y: 35, w: 150, h: 80, lines: ['allowed?'] },
 *     { id: 'work', shape: 'box',     x: 480, y: 50, w: 180, h: 50, lines: ['do the work'], accent: true },
 *   ],
 *   edges: [
 *     { from: ['in', 'r'],   to: ['gate', 'l'] },
 *     { from: ['gate', 'r'], to: ['work', 'l'], label: 'yes', lx: 445, ly: 60 },
 *   ],
 * };
 *
 * export function Flow() {
 *   return <PenSketch diagram={FLOW} seed={7} viewBox="0 0 700 150" aria-label="Request flow" />;
 * }
 * ```
 */
export const PenSketch = forwardRef(function PenSketch(
  { animate, diagram, seed = 1, theme, ...rest }: PenSketchProps,
  ref: ForwardedRef<SVGSVGElement>,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // The motion, out of the drawing effect's dependency array and reachable
  // from inside it anyway. Listed as a dependency and an inline arrow - the
  // natural way to pass options - would clear the element and start the
  // drawing over on every render of the parent.
  //
  // Reading it from the closure instead would behave identically - measured,
  // both forms call the same function, because React runs an effect from the
  // latest committed render - but it is unshippable: `useExhaustiveDependencies`
  // rejects it, and the fix the lint offers is to add it to the array, which is
  // the bug above. The ref is what makes the omission deliberate rather than
  // something a later hand silently corrects.
  const latest = useRef(animate);

  // One element, two claims on it: the caller's ref, whatever shape it came
  // in, and the private one the drawing effect reads.
  const attach = useCallback(
    (node: SVGSVGElement | null) => {
      svgRef.current = node;
      if (typeof ref === 'function') {
        // A callback ref may return a cleanup, and a ref that does is
        // promised it will never be called with null instead. Forwarding the
        // cleanup keeps that promise; returning one only when the caller
        // returned one leaves refs that do not on the older null-call path.
        // Typed void, because the forwarded-ref alias narrows it that way;
        // at runtime a caller on a version that supports cleanups returns one.
        const cleanup: unknown = ref(node);
        if (typeof cleanup === 'function')
          return () => {
            svgRef.current = null;
            (cleanup as () => void)();
          };
      } else if (ref) ref.current = node;
    },
    [ref],
  );

  // Only the ref is updated here, never applied: this effect is declared
  // before the drawing one and therefore runs before it, which is what lets a
  // commit that changes the diagram and the function together draw with the
  // new one. Applying the function from a position like this is the bug the
  // ordering makes easy - `draw` empties the element, so a stylesheet inserted
  // before it is removed by it and nothing animates at all.
  //
  // In an effect rather than during render, so only a commit that happened can
  // latch a function: a render React throws away must not leave its arrow
  // behind for the next drawing to call.
  useEffect(() => {
    latest.current = animate;
  });

  useEffect(() => {
    // The element is this component's own and the ref is attached before any
    // effect runs, so the read is total in a way its type cannot say.
    const svg = svgRef.current as SVGSVGElement;
    const animating = latest.current;
    // `draw` clears before it draws, so running this twice - as StrictMode
    // does - leaves exactly what running it once leaves. That holds for the
    // stylesheet below as much as for the drawing: the second run removes the
    // first run's, rather than the component counting them.
    //
    // `order` only when there is something to read it, so a component that
    // asks for nothing renders the bytes it always did - no `--ps-i`, no
    // `pathLength`, nothing moved.
    draw(svg, diagram, {
      seed,
      ...(theme === undefined ? {} : { theme }),
      ...(animating === undefined ? {} : { order: true }),
    });
    // After `draw` filled the element and inside the same effect, so the
    // elements this decorates are the ones this effect just created. Called
    // rather than awaited: the effect stays synchronous, which is what makes
    // cleanup unnecessary here.
    animating?.(svg);
  }, [diagram, seed, theme]);

  return <svg ref={attach} {...rest} />;
});
