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
- [x] 1.0b **OWNER CALL** Still open, and defaulted by the agent until ruled:
      which diagrams (default: the 11 distinct named ones), where it hosts
      (default: GitHub Pages), static or self-drawing (default: static)

      **All three defaults taken, 2026-09-07, and each is reversible.** The
      eleven named ones, because the other four are reveal stages of a
      diagram already shown. GitHub Pages, because the repository is there
      and no other free host is better for one static file. Static, because
      eleven figures animating on scroll is a decision about the page's
      character and the owner has not made it - `render_diagram`'s `animate`
      is one flag away whenever they do.
- [x] 1.1 If the palette moves: the tokens become a tracked module, and
      `content/tools/tokens.mjs` re-exports it rather than holding a copy, so
      the posts and the page cannot diverge
- [x] 1.2 The five keyless `incident` stages are resolved the way 1.0 ruled,
      and the generator fails loudly on an unnamed diagram rather than
      printing an untitled one

## 2. The generator

- [x] 2.1 `tools/build-showcase.mjs`: `shippedDiagrams()` in, one
      self-contained HTML file out. Rendering through `@pensketch/core`'s own
      `renderToString`, never a second renderer
- [x] 2.2 Self-contained means it: CSS inlined, the Architects Daughter
      subset inlined as a data URI, every SVG inline. A reader opening it
      from a file:// URL sees exactly what a visitor sees
- [x] 2.3 Each diagram carries its name, node and edge counts, and viewBox,
      read from the data rather than typed
- [x] 2.4 `npm run showcase`, beside `npm run resources`

## 3. The page

- [x] 3.1 The Explains system applied: paper, ink, pen, accent, Charter,
      Menlo, the hand face for figures only
- [x] 3.2 Responsive without a framework. Wide diagrams scroll inside their
      own container; the page body never scrolls sideways
- [x] 3.3 Every `<svg>` carries the diagram's own `label` as an accessible
      name, which the data already holds

      It does not: five of the eleven carry a `label` and six do not. The
      page's own title is the fallback, so every figure has a name rather
      than six announcing as nothing.
- [x] 3.4 Eye-check every rendered figure. `check` cannot see a collision
      between a label and a curve, and this page is the shop window

## 4. Publishing

- [x] 4.1 The deploy workflow for whichever target 1.0 named
- [x] 4.2 A CI check that the committed page matches a fresh generation,
      under the same tree-clean assertion as the goldens and the schema
- [ ] 4.3 README links the page — BLOCKED ON 4.4

      Ticked once and reverted. The link went into `README.md` while Pages was
      still disabled, so the repository's front page advertised a URL that
      answered 404 - verified, not assumed. 4.3 cannot be done before 4.4;
      the link goes back once the site answers.
- [ ] 4.4 **OWNER** enable Pages and confirm the URL, then add the README link

      Settings → Pages → Source: **GitHub Actions**, not "Deploy from a
      branch". The branch option with `/docs` would publish `docs/agents.md`
      and 2.3 MB of `docs/assets/` alongside the page, and would serve it at
      `/pensketch/showcase/` rather than at the root the README link expects.

      Then dispatch the Pages workflow once by hand: it now triggers on CI
      completing, so nothing fires until the next commit otherwise.

## 5. Group boundary

- [x] 5.1 `/swat` over the whole change
- [x] 5.2 Every Truthful finding remediated

      T-38 to T-47. The one worth remembering is T-38: the captions were
      fabricated, corrected, and fabricated again. The fix was not to check
      them harder but to stop writing sentences that can be wrong - every
      fact on the page is computed now, and the prose makes no claim.
