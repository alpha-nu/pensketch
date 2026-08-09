---
'@pensketch/mcp': minor
---

Refuse a key the tool does not recognise, instead of dropping it.

The server generates its JSON Schema with `additionalProperties: false`,
serves it as `pensketch://schema`, and tells callers to validate against it.
Its own tool boundary then validated with a lenient object, which silently
stripped anything the schema forbids. A diagram carrying a key the server did
not know reached the renderer without it: no error, no diagnostic, and a
caller who cannot see the picture had no way to learn that a piece of it was
missing. The common case was not an exotic field but a misspelled one —
`node` for `nodes` rendered an empty diagram and reported no problem.

Every tool's arguments are now validated strictly, and the offending key is
named back to you: `Unrecognized key: "node"`. The schema each tool publishes
in its listing says the same, so a client validating locally reaches the same
verdict the server will.

This is a minor rather than a patch because input that used to be accepted is
now refused. Nothing that was reaching the renderer stops reaching it — the
keys this refuses never got there, which was the defect. Diagrams that follow
the published schema are unaffected, including every example this server
serves.
