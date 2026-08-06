# mcp-server — Delta Specification

> `@pensketch/mcp`: tools, resources, transports and the guarantees that let
> it be hosted without authentication. Exact shapes: design.md.

## ADDED Requirements

### Requirement: Two tools, both pure
The server SHALL expose `check_diagram` and `render_diagram`. Both SHALL be
pure functions of their arguments: no network access, no filesystem access, no
stored state, no secrets. `check_diagram` SHALL return the checker's findings
plus a count of errors and warnings. `render_diagram` SHALL return SVG text.

#### Scenario: Checking a diagram with a defect
- **WHEN** `check_diagram` is called with a diagram whose nodes overlap
- **THEN** it returns the finding and a non-zero error count

#### Scenario: The same call twice
- **WHEN** either tool is called twice with identical arguments
- **THEN** the results are identical, because nothing outside the arguments is read

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

#### Scenario: A resource cannot drift from its source
- **WHEN** the agent-facing spec file changes and the served resource is not updated
- **THEN** the test comparing them fails

#### Scenario: Examples are served as data
- **WHEN** an example resource is read
- **THEN** it yields a diagram object that `render_diagram` accepts unchanged

### Requirement: Rendering needs no browser
The server SHALL render through a DOM shim implementing only the members core
uses, SHALL NOT depend on jsdom, a browser, or any native module, and its
serialization SHALL match the attribute ordering and escaping of the golden
serializer.

#### Scenario: Renders on a worker runtime
- **WHEN** `render_diagram` runs in an environment with no DOM and no Node built-ins
- **THEN** it returns SVG

#### Scenario: Server output matches browser output
- **WHEN** the same diagram and seed are rendered by the server and in a browser
- **THEN** the two SVG strings are identical

### Requirement: Both transports from one implementation
The server SHALL be runnable over stdio through a published `bin`, so that
`npx @pensketch/mcp` registers in any client that spawns a process, and over
Streamable HTTP as a Cloudflare Worker. Both SHALL be built from one server
factory. Documentation SHALL pin a version in the `npx` invocation and SHALL
state that Node must be on the client's `PATH`.

#### Scenario: Registered in a stdio client
- **WHEN** a client is configured with `npx -y @pensketch/mcp` as the command
- **THEN** the server starts, lists both tools and all resources

#### Scenario: Same surface over HTTP
- **WHEN** the Worker endpoint is used instead
- **THEN** the tools and resources are identical to the stdio server's

### Requirement: The hosted server is unauthenticated, and stays safe to be
The hosted endpoint SHALL require no authentication. This is permitted only
while every tool is pure per the first requirement; a tool that reads the
network, touches a filesystem, holds a secret or keeps state SHALL NOT be
added without changing the hosting decision in the same change.

#### Scenario: Anyone may call it
- **WHEN** a client connects to the hosted endpoint with no credentials
- **THEN** the tools work

#### Scenario: An impure tool forces the question
- **WHEN** a proposed tool would fetch a URL
- **THEN** it cannot ship under this requirement without revisiting authentication

### Requirement: No layout, no generation
The server SHALL NOT expose a tool that produces or repairs a diagram's
coordinates. Automatic layout remains a project non-goal, and the server is
not a way around it.

#### Scenario: Checking, not fixing
- **WHEN** `check_diagram` finds a collision
- **THEN** it reports it, and no tool offers replacement coordinates
