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
edges, braces or notes. Several of the checker's rules compare every pair, so
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
- **WHEN** a diagram carries more of anything than the bound allows
- **THEN** it is refused naming the count and the fix, before any rule runs

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
