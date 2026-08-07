# Tasks: atm-example

Written after the fact. The work shipped in `61e7138` without a spec delta,
which is the drift this change exists to close — the requirement said three
example folders while four stood on disk. Recorded here in the order it should
have happened, then archived.

## 1. The example

- [x] 1.1 `examples/state-machine/index.html` — self-contained, no build step,
      the page chrome and theme block matching the other examples exactly, and
      the palette matching `defaultTheme`'s fallbacks
- [x] 1.2 The keypad loop drawn through `raw`, with the seven-point arc
      commented for why seven and not four: `stroke` jitters what it is handed
      and interpolates nothing between
- [x] 1.3 Wire it into `tools/shipped-diagrams.mjs` so `npm run diagrams`
      checks it like every other shipped diagram. It was clean on the first run

## 2. Serving it

- [x] 2.1 `atm` added to the generator's key set and titles; served at
      `pensketch://example/atm`
- [x] 2.2 `rawOmitted` on every served example whose source draws with `raw`,
      naming the stroke and the reason. Applies to `lifecycle` too, which has
      been serving a self-transition-shaped hole since it was written
- [x] 2.3 The generator exits non-zero when a diagram draws with `raw` and no
      disclosure is written for it
- [x] 2.4 Seven resources, not six: `tools/check-stdio.mjs`, the mcp README
      table, and both resource tests

## 3. Verification

- [x] 3.1 Twelve gates green from a tree with no prior build
- [x] 3.2 A live stdio round trip against the built binary lists seven
      resources and three tools
- [x] 3.3 `openspec validate atm-example --strict`

Gate: all verification commands green; the example renders in a browser with
no build step beyond `npm run build` at the root.
