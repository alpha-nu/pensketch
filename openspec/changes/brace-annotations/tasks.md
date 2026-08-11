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

The three questions in design.md D6 are closed, all three before any code was
written against them: a brace joins the paths `label-collision` searches, which
buys the `struckBy` refactor; `depth` defaults to 26 px; and a brace and its
label stroke in `theme.pen`, with a group's border and a group's title, because
a brace does a group's job where a rectangle cannot.

## 1. The shape on paper

- [x] 1.1 `BRACE_DEPTH` and `BRACE_R` in `constants.ts`, documented as
      starting points rather than as values computed from anything, in the
      words `size` uses
- [x] 1.2 `bracePoints(brace): Point[]` in `sample.ts`, beside `arcPoints` —
      one list, four quarter-arcs and two runs for a curly brace, four points
      and no arc for a square one

      **2.1's `DiagramBrace` landed here**, because this signature takes a
      brace and a type cannot be forward-declared. The same precedent
      `arc-connectors` set at 4.3, where the rule-count row landed in the
      commit that added the rule: a task that another task's wording requires
      is done where it is required, and said so
- [x] 1.3 Tests reproducing design.md D5's recorded numbers exactly: the tip
      at `174, 140`, the x extent `174 -> 200`, the y extent `40 -> 240`. The
      geometry the design document records is the geometry that ships, or one
      of the two is wrong and it should be found here

      They agree. What the render found instead is a case the design did not
      cover: a `depth` shallower than `BRACE_R` drew at `BRACE_R`, because the
      ends' corners alone were deeper than the whole brace. A caller asking for
      8 got 13 and no way to know. The corner is capped at the depth now, and a
      row of five depths asserts that the number asked for is the number drawn
- [x] 1.4 A test that a whole brace is two `<path>` elements, which is the
      assertion that it went through one `stroke`. Mutation-test it: six
      strokes must fail this

Gate: `npm run size`, before the phase is even wired up, so the first number
is known.

**+18 B on the root entry and nothing on the tight two.** core 3191 -> 3209,
`./check` 2636 -> 2635, `./server` 3243 -> 3242, the last two being gzip noise
rather than a saving. The 18 is `BRACE_DEPTH` and `BRACE_R` joining the frozen
`constants` object, which the root entry exports; `bracePoints` itself is
reachable from nothing yet and is tree-shaken out of all four. So the phase
still has the whole of `./server`'s 86 B to fit into, and D2's prototype
measured **+276 B** for it. That gap is the group 2 budget decision, and it is
better taken before a byte is written than discovered at a gate.

## 2. The data model

- [x] 2.1 `DiagramBrace` in `types.ts`, with the JSDoc the generated schema
      will carry as its descriptions
- [x] 2.2 `braces` on `Diagram`, between `nodes` and `notes`, with the JSDoc
      saying where it sits in the draw order and why
- [x] 2.3 `draw` renders the phase in array order, between the non-group nodes
      and the notes
- [x] 2.4 `lines` without numeric `lx`/`ly` throws, in the words `draw`
      already uses for an edge label
- [x] 2.5 `npm run schema` regenerates and gains `DiagramBrace`;
      `generate-schema.mjs`'s required-key assertion learns `braces`
- [x] 2.6 The MCP tool's accepted shape gains `braces`. With
      `strict-tool-input` in the tree, forgetting this is a loud failure
      rather than a silent one — confirm that by trying it before adding it
- [x] 2.7 Tests: a round trip through `JSON.parse(JSON.stringify())`, since
      crossing that boundary is the whole point; and a diagram with no
      `braces` rendering byte-identically, asserted against the goldens
      through the parity test rather than by regenerating anything

Gate: `npm run size`. **The phase costs +260 B on `./server`**, against the
+276 design.md D2 measured from its prototype, so the budget raised before the
group was the right size and ends it with 146 B free. The root entry moves the
same way, 3209 -> 3468, and the README figure with it. `./check` does not move
at all: nothing in the checker reaches a brace yet, which is group 3.

2.6 confirmed its own premise before satisfying it, which is what the task
asked for. With `strict-tool-input` in the tree the tool boundary refuses
`braces` by name, and the test holding the tool's top level to the schema's
fails the moment the schema gains a field the tool has not been taught. Both
were observed failing, then fixed. Two tests in `strict-tool-input`'s own suite
used `braces` as their example of a key that does not exist — the right example
at the time, and this change made it wrong. They name `legend` now, with the
reason written beside them: the key an agent invents is whichever one the data
model has not got yet, so that test has to keep naming one of those.

## 3. The checker sees it

- [x] 3.1 A brace's sampled points join what the geometric rules measure, so
      `out-of-bounds` reports a tip outside the frame whose endpoints are
      inside
- [x] 3.2 A brace joins the paths `label-collision` searches, which means
      `struckBy` returns a subject rather than an index: it returns an edge
      index today and all its call sites write the word "edge" into the
      message, so a finding cannot yet say `brace 2`
- [x] 3.3 Tests for both, including the case that must stay quiet

Gate: `npm run size`. This group's weight lands on `@pensketch/core/check`,
the entry with the least headroom.

**+354 B, landing at 2989 of 3072 with 83 free**, against D2's prototype
measurement of +270. No raise: 437 B were free and the work fits, which is why
group 2's raise named `./server` and left this entry alone.

304 of that is 3.1 and 3.2 together. The last 50 bought a case neither task
asked for and the shape of the other two made hard to leave out: a brace's own
label, checked against the drawn lines exactly as an edge's label is. Without
it a brace's label was reported by `out-of-bounds` and not by
`label-collision`, which is an asymmetry a reader would have to discover by
experiment. Measured before it was kept, and it would not have been kept at
150.

## 4. The reference catches up

- [x] 4.1 `docs/agents.md`: the type block, the phase list in trap 6, and the
      constants count
- [x] 4.2 Both READMEs: the type tables, and the phase order wherever it is
      printed
- [x] 4.3 `pensketch://spec` regenerates; served bytes still equal the file
- [x] 4.4 A brace earns its place in a shipped example — over a group of steps
      in a diagram that wanted one anyway, rather than one invented to show it
      off. An example is how most readers meet a feature, so a change that
      adds an annotation and leaves every picture looking the same has told
      nobody
- [x] 4.5 A bracket too, wherever it reads better than a brace — they are one
      enum apart and a reader should be able to see the difference rather than
      infer it from a field table
- [x] 4.6 Both read as a reader would read them: is the brace where a hand
      would have drawn it, does its text sit clear of the tip, does the
      picture look like someone meant it. `depth` is the caller's number, so
      the default being reasonable is a claim only a drawing can settle
- [x] 4.7 The README hero is read again and redrawn, carrying **both** this
      change's shapes and `arc-connectors`': a curved connector and a brace or
      a bracket, wherever the picture is better for them. It is the first
      drawing anyone sees and it currently shows none of what the two changes
      added, so a reader meets a version of the project that is a release
      behind. One pass rather than two, here rather than in `arc-connectors`
      group 6, for three reasons: the release is batched, so no version ships
      with the hero half-evolved either way; the PNGs are binary and a second
      pass is a second pair of blobs in the history for a picture nobody saw
      in between; and composition is a whole-picture judgement — an arc placed
      without knowing where the brace goes is a placement made blind. The hero
      is a picture first. A shape that the drawing does not want does not go
      in, and if one is left out, 4.8 records why
- [x] 4.8 `node tools/render-assets.mjs` — both PNGs, then `npm run diagrams`,
      which runs the checker over the hero like any other shipped diagram. The
      render needs a local Google Chrome and is deliberately never run in CI,
      so an unregenerated PNG is caught by nothing: the image and
      `tools/hero-diagram.mjs` move in the same commit or they part company.
      The commit body carries the before and after, and any shape 4.7 decided
      against

Where they landed, and why there rather than anywhere else. The brace went to
`examples/vanilla/`, over `deploy staging` and `deploy prod`: one set, already
inside the release stage, where a second rectangle would have read as a stage
of its own. That is the case D1 says a brace exists for, in a picture that had
it before the feature did. The bracket went to `examples/custom-pen/`, over the
two states the money has already moved for — one enum apart from the brace and
visibly a different shape, so a reader sees the difference rather than reading
about it.

Neither is in the state machine, which already carries this release's other two
shapes and would have become a gallery. Nothing went into the OAuth example:
its four lanes leave no clear column, and a brace crossing a connector to reach
one would have been a shape the picture did not want.

The hero lost its note. "same seed, same bytes" was a claim about every stroke
in the drawing with a pointer aiming it at one box, and a brace over the whole
group says it properly — which is 4.7's judgement rather than a deletion for
room. It gained the edge the picture had been missing since it was drawn:
`render` fills `cache`, bowed off the corner it would otherwise cut. So the
hero now shows a group, all three drawn shapes, hatching, an accent, a dotted
edge, corners given through `via`, a bow, a brace, and a `raw` block — one
fewer feature by count and a better picture.

## 5. Release

- [x] 5.1 `npm run size` on all four entries, and the README figure with it,
      which the gate now asserts rather than trusts
- [x] 5.2 A changeset: a **minor** for `@pensketch/core` and `@pensketch/mcp`,
      saying that the second thing `raw` could draw and JSON could not is now
      data

Where the four entries end, from a cold tree: core **3468 / 5120**, `./check`
**2989 / 3072**, `./server` **3502 / 3648**, react **472 / 2048**. The README
figure is 3468 and the gate asserts it rather than trusting it, which caught it
twice in this change — once at 1.1 for two constants, once at 2.3 for the
phase.

Both raises this change made were taken before the work that needed them, with
the arithmetic recorded: `./server` 3328 -> 3648 against a measured +260, and
`./check` not raised at all, because 437 B were free and the group spent 354.
That is the requirement this change added to `repo-tooling`, kept by the change
that added it.
- [ ] 5.3 **OWNER**: dispatch `release.yml` twice. This is the batched release
      for all three changes, so the version pull request carries this
      changeset, `arc-connectors`' and `strict-tool-input`'s together — read
      all three before merging it
- [ ] 5.4 **OWNER**: draw a brace through the MCP server in a real client

Gate: all verification commands green, `openspec validate brace-annotations
--strict` green, no golden moved, and the only generated bytes that move being
the schema, the resources, and the new example's entry.
