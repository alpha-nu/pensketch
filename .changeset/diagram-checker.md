---
'@pensketch/core': minor
---

Adds `check`, on the new subpath `@pensketch/core/check`.

It reports the layout defects neither the types nor the JSON Schema can see:
two boxes drawn over each other, a label a connector will be drawn through,
text wider than the box holding it, a node half out of its lane, a node no
edge names, anything outside the `viewBox`. Seven rules, each raisable,
lowerable or switchable off, returning findings sorted by severity, then
rule, then position — so the same diagram always yields the same array.

It never renders, never touches a DOM, never measures text and never changes
the diagram: a finding says where the problem is and leaves the fix to the
caller. Its own entry point, so a page that never imports it ships none of
it, and the root entry is byte-for-byte the size it was before.

Minor rather than patch because it adds API. Nothing about the rendered
output changed — this draws nothing.

Text is never measured, so two of the rules rest on an estimate of
`length × fontSize × 0.55`, measured against the documented handwriting stack
and deliberately wider than every real label in it. It over-states, so it
warns early rather than missing an overflow, and every finding that depends
on it carries `estimated: true`.
