# Tasks: brace-annotations

Execute groups in order. A group is done when the verification commands in
`CONTRIBUTING.md` are green, a self-review of the group's diff has been made,
and every finding is fixed. Items marked **OWNER** are performed by the repo
owner, never the agent.

Sequenced after `arc-connectors` is implemented, and after
`strict-tool-input` — not after either is archived. The release is batched:
all three changes are implemented before one dispatch goes out, so
`arc-connectors` is still an open change on disk while this one is built on
top of it. That is fine and it is worth naming, because the two touch
`types.ts` and `draw.ts` in the same tree and this one must not quietly
re-decide anything the other has settled.

It needs `arcPoints` from `arc-connectors` group 1, and it extends the render
order that change leaves behind. It needs `strict-tool-input` in the tree
because without it a `braces` key the server has not been taught is discarded
in silence, and this change would appear to work while drawing nothing.

**Before starting**, close the three questions in design.md D6. They are the
owner's, and each one changes what ships: whether a brace joins the paths
`label-collision` searches, what the default depth is, and whether a brace is
drawn in `theme.ink` or `theme.accent`.

## 1. The shape on paper

- [ ] 1.1 `BRACE_DEPTH` and `BRACE_R` in `constants.ts`, documented as
      starting points rather than as values computed from anything, in the
      words `size` uses
- [ ] 1.2 `bracePoints(brace): Point[]` in `sample.ts`, beside `arcPoints` —
      one list, four quarter-arcs and two runs for a curly brace, four points
      and no arc for a square one
- [ ] 1.3 Tests reproducing design.md D5's recorded numbers exactly: the tip
      at `174, 140`, the x extent `174 -> 200`, the y extent `40 -> 240`. The
      geometry the design document records is the geometry that ships, or one
      of the two is wrong and it should be found here
- [ ] 1.4 A test that a whole brace is two `<path>` elements, which is the
      assertion that it went through one `stroke`. Mutation-test it: six
      strokes must fail this

Gate: `npm run size`, before the phase is even wired up, so the first number
is known.

## 2. The data model

- [ ] 2.1 `DiagramBrace` in `types.ts`, with the JSDoc the generated schema
      will carry as its descriptions
- [ ] 2.2 `braces` on `Diagram`, between `nodes` and `notes`, with the JSDoc
      saying where it sits in the draw order and why
- [ ] 2.3 `draw` renders the phase in array order, between the non-group nodes
      and the notes
- [ ] 2.4 `lines` without numeric `lx`/`ly` throws, in the words `draw`
      already uses for an edge label
- [ ] 2.5 `npm run schema` regenerates and gains `DiagramBrace`;
      `generate-schema.mjs`'s required-key assertion learns `braces`
- [ ] 2.6 The MCP tool's accepted shape gains `braces`. With
      `strict-tool-input` in the tree, forgetting this is a loud failure
      rather than a silent one — confirm that by trying it before adding it
- [ ] 2.7 Tests: a round trip through `JSON.parse(JSON.stringify())`, since
      crossing that boundary is the whole point; and a diagram with no
      `braces` rendering byte-identically, asserted against the goldens
      through the parity test rather than by regenerating anything

## 3. The checker sees it

- [ ] 3.1 A brace's sampled points join what the geometric rules measure, so
      `out-of-bounds` reports a tip outside the frame whose endpoints are
      inside
- [ ] 3.2 Whatever D6.1 decided about `label-collision`. If a brace joins the
      searched paths, `struckBy` has to return a subject rather than an index:
      it returns an edge index today and all its call sites write the word
      "edge" into the message
- [ ] 3.3 Tests for both, including the case that must stay quiet

Gate: `npm run size`. This group's weight lands on `@pensketch/core/check`,
the entry with the least headroom.

## 4. The reference catches up

- [ ] 4.1 `docs/agents.md`: the type block, the phase list in trap 6, and the
      constants count
- [ ] 4.2 Both READMEs: the type tables, and the phase order wherever it is
      printed
- [ ] 4.3 `pensketch://spec` regenerates; served bytes still equal the file
- [ ] 4.4 A brace earns its place in a shipped example — over a group of steps
      in a diagram that wanted one anyway, rather than one invented to show it
      off. An example is how most readers meet a feature, so a change that
      adds an annotation and leaves every picture looking the same has told
      nobody
- [ ] 4.5 A bracket too, wherever it reads better than a brace — they are one
      enum apart and a reader should be able to see the difference rather than
      infer it from a field table
- [ ] 4.6 Both read as a reader would read them: is the brace where a hand
      would have drawn it, does its text sit clear of the tip, does the
      picture look like someone meant it. `depth` is the caller's number, so
      the default being reasonable is a claim only a drawing can settle

## 5. Release

- [ ] 5.1 `npm run size` on all four entries, and the README figure with it,
      which the gate now asserts rather than trusts
- [ ] 5.2 A changeset: a **minor** for `@pensketch/core` and `@pensketch/mcp`,
      saying that the second thing `raw` could draw and JSON could not is now
      data
- [ ] 5.3 **OWNER**: dispatch `release.yml` twice. This is the batched release
      for all three changes, so the version pull request carries this
      changeset, `arc-connectors`' and `strict-tool-input`'s together — read
      all three before merging it
- [ ] 5.4 **OWNER**: draw a brace through the MCP server in a real client

Gate: all verification commands green, `openspec validate brace-annotations
--strict` green, no golden moved, and the only generated bytes that move being
the schema, the resources, and the new example's entry.
