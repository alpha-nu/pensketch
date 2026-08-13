# Tasks: edge-overlap-sees-a-shared-trunk

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

## 1. The budget, before the code that needs it

- [x] 1.1 Prototype the shared-run test far enough to measure it min+gzip on
      `./check` (**64 B** of headroom, 3008/3072) and on `./core` and
      `./server`, which do not carry the checker and should not move at all —
      if either does, the rule has landed in shared code and the prototype is
      wrong. Record every figure in the commit message

      Built, measured from a cold tree, then reverted. `./check` **3008 →
      3161**, so **+153**, taking the shared run as `max(run(a,b), run(b,a))`;
      one direction only measured **3152**, so the symmetry costs **9 B** and
      was kept. The root entry **4179 → 4179** and `./server` **4196 → 4196**,
      neither moving a byte, which is the diagnostic this task asks for. Run
      against the historical showcase the prototype reports all four pairs —
      84, 62, 62 and 74 px against the 76, 58, 58 and 70 measured by hand.

      The prototype walked each segment at a sub-sampling step of **4 px**,
      adding one step per sample that lay within `2 * INFLATE` of the other
      path, so a reported run is quantised to that step and the four overshoots
      are one step, one, one and two. That is recorded as an observation and
      not explained. The `2 * INFLATE` band alone does not account for it: the
      band keeps counting until a parting path is 4.2 px clear, which is *at
      least* 4.2 px per parting end and unboundedly more as the parting angle
      narrows — so it predicts overshoots larger than these, not smaller, and
      three of the four sit below its floor. 2.1 has to separate the step from
      the band before it can place `OVERLAP_MIN` against a 58 px target, since
      an error of the order of the step is not small next to it. A coincident
      pair reports its whole length, so the case 2.2 protects still fires
- [x] 1.2 Move the budget the measurement says must move, in its own commit,
      with the arithmetic: measured plus the 100 B of gzip headroom the other
      entries are given. `repo-tooling` names 3072 literally, so its
      requirement is restated with the new number in the same commit

      3161 + 100 = 3261, taken up to **3264**. Moved in the three files that
      own the figure — `tools/check-size.mjs`, `CONTRIBUTING.md`, and the
      `repo-tooling` delta — and in no others; `openspec/specs/` is written at
      archive time, not now

      **Moved a second time, to 3392**, because 3264 measured the wrong rule.
      The prototype behind it replaced the whole-length test; the spec keeps
      both, and the existing tests proved why — see 2.2. The rule as built
      measures **3287**, so +279 rather than +153, and 3287 + 100 = 3387 taken
      up to **3392**. Raised in its own commit with the rule still out of the
      tree, not at the gate it failed

## 2. The rule

- [x] 2.1 Calibrate `OVERLAP_MIN` **at both ends**, against the ten diagrams
      this repository ships rather than against intuition. Low enough to catch
      the 58 px pair the showcase had; high enough that every shipped diagram
      stays quiet. Both bounds measured, and the figures in the commit message

      **40.** Both bounds measured by running the rule at a threshold of 1 over
      every shipped diagram and over the showcase's historical geometry. Below:
      the longest run any of them draws deliberately is `incident`'s fork at
      **24** — 20 px of trunk, and its own source already said so — with every
      other shipped run a fan-out artefact of 10 or less. Above: the shortest
      real defect is the showcase's `mcp` trunk at **62**. Nothing in this
      repository lands between 24 and 62, so the number separates two
      populations rather than splitting one, and 40 sits near the middle of an
      empty band. `OVERLAP_STEP` settled at **4** the same way: rebuilt at 8,
      4, 2, 1, 0.5 and 0.25, every pair is stable from 2 down, 4 is within 4 px
      of converged, and **8 is not merely coarse but wrong** — it steps over
      six pairs the finer walks report, three of them in the showcase as it
      ships today
- [x] 2.2 The shared-run test: the longest stretch over which each path stays
      within `2 * INFLATE` of the other, rather than requiring it of the whole
      length. The existing whole-length case SHALL keep firing — an edge and
      its reverse is the pair this rule was written for

      Kept, and the whole-length test kept with it rather than replaced — which
      the existing tests, not the spec on paper, are what forced. An unguarded
      run test reports a pair bowed 5 px apart as a **93 px** run and needs a
      bow of about **20** before it goes quiet, against a separation this
      repository had already measured at 4 firing and 5 not: the rule would
      name `bow` as the fix and then reject the fix. It also reported a short
      edge lying inside a longer one, kept quiet on purpose. Both are solved by
      one guard — the run is measured only for a pair sharing **exactly one
      end**, the trunk two connectors leave or arrive on together. Sharing both
      is the shape `bow` exists for and the whole-length test still governs it;
      sharing neither is a connector drawn past something, not along it. All
      364 pre-existing tests pass with no fixture edited
- [x] 2.3 The finding names the shared length in px, so the caller knows how
      much of the picture is lying before deciding which line to move

      `drawn along one another for about N px`. "About", because the run is
      quantised to `OVERLAP_STEP` and the proximity band adds about 4 px: a
      20 px trunk reports as 24. The whole-length case keeps its old wording
      exactly, so no existing message assertion moved
- [x] 2.4 Tests: the showcase's four historical pairs are reported, with their
      measured lengths; a crossing is not; a pair sharing only a shared anchor
      is not; an edge and its reverse still is

      Three added, 367 passing. The four historical pairs are asserted at 84,
      62, 62 and 74 against the 76, 58, 58 and 70 a ruler gives. Crossing,
      shared anchor, edge-and-reverse, bow 4 vs 5, and the short-edge-inside
      case were all already covered and all still pass untouched
- [x] 2.5 Mutation-check: gut the shared-run test and confirm a shared-trunk
      assertion fails. A test that stays green with the primitive removed is
      not evidence — and on the last change one did exactly that

      Three mutations, each caught by the tests that should catch it. Gutting
      the run accumulation fails **3**. Gutting the one-shared-end guard fails
      **4**, including the bow-5 and short-edge-inside cases it exists for.
      Dropping `OVERLAP_MIN` to 1 fails **5**, three of them the shipped
      diagrams themselves — so the lower bound is held by the repository's own
      pictures rather than by an assertion.

      It caught a worthless test of mine first time round: the fork-under-the-
      threshold case asserts silence, so it stayed green with the run gutted.
      It now carries a control at the same anchors with the corner moved past
      the threshold, and the pair of them holds the number rather than the
      geometry

## 3. Against the diagrams that exist

- [x] 3.1 Run the new rule over all ten shipped diagrams. Every one is believed
      good, so a finding is either a wrong threshold or a defect nobody had
      noticed. Settle which by looking at the render, never by moving the
      number until the gate goes quiet

      `npm run diagrams`: **0 errors, 0 warnings across 10 diagrams**. Nothing
      needed adjudicating, because the calibration in 2.1 was derived from
      these diagrams rather than checked against them afterwards — the one run
      that came close, `incident`'s 24 px fork, is documented as deliberate in
      its own source and is what the threshold was set above
- [x] 3.2 `docs/agents.md` and `README.md` where they describe what
      `edge-overlap` catches

      Four places, not two. Both rule tables said "the whole way", and
      `docs/agents.md` and `examples/react/src/incident.ts` each carried a
      comment explaining that `check` misses the fork — the sentence that
      raised this change, now false. `packages/mcp/src/resources.generated.ts`
      follows `docs/agents.md`, regenerated with `schema` before `resources`

## 4. Left for the owner

- [ ] 4.1 **OWNER**: a changeset. `@pensketch/core/check` reports a finding it
      did not before, which is user-visible — a **minor**, and its changeset
      says which diagrams start reporting
