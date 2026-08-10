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

- [x] 2.1 `LOOP_OUT` and `LOOP_SPAN` constants with the defaults, documented
      as starting points rather than as computed values
- [x] 2.2 Loop geometry in `geometry.ts`: two anchors on a side `span` apart,
      an arc projecting `out`, arrowhead on the returning anchor
- [x] 2.3 `draw` recognises same id + same side and draws the loop, in the
      edges phase, in array order
- [x] 2.4 Same id + **different** sides throws, with a message naming the node
      and saying a self-transition attaches to one side. This is the case that
      silently rendered a stub before — a test asserts the throw and names the
      old behaviour in its title
- [x] 2.5 `label`, `lx`, `ly`, `anchor`, `dotted` behave on a loop exactly as
      on any other edge
- [x] 2.6 Types and JSDoc; the schema regenerates and gains `out`/`span`
- [x] 2.7 Tests including a round trip through `JSON.parse(JSON.stringify())`,
      because crossing that boundary is the entire point

Known and left open, so that no later group has to rediscover it: `check`
does not see the loop. `edgePath` returns the two identical anchors plus any
`via`, which is not what the renderer draws, so a loop leaving the frame goes
unreported while a label near the side's midpoint can be reported as sitting
on a line that has no ink, and a `via` the arrow never turns at as a corner
outside the viewBox. None of tasks 2.1 to 2.7 promised otherwise and none is
ticked falsely; the scenario that claimed the checker could see it has been
deleted from the core-renderer delta, where it exercised nothing in its own
requirement and duplicated the checker delta's own wording. 4.1 closes it.

## 3. Bowed connectors

**Both halves of the budget decision are taken.** `./server`'s budget is 3328
and this group starts with 373 B of it free. The other half binds every message
written here: carry which item is wrong, what conflicts, and the one fact the
caller cannot derive from those two — then stop. A clause restating the fact in
another mood is not a second fact. Bytes never come out of the enumeration of
what does exist: `known()` is the most expensive part of its message and the
most valuable, because a program with no view of the picture cannot recover the
list of real ids any other way.

**`via` on a self-transition throws**, written at 3.3 alongside `bow` with
`via`, which is the same defect under different names. The line the spec now
draws, so later groups stop re-litigating it: a field that **contradicts** the
path actually drawn throws, and a field that merely does not **apply** to it is
ignored. `via` on a loop names corners the loop will not turn at; `out` and
`span` on a straight edge name a loop that is not being drawn, and say so in
their own names.

3.3 also owns two false findings the checker produces today, both from `via` on
a loop and both measured. `out-of-bounds` reports "edge N turns at (x, y)" for
a corner the arrow never turns at, because `check` walks `e.via` directly.
`label-collision` reports a label lying on the line it labels where no ink is
drawn near it, because `edgePath` splices the same `via` in. Making the input
throw does not settle these on its own: `check` runs on diagrams that are never
drawn, which is most of the reason it exists.

- [x] 3.1 `bow` on `DiagramEdge`: perpendicular offset from the chord
      midpoint, positive to the right of travel
- [x] 3.2 `bow` on `DiagramNote` pointers, same meaning
- [x] 3.3 `bow` with `via` throws on both, and so do `via` and `bow` on a
      self-transition — one message shape for all four, saying the path is
      already described. A loop's path is settled by its side, `out` and
      `span`, so a corner to turn at and a bulge to carry both contradict it,
      and the line group 3 draws puts contradiction on the throwing side. In
      the same task, `check` stops reading a loop's `via`: it is neither a
      corner the arrow turns at nor a line a label can lie on, and reporting it
      as either is a finding about ink that is not there. `bow` that is not a
      finite number is settled here too, since this is where the field's
      refusals are written — today `NaN` reads as falsy and draws the straight
      line while `Infinity` throws, and neither is a decision anyone took
- [x] 3.4 Tests: `A→B` and `B→A` at the same positive `bow` land on opposite
      sides; an edge without `bow` is byte-identical to before. Both landed
      with the tasks that earned them rather than in a pass of their own. The
      second is held by the parity tests, not by a new assertion: they
      re-render the reference's fixtures through the port and compare bytes
      against goldens generated from `reference/renderer.html`, which predates
      every bow — so "before this change" has an instrument that cannot drift
      with the change, which no self-comparison could offer. Verified rather
      than assumed: a duplicated final anchor on the unbowed path fails parity
      on its own

Gate: `npm run size`. `./server` is the tight entry and both this group and
the last one add to `draw.ts`, so a breach is found by the group that caused
it rather than at 7.1.

## 4. The checker catches up

- [x] 4.1 Sample loops and bows into segments so every existing geometric rule
      sees the path actually drawn, not the chord. `edgePath` now repeats
      `draw`'s four-way branch rather than its own two-way one, and the
      anti-drift test covers all four shapes plus the fields each branch reads,
      because a disagreement between two branchings is the failure this
      creates. `out-of-bounds` walks that path with both ends dropped — an
      anchor outside the frame is a node outside the frame, and the rule above
      it already says so — and reports the first point outside rather than
      every one, since ten of a loop's twelve inner samples leave together.
      "turns at" is gone with the corner-by-corner walk: a curve turns nowhere.
      The measured cost on `./check` is 372 B, landing at 2458 — inside the
      2560 this task was written against, with 102 to spare, once review
      stopped `at` being rounded and saved 5 of it
- [ ] 4.2 `edge-overlap`, warning: two paths within a small distance along
      their whole length. Does not fire on a crossing.

      **The budget was settled before this was written, and it is the same
      decision `./server` took before group 3: raise it and shorten the
      messages, both.** `./check` goes to 3072, so this starts with 614 B free.
      Two independent minimum prototypes — one helper over `pointToSegment`, a
      `RuleId` member, a `DEFAULTS` row, one pairwise loop, one message — came
      in at 2597 and 2618, which is 37 to 58 over the old 2560 and comfortably
      inside the new one. The same measurement showed the rule *logic* fits
      2560 and a message of this project's quality does not: a stub reading
      `edges 0 and 1 overlap` lands 2 B under. That is the trade the raise
      refuses to make, since a caller who cannot see the drawing has nothing
      but the message. The standard still binds: which item, what is wrong, the
      one fact the caller cannot derive from those two, then stop
- [ ] 4.3 Rule count is eight; the requirement heading that counted them is
      renamed, and every table listing rules is updated
- [ ] 4.4 Tests for both, including the near-parallel case and the crossing
      case that must stay quiet

4.1 carries a debt three shipped strings depend on. `DiagramEdge.out`'s JSDoc
says `check` reports a loop that leaves the frame, and that sentence is copied
verbatim into `schema/diagram.schema.json` and into the `SCHEMA` the server
hands to agents. It becomes true when 4.1 lands and nothing releases before
then — but narrow 4.1 and all three go false together, and no gate can see it.

Gate: `npm run size`. This group's weight lands on `./check`, which has 474 B
free and where finding messages are already three quarters of the entry.

## 5. The reference stops being wrong

- [ ] 5.1 Trap 4 in `docs/agents.md` already states the rule, as of the group 2
      remediation: the false sentence went the moment it became false, on
      62f0006's precedent that a document contradicting what it documents is
      drift rather than a scheduled edit. What is left here is the narrative —
      that the rule used to be the opposite, and where the loop went — for a
      reader who learned the old one
- [ ] 5.2 `raw` described as the hatch for what the data model still has no
      word for, rather than for self-transitions specifically
- [ ] 5.2a "`draw` throws on the first defect and renders nothing" is false and
      was false before this change: `draw` empties the `<svg>` and then fills
      it phase by phase, so a throw leaves whatever was drawn before it. Six
      children after a label throw, measured at 46ad20a. Group 3 makes it more
      visible — a note refused for `bow` with `via` has already had its text
      drawn — but did not make it wrong. The same clause is in the shipped
      `diagram-checker` spec, so both move together
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
