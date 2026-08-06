/**
 * The five color roles every drawing operation resolves through. Each value
 * is written verbatim into an SVG attribute, so anything CSS accepts as a
 * color works, `var()` expressions included.
 */
export interface Theme {
  /** Primary stroke and label color. */
  ink: string;
  /** Structural accent: group borders, accent nodes. */
  pen: string;
  /** Attention color: dotted edges, notes. */
  accent: string;
  /** Secondary labels. */
  muted: string;
  /** Group background fill. */
  wash: string;
}

/**
 * The palette used when none is given: `--ps-*` references carrying the
 * shipped colors as fallbacks, so a host page restyles a rendered diagram -
 * dark mode included - purely by redefining the variables, with no redraw and
 * no CSS from this package. Frozen; override per call with `PenOptions.theme`.
 */
export const defaultTheme: Theme = Object.freeze({
  ink: 'var(--ps-ink, #232B36)',
  pen: 'var(--ps-pen, #2B5B8A)',
  accent: 'var(--ps-accent, #B3402E)',
  muted: 'var(--ps-muted, #5A6572)',
  wash: 'var(--ps-wash, rgba(43,91,138,.05))',
});

/** A caller's partial theme over the defaults, as a fresh object each time. */
export const resolveTheme = (theme?: Partial<Theme>): Theme => ({
  ...defaultTheme,
  ...theme,
});
