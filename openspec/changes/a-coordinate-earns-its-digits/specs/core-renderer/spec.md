# core-renderer — Delta Specification

## MODIFIED Requirements

### Requirement: Rendering is deterministic by contract
Given the same package version, diagram, seed, and theme, `draw()` SHALL
produce byte-identical serialized SVG on every call and on every machine
running a given JavaScript engine. Cross-engine identity is not claimed:
trigonometric results reach the emitted coordinates directly and ECMAScript
leaves them implementation-approximated. Package source SHALL NOT call
`Math.random`,
`Date`, timers, or locale-dependent APIs; all randomness SHALL flow from the
seeded `mulberry32` PRNG, and the order of PRNG consumption is part of the
public contract — reordering draw operations is a visual change even when
output looks the same.

Every number the renderer writes into markup — path data and numeric
attribute values alike — SHALL carry at most two decimal places, rounded as
the last act before writing. Geometry SHALL be computed at full precision
throughout: anchors, the checker's measurements, and the hand-order ranking
never see a rounded value, and no PRNG draw is added, removed, or reordered
by the round. The bound is two decimals because 0.005 viewBox units is 0.4%
of the smallest deliberate jitter amplitude and 0.02 device pixels at the
raster boundary's largest scale, while the digits past it are measured at
roughly 40% of a typical render's bytes. IEEE-754 representation noise
SHALL NOT reach the markup: a width computed as `1.2000000000000002` is
written `1.2`.

#### Scenario: Same seed, same bytes
- **WHEN** the same diagram is drawn twice into two fresh `<svg>` elements with the same seed and theme
- **THEN** the two serializations are byte-identical

#### Scenario: Different seed, different wobble
- **WHEN** the same diagram is drawn with seed 7 and seed 8
- **THEN** the serializations differ (the wobble moved), while node positions and text content are unchanged

#### Scenario: A written number owes the file its brevity
- **WHEN** any fixture is rendered and every number in its serialization — path data and attribute values — is inspected
- **THEN** none carries more than two decimal places

#### Scenario: Float noise never reaches the markup
- **WHEN** a stroke's second pass is rendered, whose width is `WIDTH * PASS2_W` and computes to `1.2000000000000002`
- **THEN** the written attribute is `stroke-width="1.2"`
