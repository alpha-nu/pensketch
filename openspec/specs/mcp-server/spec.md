# mcp-server Specification

## Purpose
TBD - created by archiving change mcp-server. Update Purpose after archive.
## Requirements
### Requirement: Three tools, all pure
The server SHALL expose `check_diagram`, `render_diagram` and `render_png`.
All SHALL be pure functions of their arguments: no network access, no
filesystem access, no stored state, no secrets. `check_diagram` SHALL return
the checker's findings plus a count of errors and warnings. `render_diagram`
SHALL return SVG text **and the findings for the drawing it just made**.
`render_png` SHALL return image content.

`render_diagram`'s findings SHALL be computed over the geometry it rendered,
including `extrude` and `depth`, so they describe the drawing the caller
received rather than a different one. Purity is untouched: the findings come
from the same arguments, and calling the tool twice still returns the same
bytes.

`check_diagram` SHALL remain, and SHALL NOT instruct callers to run it before
rendering. It serves the caller who wants findings without markup, and the
caller about to spend a multi-second raster.

A refusal SHALL stay one block. `render_diagram` returns two blocks when it
draws and one, carrying `isError`, when it cannot: there is no drawing to
report findings for. A caller reading the second block unconditionally SHALL
find it absent on a throw, which is the same shape every tool here has always
had for an error.

#### Scenario: Checking a diagram with a defect
- **WHEN** `check_diagram` is called with a diagram whose nodes overlap
- **THEN** it returns the finding and a non-zero error count

#### Scenario: One call, both answers
- **WHEN** `render_diagram` is called with a diagram whose label overflows its box
- **THEN** it returns the markup and the `text-overflow` finding together, and the caller needs no second call to learn of it

#### Scenario: A diagram that cannot be drawn
- **WHEN** `render_diagram` is called with a diagram `draw` refuses
- **THEN** it returns one block carrying the renderer's message and `isError`, not a second block reporting findings for a drawing that does not exist

#### Scenario: A clean diagram says so
- **WHEN** `render_diagram` is called with a diagram that has no findings
- **THEN** it returns the markup and reports no findings, rather than omitting the report

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

### Requirement: The rendering tools accept the diagram-wide hop switch
`render_diagram` and `render_png` SHALL accept an optional `hops` boolean
beside `seed` and pass it to `draw` as the diagram-wide default, so that an
agent can ask for hops without setting `hop` on every edge it writes. Omitted,
it SHALL behave exactly as it does today.

`check_diagram` SHALL NOT accept it. `check` does not model hops — the path it
walks is the un-hopped one — so declaring `hops` there would accept an argument
that changes no finding. Left undeclared, the tool's existing strict-key
handling refuses it and names it, which tells a caller that hops are a
rendering concern rather than leaving them to conclude it from a report that
did not change.

Per-edge `hop` needs nothing here: it is a member field, described by
`pensketch://schema`, which the server publishes and which already forbids
extras at every level.

#### Scenario: An agent turns hops on for a whole diagram
- **WHEN** `render_diagram` is called with `hops: true`
- **THEN** the returned SVG draws an arc at each crossing the resolution rules select, and the same call without it returns what it returns today

#### Scenario: The checker names the argument it does not take
- **WHEN** `check_diagram` is called with `hops`
- **THEN** the call is refused with a message naming that key, rather than returning findings computed as though it had been applied

#### Scenario: A per-edge hop needs no tool change
- **WHEN** an agent writes `hop: true` on an edge and calls `render_diagram`
- **THEN** it is accepted through the published schema, with no argument declared beside the diagram for it

### Requirement: A rendered diagram can be asked to draw itself
`render_diagram` SHALL accept `animate`, defaulting to `false`. With it set,
what comes back SHALL be one self-contained `<svg>` carrying its own scoped
`<style>`, which draws itself inline in a page, embedded as `<img src>`, or
opened as a file, with nothing else fetched.

The parameter's own description SHALL say what comes back and that it needs
nothing else. A tool schema is what an agent reads before it reads any
resource, so a caller that never opens `pensketch://spec` still learns the
result is complete on its own.

`render_png` SHALL NOT accept `animate`. A raster cannot animate, and this
server refuses what it cannot carry rather than accepting a field it would
ignore.

The degradation SHALL be stated where the feature is documented: on an engine
that does not understand `@scope` the diagram renders finished and static.
An agent handing the markup to a consumer it cannot see needs to know the
failure is a still diagram rather than an empty frame.

#### Scenario: Animated markup stands alone
- **WHEN** `render_diagram` is called with `animate`
- **THEN** the returned markup contains its own `<style>` and references no external file

#### Scenario: The raster refuses it
- **WHEN** `render_png` is called with `animate`
- **THEN** the call is refused by name, rather than returning a still image as though the request had been honoured

#### Scenario: An agent is not asked to write CSS
- **WHEN** a caller reads only the tool schema
- **THEN** it learns that one boolean produces a complete result, with no stylesheet to supply and no attribute to add

### Requirement: All three tools accept the diagram-wide depth pair
`render_diagram` and `render_png` SHALL accept an optional `extrude` boolean
and `depth` number beside `seed` and `hops`, and pass them to `draw` as the
diagram-wide default, so an agent can raise a whole diagram without setting
the pair on every node it writes. Omitted, they SHALL behave exactly as they
do today.

`check_diagram` SHALL accept the same pair — the deliberate opposite of
`hops`, and for the same reason read forward: `hops` is refused there because
it changes no finding, and `extrude`/`depth` are accepted because they change
the geometry every finding measures. Refusing them would return findings
computed for a drawing the caller is not making.

Per-node `extrude` and `depth` need nothing here: they are member fields,
described by `pensketch://schema`, which the server publishes, which forbids
extras at every level, and which SHALL regenerate to carry them. The test
that holds each tool's declared shape to the published schema SHALL hold for
the new arguments the way it holds for the arrays.

#### Scenario: An agent raises a whole diagram
- **WHEN** `render_diagram` is called with `extrude: true`
- **THEN** the returned SVG draws every node as a slab at `DEPTH`, and the same call without it returns what it returns today

#### Scenario: The checker measures the drawing the renderer will make
- **WHEN** `check_diagram` is called with `extrude: true` on a diagram whose slab would cross the viewBox
- **THEN** it reports `out-of-bounds` for that node, where the same call without the pair reports none

#### Scenario: The pair is honest about its default
- **WHEN** `render_png` is called with `extrude: true` and no `depth`
- **THEN** the raster draws slabs at `DEPTH = 12`, the same drawing `render_diagram` returns for the same arguments

### Requirement: The tool descriptions ask for the cheap spelling
The `diagram` argument description SHALL ask for compact JSON, and SHALL be
honest that it is a request rather than a constraint: the model chooses how it
spells its own output. Across the 15 diagrams this repository shipped on
2026-09-06 the difference is 14,804 tokens at `JSON.stringify(d, null, 2)`
against 7,466 minified, 49.6%. A figure over a corpus SHALL carry the date it
was taken, because the corpus grows and no gate holds it. That ceiling is measured against a machine's pretty-printer:
the one agent whose output was measured was already within 0.4% of minified,
so the floor is nearly nothing. Any figure this description or its
documentation quotes SHALL say which of the two it is.

#### Scenario: A description that does not overclaim
- **WHEN** the `diagram` description is read
- **THEN** it asks for compact JSON without asserting that non-compact JSON is refused, because it is not

### Requirement: The server is reachable over HTTP
The package SHALL ship an HTTP transport beside the stdio one, holding the
transport and nothing else. Tool and resource behaviour SHALL be identical
across transports: the same factory backs both, and no tool SHALL be able to
observe which transport carried its call.

The purity rule already stated for the three tools is unchanged and unchanged
in meaning. A transport that accepts a socket does not make a tool impure:
the tools remain pure functions of their arguments, reading no network, no
filesystem and no stored state. The server process gaining a listener is the
same category as it gaining a stdin.

#### Scenario: The same call over either transport
- **WHEN** a tool both transports serve is called with identical arguments over stdio and over HTTP
- **THEN** the results are byte-identical, because nothing outside the arguments is read

#### Scenario: A transport file that knows nothing
- **WHEN** the HTTP entry is read
- **THEN** it names no tool, no resource and no geometry, exactly as `stdio.ts` names none

### Requirement: The HTTP transport is served, not deployed
The HTTP entry SHALL bind loopback by default. It carries no authentication of
any kind, so a default that bound a routable address would publish an
unauthenticated endpoint by accident. Binding any other address SHALL require
the operator to say which hostnames the server answers to, and SHALL fail
rather than bind without them: the guard below would otherwise refuse every
request that arrived, which is a dead server that looks like a running one.

Compression is left to whatever fronts it, and that is a packaging decision
rather than a rule: the deployment this entry describes already needs a proxy
for the authentication it does not have, and that proxy compresses.

It SHALL guard against DNS rebinding on every request, and the entry point the
documentation recommends SHALL be one that does. A browser sends a
cross-origin request to `127.0.0.1` on behalf of whatever page the user has
open, so a local endpoint without Host and Origin validation is reachable by
every site that user visits. An unguarded handler MAY be published for a
deployment already behind something that validates, but SHALL NOT be the one
an example reaches for.

#### Scenario: A page the user has open tries the local endpoint
- **WHEN** a request arrives carrying an Origin the server does not serve
- **THEN** it is refused with 403 before any tool runs

#### Scenario: A bind nobody can reach is refused
- **WHEN** the entry is told to bind an address that is not loopback, and no allowed hostnames are given
- **THEN** it throws naming the option, rather than binding a socket that answers 403 to everything

#### Scenario: Compression belongs to whatever is in front
- **WHEN** an operator wants responses compressed
- **THEN** the proxy they already need for authentication does it, rather than the transport spending the event loop on it

### Requirement: A diagram is bounded, on every transport
The tools SHALL refuse a diagram carrying more than a fixed number of nodes,
edges, braces or notes. Those numbers SHALL be set per array from that
array's own measured cost, and SHALL NOT be one number standing for several:
a curved edge is sampled into many chords before each crossing test, so 500
nodes cost 67 ms where 500 bowed edges cost minutes, and a single bound
justified by the cheaper measurement admits the more expensive shape. Several of the checker's rules compare every pair, so
both the time they take and the findings they hold grow with the square, and
both are spent before anything can be returned. Measured worst case: 500
nodes is 118 ms, 2,000 is 1.4 s and 2.9 million findings held in memory, and
8,000 exhausts it.

The bound SHALL apply on stdio as well as HTTP. A bound that held only where
an attacker could reach it would be one this repository never ran against its
own work.

The HTTP entry SHALL also bound the request body it will read, because the
refusal above is downstream of parsing and cannot see a body it has not
finished reading.

#### Scenario: A diagram too big to check
- **WHEN** a diagram carries more of anything than that array's bound allows
- **THEN** it is refused naming the count and the fix, before any rule runs

#### Scenario: The expensive array is bounded on its own terms
- **WHEN** the bound on edges is compared with the bound on nodes
- **THEN** they differ, because the measured cost per item differs by orders, and each carries the measurement it was set from

#### Scenario: A body too big to parse
- **WHEN** a request body exceeds the cap, whether it declares its length or not
- **THEN** it is refused with 413 rather than read into memory

### Requirement: The HTTP entry does not serve the rasterizer
`render_png` SHALL NOT be reachable over HTTP. The rasterizer is synchronous
WebAssembly and holds the event loop for the whole of a raster - 2416 ms
measured on a 1760 x 1000 frame at 2x - so one client's picture is every other
client's latency in a process that serves more than one.

Stdio is unaffected and stays the transport that rasterizes: there each client
owns a process, and the blocking is its own.

#### Scenario: A raster is not on the list over HTTP
- **WHEN** the tools are listed over the HTTP transport
- **THEN** `render_png` is absent, so no caller spends tokens on a description it cannot act on, and a call naming it is refused as an unknown tool

#### Scenario: Stdio keeps every tool
- **WHEN** the tools are listed over stdio
- **THEN** all three are there, `render_png` included

