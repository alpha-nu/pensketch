# Tasks: arc-connectors

Execute groups in order. A group is done when the verification commands in
`CONTRIBUTING.md` are green, a self-review of the group's diff has been made,
and every finding is fixed. Items marked **OWNER** are performed by the repo
owner, never the agent.

Sequenced after `0.1.1` ships. That release fixes a tool that currently draws
nothing, and it should not wait behind a feature.

## 1. The primitive

- [x] 1.0 The delta says which requirements `arc` breaks. Two do, and neither
      was listed: `Pen` is a closed surface of nine names, and every primitive
      is required to reproduce a reference that has no arc
- [x] 1.1 `ARC_STEPS` in `constants.ts`, chosen by rendering a half-circle at
      typical loop sizes and checking it does not read as a polygon. Record
      the number tried and rejected in the commit body
- [x] 1.2 `pen.arc(cx, cy, rx, ry, from, to, opts)` — sample and hand to
      `stroke`. No curve command reaches the markup
- [x] 1.3 Export it on the `Pen` interface with JSDoc saying what it is for
      and that angles are radians
- [x] 1.4 Tests: sampled output is a jittered polyline; direction follows the
      sign; a full sweep matches what `pill` draws for the same box

Gate: goldens unchanged — nothing existing calls `arc`, so no seeded sequence
moves.

## 2. Self-transitions

- [ ] 2.1 `LOOP_OUT` and `LOOP_SPAN` constants with the defaults, documented
      as starting points rather than as computed values
- [ ] 2.2 Loop geometry in `geometry.ts`: two anchors on a side `span` apart,
      an arc projecting `out`, arrowhead on the returning anchor
- [ ] 2.3 `draw` recognises same id + same side and draws the loop, in the
      edges phase, in array order
- [ ] 2.4 Same id + **different** sides throws, with a message naming the node
      and saying a self-transition attaches to one side. This is the case that
      silently rendered a stub before — a test asserts the throw and names the
      old behaviour in its title
- [ ] 2.5 `label`, `lx`, `ly`, `anchor`, `dotted` behave on a loop exactly as
      on any other edge
- [ ] 2.6 Types and JSDoc; the schema regenerates and gains `out`/`span`
- [ ] 2.7 Tests including a round trip through `JSON.parse(JSON.stringify())`,
      because crossing that boundary is the entire point

## 3. Bowed connectors

- [ ] 3.1 `bow` on `DiagramEdge`: perpendicular offset from the chord
      midpoint, positive to the right of travel
- [ ] 3.2 `bow` on `DiagramNote` pointers, same meaning
- [ ] 3.3 `bow` with `via` throws on both, with a message saying the path is
      already described
- [ ] 3.4 Tests: `A→B` and `B→A` at the same positive `bow` land on opposite
      sides; an edge without `bow` is byte-identical to before

## 4. The checker catches up

- [ ] 4.1 Sample loops and bows into segments so every existing geometric rule
      sees the path actually drawn, not the chord
- [ ] 4.2 `edge-overlap`, warning: two paths within a small distance along
      their whole length. Does not fire on a crossing
- [ ] 4.3 Rule count is eight; the requirement heading that counted them is
      renamed, and every table listing rules is updated
- [ ] 4.4 Tests for both, including the near-parallel case and the crossing
      case that must stay quiet

## 5. The reference stops being wrong

- [ ] 5.1 Trap 4 in `docs/agents.md` — "An edge connects two *different*
      nodes. There are no self-transitions." — rewritten, saying what the rule
      was and that it has moved
- [ ] 5.2 `raw` described as the hatch for what the data model still has no
      word for, rather than for self-transitions specifically
- [ ] 5.3 The count of exported constants, which every group before this one
      moves, and the "Numbers worth designing around" table if any constant
      added here earns a place among the numbers a caller designs against
- [ ] 5.4 The checker rules table, in the reference and in both READMEs
- [ ] 5.5 `pensketch://spec` regenerates; served bytes still equal the file

## 6. The examples stop paying for it

- [ ] 6.1 `examples/custom-pen/` — the lifecycle retry loop becomes data. The
      page keeps a `raw` block only if it still demonstrates something the
      data model cannot say; if it does not, the folder's reason for existing
      is restated in its comment rather than left implied
- [ ] 6.2 `examples/state-machine/` — the keypad loop becomes data
- [ ] 6.3 Both `rawOmitted` disclosures disappear with the callbacks they
      described, and the served examples become whole pictures
- [ ] 6.4 Goldens regenerate; the diff is reviewed rather than accepted, since
      these are the only diagrams whose bytes are expected to move
- [ ] 6.5 A changeset naming the minor, and saying plainly that a documented
      impossibility is now possible

## 7. Release

- [ ] 7.1 `npm run size` — the root entry grows; confirm the budget still
      holds and record the new number in the README table
- [ ] 7.2 **OWNER**: dispatch `release.yml` twice. This is the first release
      to publish tokenless, so the log line to look for is "No NPM_TOKEN
      found, but OIDC is available"
- [ ] 7.3 **OWNER**: after publishing, draw a self-transition through the MCP
      server in a real client — the thing that was impossible when this change
      was written

Gate: all verification commands green, `openspec validate arc-connectors
--strict` green, goldens moving only for the two examples that dropped `raw`,
and every other diagram byte-identical.
