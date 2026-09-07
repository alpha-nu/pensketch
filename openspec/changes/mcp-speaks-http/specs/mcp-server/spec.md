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
- **WHEN** any tool is called with identical arguments over stdio and over HTTP
- **THEN** the results are byte-identical, because nothing outside the arguments is read

#### Scenario: A transport file that knows nothing
- **WHEN** the HTTP entry is read
- **THEN** it names no tool, no resource and no geometry, exactly as `stdio.ts` names none

### Requirement: An expensive call does not block a cheap one
Where one process serves many clients, rasterization SHALL NOT hold the event
loop against unrelated requests. Concurrent `render_png` calls SHALL overlap
rather than serialize.

This is a hosting requirement and not a correctness one: under stdio each
client owns a process and the blocking is its own. It is stated here because
the HTTP transport is what makes it observable by a party that did not ask
for it.

#### Scenario: Concurrency actually overlaps
- **WHEN** N `render_png` calls are made concurrently against one HTTP server
- **THEN** wall clock is materially below N times the single-call median, where today the measured ratio is 1.01x

#### Scenario: A cheap call is not held hostage
- **WHEN** `check_diagram` is called while a multi-second raster is in flight
- **THEN** it returns in its own time rather than after the raster completes

### Requirement: The cost bound predicts the cost
A raster SHALL be refused on a budget that tracks what actually drives raster
time, and SHALL carry a wall-clock ceiling. A bound on the longest side alone
SHALL NOT be the only guard, because it does not predict cost: two requests of
equal pixel count measured 288 ms and 2416 ms.

#### Scenario: Equal pixels, unequal cost
- **WHEN** two requests of near-equal pixel count differ 8x in render time
- **THEN** the bound distinguishes them, rather than admitting both because neither exceeds a side length

#### Scenario: A refusal names the fix
- **WHEN** a request exceeds the budget
- **THEN** the error says what to change, not only that a limit was passed
