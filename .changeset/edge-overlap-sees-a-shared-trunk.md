---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

`edge-overlap` reports two connectors that share a trunk and then part, where
before it only reported a pair drawn on top of one another the whole way.

**`check` will report diagrams it passed before, and nothing you draw moves.**
No renderer file changed, every golden regenerates clean, and the rendered
bytes of every diagram are what they were. This is a minor because `check` is
run in CI: on a 0.x version a caret range stops at the minor, so a release that
can turn a green pipeline red must be one you choose rather than one that
arrives on the next install.

The rule it replaces asked that *every* sampled point of each path lie near the
other. A pair that runs together and then separates never satisfies that —
each has points at its far end the other never comes near, so one failing
sample made the whole test false. That is not a threshold set too high: the
quantity being measured was "do these coincide entirely", and a trunk answers
no. Measured on this repository's own showcase before its routing was fixed,
262 px of connector was drawn along other connector — 76, 70, 58 and 58 — and
`npm run diagrams` reported zero warnings on that file, before the fix and
after it.

The finding names the length, because "these two overlap" and "these two share
62 px" are different amounts of help when the fix is to move one line:

```
edges 2 and 3 are drawn along one another for about 62 px; give one of them a bow
```

"About" is meant. The walk is quantised, and a parting path keeps counting
until it is clear of the ink by `2 * INFLATE`, so a 20 px trunk reports as 24.

**Which diagrams start reporting.** None of the ten this repository ships —
`npm run diagrams` is 0 errors, 0 warnings across all of them, and the
threshold was calibrated against them rather than checked against them
afterwards. What starts reporting is the shape those diagrams were already
routed to avoid: two connectors leaving one anchor, or arriving at one, that
draw as a single line for 40 px or more before going different ways. If you
have an orthogonal layout where several edges leave one node and turn at a
shared corner, expect a warning per pair.

**What stays quiet, deliberately.** A run is measured only for two edges
sharing exactly one anchor. A pair sharing *both* is the shape `bow` exists to
separate — they must meet at each end whatever they do between, so a run there
says nothing, and the whole-length test still governs them: a bow of 4 is
reported and 5 is not, exactly as before. A pair sharing *neither* cannot be
told from a shallow crossing by proximity alone, since two lines meeting at a
narrow angle stay within the same distance for an arbitrarily long run — so
two connectors sharing a corridor without sharing an end are still only caught
if they coincide the whole way. That is a real blind spot and it is written
down rather than discovered.

Two more limits worth knowing. The 40 px threshold is in diagram units while
the distance that counts as one line is a fixed 4.2 px of ink, so the rule is
not scale-free: a diagram drawn at twice these proportions will report forks
this one leaves alone. And two edges leaving one anchor at less than about 6°
are reported at any scale, because a band that thin takes that long to escape.

`rules: { 'edge-overlap': 'off' }` switches the whole rule off as it always
did. There is no separate threshold option — a knob nobody can calibrate
against their own diagrams reports a different picture to every reader.

`@pensketch/core/check` grows from 3008 to 3297 bytes min+gzip. The root entry
and `@pensketch/core/server` do not move at all: the rule is in the checker,
not in shared code. Cost is unchanged in practice — 0.209 ms against 0.221 on
the largest diagram here — because a pair that shares no anchor is rejected
before any measuring. Where it does bite is a hub: the walk is quadratic in the
fan-out of a single anchor, so 20 edges off one node cost 17 ms and 40 cost
150, against 0.13 and 0.32 before.

`@pensketch/mcp` reissues because `check_diagram` returns the new findings and
the reference it serves describes the rule and its limits.
