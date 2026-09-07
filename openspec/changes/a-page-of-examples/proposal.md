# Proposal: a-page-of-examples

> One published page showing every diagram this repository ships, drawn by
> the shipped renderer from the shipped data, in the visual system the
> Explains posts already use. Free to host, no build step for a reader, and
> generated rather than written so it cannot drift from what it claims to
> show.

## Why

**The diagrams exist and nobody can see them.** `tools/shipped-diagrams.mjs`
already loads all 15 as data, and two consumers depend on it: the checker
that holds them to the published rules and the generator that serves them to
agents as `pensketch://example/*`. A reader has no equivalent. The
`examples/` pages are one diagram each and have to be opened one at a time
from a checkout.

**The mechanism is already built.** A generator reading `shippedDiagrams()`
and rendering with `@pensketch/core`'s own `renderToString` is the same shape
as `tools/generate-resources.mjs`, and inherits its guarantee: what is
published is what ships, checked in CI under the same tree-clean assertion,
so the page cannot describe a diagram the repository no longer draws.

**The aesthetic is settled and proven.** Paper `#F6F4EE`, ink `#232B36`, pen
blue `#2B5B8A`, accent red `#B3402E`, Charter for prose, Menlo for labels,
Architects Daughter for the figures. It is owner-approved, it survived seven
posts, and reusing it costs nothing to design.

## What changes

- **A generator**, `tools/build-showcase.mjs`, producing one self-contained
  HTML file from `shippedDiagrams()`. Inlined CSS, inlined font, inlined SVG:
  no network, no build step, no framework.
- **A published page** on free hosting, showing each diagram with its name,
  its node and edge counts, and the viewBox it was drawn at.
- **A CI check** that the committed page matches a fresh generation, the
  guarantee `generate-resources.mjs` already carries.

## What it must handle

`shippedDiagrams()` returns 15 entries and **five of them have no key**: the
`incident` diagram appears six times, once per reveal stage, and only one
carries the name. A page that lists them naively prints five untitled
duplicates. Either the stages are collapsed to their final frame or they are
labelled as stages; silently printing them is the one wrong answer.

## Non-goals

- **A documentation site.** One page. Not a framework, not a router, not
  search.
- **Redesigning the visual system.** It is settled; this consumes it.
- **Hosting the MCP server.** Different change, `mcp-speaks-http`.
- **Interactive editing.** A reader looks; they do not author here.

## Owner calls this change needs

1. **The visual system lives in an untracked directory.** `content/` is in
   `.git/info/exclude`, so a tracked generator cannot import
   `content/tools/tokens.mjs`. Either the palette and type stacks move into
   the repository as the shared source they already are in practice, or the
   page restates them and accepts a second copy of an owner-approved system.
   Recommendation: move them, because a duplicated palette is exactly the
   drift `generate-resources.mjs` exists to prevent.
2. **Which diagrams.** All 15 including the five `incident` stages, or the 11
   distinct named ones.
3. **Where it hosts.** GitHub Pages is free and the repository is already
   there. Cloudflare Pages and Netlify are equally free and both give a
   custom domain more cheaply; none of the three is meaningfully better for
   one static file.
4. **Static or self-drawing.** `render_diagram`'s `animate` returns an SVG
   that draws itself with no script and no stylesheet. Fifteen animating at
   once on scroll is a decision about the page's character, not a technical
   question.
