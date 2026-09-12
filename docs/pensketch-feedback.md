# pensketch — developer feedback

Notes from a session where an LLM caller (Claude, in a chat client with no MCP
resource access) tried to produce a hand-sketched flowchart with pensketch.
Ordered roughly by how much pain each issue caused.

## The root problem: the schema was unreachable

Every tool description says "read the pensketch://schema resource for every
field," but in this client there is no way to read MCP resources — only tools.
So the one document that defines `lines`, the anchor letters, and the edge tuple
form was invisible, and the schema was reverse-engineered by crashing eight
times.

- Expose a `pensketch:get_schema` **tool** (or a `describe` action on the
  existing ones) that returns the same content. Resources are optional in many
  clients; tools are universal.
- Failing that, inline a minimal complete example in each tool's description.
  Six lines would have prevented every single error hit in this session:

  ```json
  {"nodes":[{"id":"a","shape":"box","x":40,"y":40,"w":160,"h":50,"lines":["hello"]}],"edges":[{"from":["a","r"],"to":["b","l"],"label":"then","lx":250,"ly":60}]}
  ```

- The description of `check_diagram` references `render_png`, which isn't among
  the exposed tools. Either ship it or stop referencing it — a call was spent
  wondering whether a capability was missing.

## Silent ignores are worse than errors

The single most expensive failure: two full renders with node text as `text`,
then as `label`. Both are ignored without comment, producing a beautiful diagram
of seven empty boxes and no signal about why.

- Reject unknown keys inside nodes/edges/notes by name, exactly as the top level
  already does for unknown top-level keys. The current split — strict outside,
  silently permissive inside — is the worst of both.
- At minimum, warn: `node "a" has no lines; nothing was drawn inside it (did you
  mean lines?)`.
- Accept `text` and `label` as aliases for `lines` (string or array). They're the
  two names any caller will reach for first.

## Error messages: one is excellent, the rest are stack traces

The good one, which should be the template everywhere:

> edge 0 has label "then" but lx and ly are not both numbers; labels are placed
> by hand because text is never measured

It names the element, the fields, the expectation, and the reason. Also good:
the unknown-node error that listed all known ids.

The bad ones, all hit repeatedly:

- `TypeError: undefined is not iterable` — this is an invalid anchor letter. It
  should say: `edge 0: unknown anchor "e" in from; valid anchors are "t", "r",
  "b", "l"`. Five calls were burned guessing `right`, `e`, `1`, `r`, and object
  forms.
- `TypeError: Cannot read properties of undefined (reading '0')` — this is an
  edge missing `from`.
- `TypeError: Cannot read properties of undefined (reading 'length')` — this is a
  note using `text` instead of `lines`. Nothing in the message mentions notes.

Concretely: wrap the whole render in validation so no raw JS TypeError can ever
escape, and include a JSON-path (`edges[0].from[1]`, `notes[0].lines`), the
expected type, the valid enum, and a fix hint.

## Validate everything at once

Both tools stop at the first crash. One seven-node diagram had three independent
mistakes, found one call at a time. Return all findings in a single response
instead — probing cost would drop from eight calls to one or two. This matters
more for an LLM caller than a human one, since each call is a round trip the user
waits through.

## check_diagram and render_diagram disagree

This one is genuinely dangerous, because it produces false confidence.
`check_diagram` accepted `from: [210, 67]` (raw coordinate pairs), ran all its
geometry rules, and reported **"0 errors"** — and then `render_diagram` rejected
the identical input with `names unknown node "210"`.

- The checker must parse with the same code path as the renderer. A clean check
  should be a guarantee.
- Decide which edge forms are legal and support them in both. Raw point pairs are
  genuinely useful for annotation arrows that don't attach to nodes — if you keep
  them, make the renderer accept them; if not, make the checker reject them.
- Relatedly, the `orphan-node` warning is correct but incomplete. When *every*
  node is orphaned, that's a near-certain sign the caller is using an unsupported
  edge form — say so.

## Nothing reaches the user

The render returns SVG markup as plain text. In this chat client that text isn't
rendered, so from the user's side the tool produced nothing at all — which
happened twice, and the diagram had to be redrawn by hand in a different tool.

- Return the SVG as an MCP `image` content block, or as a `resource` with
  `mimeType: "image/svg+xml"`, so clients that can render it do. Keep the markup
  as a second text block for callers that want to edit it.
- Ship the PNG path the docs already imply. Many clients render PNG and nothing
  else.
- Say in the tool description what the caller should do with the markup — save
  it, embed it, hand it back — because the honest default assumption ("the client
  will show this") is wrong.

## Token cost

The seven-node render was roughly 35,000 characters, largely because every stroke
is doubled and every coordinate carries 15 decimal places
(`M210.33039224552923 65.70711287506856`).

- Round to 2 decimals. It's visually identical and cuts the payload by well over
  half.
- Add a `precision` parameter.
- Better still, return a short resource URI plus the findings, and let the caller
  fetch the markup only if it actually needs the bytes. What was needed here was
  the *picture*, not the path data — but the picture couldn't reach the user
  without retyping all 35,000 characters by hand.

## Smaller ergonomics

- Anchor aliases: accept `left`/`right`/`top`/`bottom` and `n`/`s`/`e`/`w`
  alongside `t`/`r`/`b`/`l`. Those are the first guesses; rejecting them buys
  nothing.
- Corner anchors (`tl`, `tr`, `br`, `bl`) or a fractional side position
  (`["a", "r", 0.25]`) — with two edges landing on the same anchor, arrowheads
  pile up on one point.
- Optional auto-placed edge labels (default to the midpoint, offset
  perpendicular). Requiring hand-placed `lx`/`ly` is defensible given text isn't
  measured, but a decent default with the option to override would have saved two
  rounds of collision arithmetic.
- Return resolved anchor coordinates in the findings. Then a caller can verify
  geometry numerically without needing to see the image.
- Version the schema and include the version in every response, so a caller can
  tell whether its cached field knowledge is current.
- A `lint`-only mode that reports *stylistic* issues (two edges sharing an
  anchor, an edge label sitting within N px of another stroke) would catch the
  things the findings engine nearly catches already.

## What already works well, for balance

Determinism by seed is the right call, and the `seed` parameter giving a
genuinely different "hand" from identical data is a lovely touch. The findings
engine is the best part of the tool — overlap, out-of-bounds, text-too-wide, and
orphan detection in the same call as the render is exactly right, and "No
findings" after a clean layout is a real signal. The refusal to do layout or
routing is a defensible stance, clearly stated. And the deliberate hop-breaking
of crossing connectors is a detail most diagram libraries skip.

## One-line summary

The drawing engine is good, and nearly all the cost is in discovery and error
reporting. Ship the schema as a tool, never let a TypeError escape, and return
something a client can actually display.
