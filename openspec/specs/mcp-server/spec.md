# mcp-server Specification

## Purpose
TBD - created by archiving change mcp-server. Update Purpose after archive.
## Requirements
### Requirement: Three tools, all pure
The server SHALL expose `check_diagram`, `render_diagram` and `render_png`.
All SHALL be pure functions of their arguments: no network access, no
filesystem access, no stored state, no secrets. `check_diagram` SHALL return
the checker's findings plus a count of errors and warnings. `render_diagram`
SHALL return SVG text. `render_png` SHALL return image content.

#### Scenario: Checking a diagram with a defect
- **WHEN** `check_diagram` is called with a diagram whose nodes overlap
- **THEN** it returns the finding and a non-zero error count

#### Scenario: The same call twice
- **WHEN** any tool is called twice with identical arguments
- **THEN** the results are identical, because nothing outside the arguments is read

### Requirement: The image is deterministic and honest about its font
`render_png` SHALL rasterize with one embedded open-licence font and SHALL NOT
load system fonts, so that the same arguments produce the same image on every
machine and transport. The embedded face SHALL be chosen by measuring
candidates against the documented font stack and taking the closest. The
tool's description SHALL state that the text is drawn in a stand-in face, that
the image is authoritative about structure, and that `check_diagram` — not the
image — is authoritative about whether text fits.

#### Scenario: Same image everywhere
- **WHEN** `render_png` is called with identical arguments on a machine that has the real fonts installed and on one that has none
- **THEN** both return the same image

#### Scenario: The caller is told what the image cannot settle
- **WHEN** a client lists the tools
- **THEN** `render_png`'s description says the font is a stand-in and points at `check_diagram` for questions of text fit

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

### Requirement: Tool descriptions state what the caller must do themselves
Each tool's description SHALL state that coordinates are the caller's to
choose and nothing is laid out for them, and that text is never measured so a
box does not grow to fit its label.

#### Scenario: The two traps are visible before any resource is read
- **WHEN** a client lists the tools
- **THEN** both facts appear in the descriptions, without needing a resource fetch

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

### Requirement: Rendering needs no browser
The server SHALL produce SVG through `@pensketch/core/server` rather than a
renderer of its own, and SHALL NOT depend on jsdom, a browser, or any native
module. Rasterization SHALL use a WebAssembly rasterizer rather than a native
binding, so that installing the server cannot fail on an untested platform.

#### Scenario: Renders with no DOM present
- **WHEN** `render_diagram` runs in an environment with no `document` and no `SVGSVGElement`
- **THEN** it returns SVG

#### Scenario: One renderer, not two
- **WHEN** core's rendering changes
- **THEN** the server's SVG changes with it, because it holds no copy of that logic

### Requirement: Distributed over stdio, and installable with nothing else
The server SHALL run over stdio through a published `bin`, so that `npx
@pensketch/mcp` registers in any client that spawns a process. It SHALL
require no hosting, no account and no credentials. Documentation SHALL pin a
version in the `npx` invocation and SHALL state that Node must be on the
client's `PATH`, that being the most common reason such a server fails to
start under a GUI-launched client.

#### Scenario: Registered in a stdio client
- **WHEN** a client is configured with `npx -y @pensketch/mcp@<version>` as the command
- **THEN** the server starts and lists all three tools and every resource

#### Scenario: Nothing to sign up for
- **WHEN** a user installs the server
- **THEN** no key, token, account or endpoint configuration is required

### Requirement: The transport is separable from the server
The tools and resources SHALL be built by a server factory that the transport
entry merely connects, so that a second transport can be added as an entry
point rather than a rewrite. No tool implementation SHALL depend on how the
client is connected.

#### Scenario: A second transport would be additive
- **WHEN** an HTTP transport is added later
- **THEN** it connects the same factory, and no tool changes

### Requirement: A tool that is not pure does not ship
No tool SHALL read the network, touch a filesystem, hold a secret or keep
state between calls. This is what makes every tool deterministic, testable
without fixtures, and safe to run in any sandbox — and it is the same promise
the rendering packages make, applied to the server.

#### Scenario: An impure tool is rejected
- **WHEN** a proposed tool would fetch a URL
- **THEN** it cannot ship under this requirement, because its output would no longer be a function of its arguments

### Requirement: No layout, no generation
The server SHALL NOT expose a tool that produces or repairs a diagram's
coordinates. Automatic layout remains a project non-goal, and the server is
not a way around it.

#### Scenario: Checking, not fixing
- **WHEN** `check_diagram` finds a collision
- **THEN** it reports it, and no tool offers replacement coordinates

### Requirement: The tool boundary refuses what it cannot carry
Every tool's arguments SHALL be validated strictly **at their top level**: a
key the tool does not declare SHALL be refused, naming that key, rather than
accepted and discarded. This SHALL apply to the diagram argument and to the
arguments beside it, and SHALL include `raw`, which the server does not accept
because it holds functions that JSON cannot carry.

It SHALL NOT extend to the fields inside a node, an edge, a brace or a note.
Those are
described by `pensketch://schema`, which the server publishes and which
forbids extras at every level, and restating them at the boundary would be a
second source of truth for a shape that already has one. A caller that
misspells a member field therefore still gets a drawing missing that field's
contribution — the same defect this requirement fixes one level up — and the
schema is what catches it.

The declared top-level keys SHALL be exactly the diagram's own arrays, so that
a field the data model gains and the boundary does not is a refusal a caller
reads rather than a key the server drops. A test SHALL hold the tool's
declared shape to the published schema's top level, so forgetting one is a
failing build rather than a diagram that draws short.

#### Scenario: An unrecognised top-level key is named
- **WHEN** a diagram argument carries a key the tool does not declare
- **THEN** the call is refused with a message naming that key and the fields it should have used

#### Scenario: A member field is not checked here
- **WHEN** a node, edge, brace or note carries a misspelled field
- **THEN** the boundary accepts it and `pensketch://schema` is what rejects it

#### Scenario: A new diagram array cannot be forgotten
- **WHEN** the data model gains a top-level array and the tool's shape is not taught it
- **THEN** the test holding the two together fails, rather than the server silently discarding the field

