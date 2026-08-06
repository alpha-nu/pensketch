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

// Written verbatim into SVG attributes, so a host page restyles a rendered
// diagram - dark mode included - purely by redefining the --ps-* variables.
// The package ships no CSS: the fallbacks are the whole default palette.
export const defaultTheme: Theme = {
  ink: 'var(--ps-ink, #232B36)',
  pen: 'var(--ps-pen, #2B5B8A)',
  accent: 'var(--ps-accent, #B3402E)',
  muted: 'var(--ps-muted, #5A6572)',
  wash: 'var(--ps-wash, rgba(43,91,138,.05))',
};

export const resolveTheme = (theme?: Partial<Theme>): Theme => ({
  ...defaultTheme,
  ...theme,
});
