# Tasks: a-page-of-examples

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner. Items marked **OWNER CALL** are
decided by the owner and then done by the agent.

Group 1 is blocked on all four owner calls in `proposal.md`.

## 1. Decisions and the shared palette

- [x] 1.0 **OWNER CALL** Where the palette lives

      **Decided 2026-09-06: move the tokens into the repository.** They become a
      tracked module and `content/tools/tokens.mjs` re-exports it rather than
      holding a copy.
- [ ] 1.0b **OWNER CALL** Still open, and defaulted by the agent until ruled:
      which diagrams (default: the 11 distinct named ones), where it hosts
      (default: GitHub Pages), static or self-drawing (default: static)
- [ ] 1.1 If the palette moves: the tokens become a tracked module, and
      `content/tools/tokens.mjs` re-exports it rather than holding a copy, so
      the posts and the page cannot diverge
- [ ] 1.2 The five keyless `incident` stages are resolved the way 1.0 ruled,
      and the generator fails loudly on an unnamed diagram rather than
      printing an untitled one

## 2. The generator

- [ ] 2.1 `tools/build-showcase.mjs`: `shippedDiagrams()` in, one
      self-contained HTML file out. Rendering through `@pensketch/core`'s own
      `renderToString`, never a second renderer
- [ ] 2.2 Self-contained means it: CSS inlined, the Architects Daughter
      subset inlined as a data URI, every SVG inline. A reader opening it
      from a file:// URL sees exactly what a visitor sees
- [ ] 2.3 Each diagram carries its name, node and edge counts, and viewBox,
      read from the data rather than typed
- [ ] 2.4 `npm run showcase`, beside `npm run resources`

## 3. The page

- [ ] 3.1 The Explains system applied: paper, ink, pen, accent, Charter,
      Menlo, the hand face for figures only
- [ ] 3.2 Responsive without a framework. Wide diagrams scroll inside their
      own container; the page body never scrolls sideways
- [ ] 3.3 Every `<svg>` carries the diagram's own `label` as an accessible
      name, which the data already holds
- [ ] 3.4 Eye-check every rendered figure. `check` cannot see a collision
      between a label and a curve, and this page is the shop window

## 4. Publishing

- [ ] 4.1 The deploy workflow for whichever target 1.0 named
- [ ] 4.2 A CI check that the committed page matches a fresh generation,
      under the same tree-clean assertion as the goldens and the schema
- [ ] 4.3 README links the page
- [ ] 4.4 **OWNER** enable Pages (or the equivalent) and confirm the URL

## 5. Group boundary

- [ ] 5.1 `/swat` over the whole change
- [ ] 5.2 Every Truthful finding remediated
