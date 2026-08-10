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
- [x] 1.5 The size the README prints gets a gate rather than a reminder. It
      belongs to this group because this group is what made it stale: the
      figure was exactly right until `arc` landed, and it is the only derived
      number here that nothing regenerates and nothing asserts

Gate: `npm test`, whose parity tests re-render both fixtures through the port
and compare them byte for byte against the goldens. Not "goldens unchanged":
those are generated from `reference/renderer.html` alone, so they stay
unchanged for a port that has been gutted. The assertion that catches a moved
sequence is the port being measured against them, not their regeneration.

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

Gate: `npm run size`. `./server` is the tight entry and both this group and
the last one add to `draw.ts`, so a breach is found by the group that caused
it rather than at 7.1.

## 4. The checker catches up

- [ ] 4.1 Sample loops and bows into segments so every existing geometric rule
      sees the path actually drawn, not the chord
- [ ] 4.2 `edge-overlap`, warning: two paths within a small distance along
      their whole length. Does not fire on a crossing
- [ ] 4.3 Rule count is eight; the requirement heading that counted them is
      renamed, and every table listing rules is updated
- [ ] 4.4 Tests for both, including the near-parallel case and the crossing
      case that must stay quiet

Gate: `npm run size`. This group's weight lands on `./check`, which has 490 B
free and where finding messages are already three quarters of the entry.

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

## 6. The examples stop paying for it, and start showing it off

The first three tasks take `raw` away. The two after them are the point of
having done it: an example is how most readers meet a feature, and a change
that lifts a documented impossibility and leaves every picture looking the
same has told nobody. Both are diagrams first — a shape that appears because
the picture needs it, never a picture built around a shape.

- [ ] 6.1 `examples/custom-pen/` — the lifecycle retry loop becomes data. The
      page keeps a `raw` block only if it still demonstrates something the
      data model cannot say; if it does not, the folder's reason for existing
      is restated in its comment rather than left implied
- [ ] 6.2 `examples/state-machine/` — the keypad loop becomes data
- [ ] 6.3 Both `rawOmitted` disclosures disappear with the callbacks they
      described, and the served examples become whole pictures
- [ ] 6.4 A bowed pair earns its place in a shipped example. `edge-overlap`
      exists because two connectors between one pair draw one line and look
      deliberate; a reader should meet the fix in a diagram rather than in a
      rule. The state machine is the likely home — a transition and its
      reverse between the same two states is the shape that wanted this
- [ ] 6.5 The self-transitions from 6.1 and 6.2 are read as a reader would
      read them: is the loop where a hand would have drawn it, is its label
      clear of the arc, does the picture look like someone meant it. `out` and
      `span` are the caller's numbers, so the defaults being reasonable is a
      claim only a drawing can settle
- [ ] 6.6 `npm run resources` — the examples' entries are what move, and the
      diff is reviewed rather than accepted. Not goldens: there are none for
      the examples. The two that exist are the reference's own fixtures,
      which no example can reach
- [ ] 6.7 A changeset naming the minor, and saying plainly that a documented
      impossibility is now possible

## 7. Release

- [ ] 7.1 `npm run size`, and record the root entry's number in the README
      comparison table. The root is not the entry at risk: it has around 2400
      B free where `./server` has 320 and `./check` 490, and `./server`
      carries its own copy of `draw`, so every error message groups 2 and 3
      add lands in it twice over. Messages are three quarters of the checker
      entry by weight, and this change writes several long ones
- [ ] 7.2 **OWNER**: the dispatch is batched with `strict-tool-input` and
      `brace-annotations` rather than performed here, so this task is the
      changeset being ready and nothing more. When it does go out it is the
      first release to publish tokenless, and the log line to look for is "No
      NPM_TOKEN found, but OIDC is available"
- [ ] 7.3 **OWNER**: after publishing, draw a self-transition through the MCP
      server in a real client — the thing that was impossible when this change
      was written

Gate: all verification commands green, `openspec validate arc-connectors
--strict` green, no golden moved at all, and the only generated bytes that
move being the two examples' entries in `resources.generated.ts`.
