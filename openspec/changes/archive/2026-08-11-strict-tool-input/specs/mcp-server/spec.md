# mcp-server — Delta Specification

> A boundary that discards what it does not recognise is worse than one that
> refuses it, because the caller cannot see the result.

## MODIFIED Requirements

### Requirement: Image output is bounded
`render_png` SHALL default to a scale of 2, SHALL cap the rendered pixel
dimensions, and SHALL refuse a request that exceeds the cap rather than
returning it. Images are base64-encoded into the caller's context, so an
unbounded one costs the caller the very budget the tool exists to serve — but
a scale of 1 renders a diagram whose labels are the first thing to become
unreadable, and an image a caller cannot read costs that budget for nothing.
The default SHALL be the one the tool's own description states.

#### Scenario: An oversized request is refused
- **WHEN** a caller asks for a scale that would exceed the dimension cap
- **THEN** the tool returns an error naming the cap, and no image

#### Scenario: The stated default is the real one
- **WHEN** a caller reads the scale argument's description and omits the argument
- **THEN** the image is rendered at the scale that description names

### Requirement: Resources mirror files that already exist
The server SHALL expose the agent-facing spec, the JSON Schema for `Diagram`,
the diagrams this repository ships as examples, and the frozen constants. Each
SHALL be read from its existing single source rather than restated, and a test
SHALL assert the served bytes match that source.

An example SHALL be served as an envelope carrying the diagram, the frame to
draw it in, and what a reader needs to know about it — and its description
SHALL say which of those fields are the tool's arguments. The envelope is not
itself an argument, and a description that invites it to be passed as one is
wrong in the direction that costs a caller a wasted call.

#### Scenario: A resource cannot drift from its source
- **WHEN** the agent-facing spec file changes and the served resource is not updated
- **THEN** the test comparing them fails

#### Scenario: Examples are served as data
- **WHEN** an example resource is read
- **THEN** its `diagram` field is a diagram `render_diagram` accepts unchanged, and its `viewBox` is the frame to pass beside it

## ADDED Requirements

### Requirement: The tool boundary refuses what it cannot carry
Every tool's arguments SHALL be validated strictly **at their top level**: a
key the tool does not declare SHALL be refused, naming that key, rather than
accepted and discarded. This SHALL apply to the diagram argument and to the
arguments beside it, and SHALL include `raw`, which the server does not accept
because it holds functions that JSON cannot carry.

It SHALL NOT extend to the fields inside a node, an edge or a note. Those are
described by `pensketch://schema`, which the server publishes and which
forbids extras at every level, and restating them at the boundary would be a
second source of truth for a shape that already has one. A caller that
misspells a member field therefore still gets a drawing missing that field's
contribution — the same defect this requirement fixes one level up — and the
schema is what catches it.

A refusal SHALL name what the caller should have sent, not only what was
wrong: the fields or arguments that are accepted, and where the rest are
written down. A caller that cannot see the drawing has only the message.

The reason is the audience. A caller that cannot see the rendered result has
only what the server tells it, and silently dropping part of a diagram gives
back a picture that is wrong in a way nothing in the response reveals. It also
contradicts the schema this same server publishes as `pensketch://schema`,
which is generated with `additionalProperties: false` and which callers are
told to validate against.

The schema each tool publishes in its listing SHALL declare that same
restriction — additional properties forbidden, at the top level and on the
diagram — so that a client reading the contract is not told it may send a key
the server is about to refuse. This is a claim about those two flags and not
about the schema agreeing with the boundary in general: a generated schema
expresses some constraints less precisely than the validator enforces them.

#### Scenario: The published schema declares the restriction it enforces
- **WHEN** a client lists the tools and reads a tool's input schema
- **THEN** additional properties are forbidden at the top level and on the diagram, rather than the schema admitting a key the server is about to refuse

#### Scenario: An unrecognised field is named, not dropped
- **WHEN** a diagram carries a top-level key the server does not declare
- **THEN** the call fails with a message naming that key, rather than returning a rendering of the diagram without it

#### Scenario: A misspelled field is an error, not an empty picture
- **WHEN** a caller sends `node` where the schema says `nodes`
- **THEN** the call fails naming `node`, where before it rendered an empty diagram and reported no problem

#### Scenario: `raw` is refused in the words the description uses
- **WHEN** a diagram carries `raw`
- **THEN** the call fails saying so, matching the tool description that already tells callers it is not accepted — rather than rendering the diagram minus whatever `raw` would have drawn

#### Scenario: A valid diagram is unaffected
- **WHEN** a diagram uses only declared fields
- **THEN** it renders exactly as it did before, since the keys this refuses never reached the renderer
