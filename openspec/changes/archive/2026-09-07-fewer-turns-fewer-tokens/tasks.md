# Tasks: fewer-turns-fewer-tokens

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER CALL** are decided by the owner and then done by the agent.

`BASELINE.md` was captured before any task here ran. Group 4 re-runs the same
scenario and compares; it is not optional, because a lever nobody measured
after the fact is a lever nobody knows landed.

## 1. One turn, not two

- [x] 1.0 **OWNER CALL** Whether `render_diagram` may return findings beside
      its markup

      **Decided 2026-09-06: yes.** A second content block, a minor bump, and the
      live spec's "SHALL return SVG text" is amended by this change's delta.
- [x] 1.1 `render_diagram` runs `check` and returns findings as a second
      content block. Core still owns every rule; the tool stays a thin layer
- [x] 1.2 Findings are reported in the geometry actually rendered, `extrude`
      and `depth` included, or they describe a drawing nobody made
- [x] 1.3 `check_diagram`'s description loses "Run this before rendering",
      which will be false. The test pinning `TRAPS` phrases is the guard that
      a description does not rot; extend it rather than working around it
- [x] 1.4 `render_png` is left alone. It is the expensive tool, and a
      pre-render `check_diagram` is exactly right in front of a 2.4 s raster

## 2. Fewer tokens per node

- [x] 2.1 `shape` becomes optional in the core node type, defaulting to
      `box`. Additive: no existing diagram changes meaning
- [x] 2.2 Regenerate the published JSON schema; `shape` leaves `required`
- [x] 2.3 The `diagram` description asks for compact JSON, and says plainly
      that it is a request the model may ignore
- [x] 2.4 A test that a node without `shape` draws the box a node with
      `shape: "box"` draws, byte for byte

## 3. The mandatory read

- [x] 3.0 **OWNER CALL** Pay the read, cache it, or inline it

      **Decided 2026-09-06: leave it, let clients cache.** The tool schema keeps
      `z.array(z.unknown())` and `pensketch://schema` stays the single source
      of truth. No code changes here. The 4,774-token cold read is a known,
      accepted cost, and the re-run in group 4 must say whether it paid it,
      because the baseline did not.
- [x] 3.1 Nothing to apply: 3.0 chose the status quo
- [x] 3.2 Not applicable

## 4. Re-run and compare

- [x] 4.1 Re-run `BASELINE.md`'s scenario verbatim against the changed server
- [x] 4.2 Record turns, tool calls, check rounds, findings and tokens in the
      same table, and state whether the agent read the schema, since the
      baseline did not and said so

      Ticked once and wrongly: the schema statement was missing and the token
      table quoted figures `BASELINE.md` contradicts. Both fixed, and the
      corpus measurement now carries its own script so the next reader can
      re-run it rather than trust it.
- [x] 4.3 Report the comparison. A lever that did not move its number is
      reported as not having moved it

## 5. Group boundary

- [x] 5.1 `/swat` over the whole change
- [x] 5.2 Every Truthful finding remediated

      T-01 to T-21. The blocker was T-11: `check` is not a superset of
      `draw`, so a shared `try` turned a diagram that rendered into an error
      and discarded its markup.
- [x] 5.3 A changeset; core and mcp both move

      `.changeset/fewer-turns-fewer-tokens.md`, both at minor. At release,
      mcp's core floor moves with it: `^0.7.0` cannot stand, because mcp
      serves a schema saying `shape` is optional and core 0.7 throws
      `unknown shape "undefined"` on a node that omits it. The floor is
      rewritten by `changeset version` the way `d86113c` did it, and that is
      the owner's step, not the agent's.
