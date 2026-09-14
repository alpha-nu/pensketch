---
'@pensketch/mcp': minor
---

One mistake draws one sentence. A number where an edge side belongs used to
draw two complaints — `from[1] must be string` and `from[1] must be one of
"t", "b", "l", "r"` — because the slot fails its type and its enum at once.
The enum sentence subsumes the type one (nothing satisfies the list without
being a string), so the type line is dropped wherever an enum names the
same path. Only that exact pairing collapses: a type error on a path no
enum names, like a bare id slot or a whole tuple, keeps its voice, and the
tuple-level hint ("an edge end is [\"nodeId\", \"side\"]") is untouched.
