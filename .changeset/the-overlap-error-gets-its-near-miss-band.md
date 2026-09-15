---
'@pensketch/core': minor
'@pensketch/mcp': minor
---

`touching-ink`, a warning under `node-overlap` the way `clipped-ink` sits
under `out-of-bounds`: the error measures ideal boxes, but a stroke lays
down a band about 4.2 px wide — `WIDTH` plus the `AMP` the jitter moves it
across, the same figure `HOP_GAP` has always been priced on — centred on a
side that itself wobbles. Two boxes clearing by less than that band can
have touching ink while the error stays rightly silent. Swept boxes are
measured, so a pair the flat render clears can extrude into the band.
`RuleId` grows to thirteen; a `default` arm reads this release as it read
the last.
