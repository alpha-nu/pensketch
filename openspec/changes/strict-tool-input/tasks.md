# Tasks: strict-tool-input

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

Independent of `arc-connectors`: different package, different specs, no shared
file. It is sequenced first because it is a defect in a released version, and
because `brace-annotations` needs it in the tree before it adds the first new
top-level field — without it, a `braces` key the server has not been taught is
discarded in silence, and that change would appear to work while drawing
nothing.

Its release is not its own. The owner is batching one dispatch for this change,
`arc-connectors` and `brace-annotations` together, so nothing here reaches a
registry until all three are implemented. Being first buys the ordering, not
an earlier fix for anyone downstream.

## 1. The boundary

- [ ] 1.1 `z.strictObject` for the diagram argument and for each tool's
      argument object. The diagram's own error is the one a caller will meet,
      so check what zod actually says and make sure the key appears in it
- [ ] 1.2 The description on the diagram argument stops promising something
      the code did not do. It already says `raw` "is not accepted here"; that
      is now true rather than aspirational
- [ ] 1.3 Tests: an unknown top-level key, a misspelled `nodes`, and `raw`,
      each refused with the offending key named. One test asserts a valid
      diagram still renders byte-identically, because the point is that
      nothing which was reaching the renderer stops reaching it
- [ ] 1.4 `npm run stdio` — the round trip a client actually makes, over the
      transport, since this is a change to what crosses it

## 2. Ready to ship

- [ ] 2.1 A changeset: a **minor** for `@pensketch/mcp`, saying plainly that
      input which used to be accepted is now refused, and why that is the fix
      rather than the regression
- [ ] 2.2 **OWNER**: after the batched release, send a diagram with a
      misspelled field through a real client and read the error the way an
      agent would. There is no dispatch of its own here: the changeset waits
      with the others until all three changes are implemented

Gate: all verification commands green, `openspec validate strict-tool-input
--strict` green, and no golden or generated artefact moved — this changes what
the server accepts, not what it draws.
