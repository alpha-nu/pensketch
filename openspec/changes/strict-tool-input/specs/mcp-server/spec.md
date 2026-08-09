# mcp-server — Delta Specification

> A boundary that discards what it does not recognise is worse than one that
> refuses it, because the caller cannot see the result.

## ADDED Requirements

### Requirement: The tool boundary refuses what it cannot carry
Every tool's arguments SHALL be validated strictly: a key the tool does not
declare SHALL be refused, naming that key, rather than accepted and discarded.
This SHALL apply to the diagram argument and to the arguments beside it, and
SHALL include `raw`, which the server does not accept because it holds
functions that JSON cannot carry.

The reason is the audience. A caller that cannot see the rendered result has
only what the server tells it, and silently dropping part of a diagram gives
back a picture that is wrong in a way nothing in the response reveals. It also
contradicts the schema this same server publishes as `pensketch://schema`,
which is generated with `additionalProperties: false` and which callers are
told to validate against.

The schema each tool publishes in its listing SHALL say the same thing, so a
caller validating locally reaches the same verdict the server will.

#### Scenario: The published schema agrees with the boundary
- **WHEN** a client lists the tools and reads a tool's input schema
- **THEN** that schema forbids additional properties, at the top level and on the diagram, rather than admitting a key the server is about to refuse

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
