---
'@pensketch/mcp': minor
---

The server names its own build where a model can see it. `serverInfo` has
carried the version since the first release and most clients hide it, so a
probe suite spent eight fixed calls deducing which build served an endpoint
— stale deployments and live ones answer alike until something says which
they are. Two strings now say it: the `get_schema` description ("this build
is @pensketch/mcp x.y.z"), readable at discovery without a call, and the
refusal footer, so any rejected diagram identifies the build that rejected
it. Both are substituted at build time from the manifest; nothing new for
the version pin to maintain.
