# Tasks: strict-tool-input

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

Independent of `arc-connectors`: different package, different specs, no shared
file. It is sequenced first because it is a defect in a released version, and
because the next top-level field added to `Diagram` would be swallowed by
every server that predates it.

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

## 2. Ship it

- [ ] 2.1 A changeset: a **minor** for `@pensketch/mcp`, saying plainly that
      input which used to be accepted is now refused, and why that is the fix
      rather than the regression
- [ ] 2.2 **OWNER**: dispatch `release.yml` twice
- [ ] 2.3 **OWNER**: send a diagram with a misspelled field through a real
      client, and read the error the way an agent would

Gate: all verification commands green, `openspec validate strict-tool-input
--strict` green, and no golden or generated artefact moved — this changes what
the server accepts, not what it draws.
