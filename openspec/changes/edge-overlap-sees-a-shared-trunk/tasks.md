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

## 2. The rule

- [ ] 2.1 Calibrate `OVERLAP_MIN` **at both ends**, against the ten diagrams
      this repository ships rather than against intuition. Low enough to catch
      the 58 px pair the showcase had; high enough that every shipped diagram
      stays quiet. Both bounds measured, and the figures in the commit message
- [ ] 2.2 The shared-run test: the longest stretch over which each path stays
      within `2 * INFLATE` of the other, rather than requiring it of the whole
      length. The existing whole-length case SHALL keep firing — an edge and
      its reverse is the pair this rule was written for
- [ ] 2.3 The finding names the shared length in px, so the caller knows how
      much of the picture is lying before deciding which line to move
- [ ] 2.4 Tests: the showcase's four historical pairs are reported, with their
      measured lengths; a crossing is not; a pair sharing only a shared anchor
      is not; an edge and its reverse still is
- [ ] 2.5 Mutation-check: gut the shared-run test and confirm a shared-trunk
      assertion fails. A test that stays green with the primitive removed is
      not evidence — and on the last change one did exactly that

## 3. Against the diagrams that exist

- [ ] 3.1 Run the new rule over all ten shipped diagrams. Every one is believed
      good, so a finding is either a wrong threshold or a defect nobody had
      noticed. Settle which by looking at the render, never by moving the
      number until the gate goes quiet
- [ ] 3.2 `docs/agents.md` and `README.md` where they describe what
      `edge-overlap` catches

## 4. Left for the owner

- [ ] 4.1 **OWNER**: a changeset. `@pensketch/core/check` reports a finding it
      did not before, which is user-visible — a **minor**, and its changeset
      says which diagrams start reporting
