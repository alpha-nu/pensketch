# mcp-server — Delta Specification

## ADDED Requirements

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
The HTTP entry SHALL bind loopback by default and SHALL NOT compress its own
responses. It carries no authentication of any kind, so a default that bound
a routable address would publish an unauthenticated endpoint by accident, and
the proxy that a deployment therefore has to put in front of it is the thing
that already compresses.

It SHALL guard against DNS rebinding on every request. A browser sends a
cross-origin request to `127.0.0.1` on behalf of whatever page the user has
open, so a local endpoint without Host and Origin validation is reachable by
every site that user visits.

#### Scenario: A page the user has open tries the local endpoint
- **WHEN** a request arrives carrying an Origin the server does not serve
- **THEN** it is refused with 403 before any tool runs

#### Scenario: Compression belongs to whatever is in front
- **WHEN** an operator wants responses compressed
- **THEN** the proxy they already need for authentication does it, rather than the transport spending the event loop on it

### Requirement: The HTTP entry does not serve the rasterizer
`render_png` SHALL NOT be reachable over HTTP. The rasterizer is synchronous
WebAssembly and holds the event loop for the whole of a raster - 2416 ms
measured on a 1760 x 1000 frame at 2x - so one client's picture is every other
client's latency in a process that serves more than one.

Stdio is unaffected and stays the transport that rasterizes: there each client
owns a process, and the blocking is its own.

#### Scenario: A raster asked for over HTTP
- **WHEN** `render_png` is called over the HTTP transport
- **THEN** it is refused, naming stdio as the transport that serves it, rather than served slowly

#### Scenario: Stdio keeps every tool
- **WHEN** the tools are listed over stdio
- **THEN** all three are there, `render_png` included
