# Tasks: edge-overlap-sees-a-shared-trunk

A group is done when the verification commands in `CONTRIBUTING.md` are green
and every finding from a self-review of the diff is fixed. Items marked
**OWNER** are performed by the repo owner, never the agent.

## 1. The budget, before the code that needs it

- [ ] 1.1 Prototype the shared-run test far enough to measure it min+gzip on
      `./check` (**64 B** of headroom, 3008/3072) and on `./core` and
      `./server`, which do not carry the checker and should not move at all —
      if either does, the rule has landed in shared code and the prototype is
      wrong. Record every figure in the commit message
- [ ] 1.2 Move the budget the measurement says must move, in its own commit,
      with the arithmetic: measured plus the 100 B of gzip headroom the other
      entries are given. `repo-tooling` names 3072 literally, so its
      requirement is restated with the new number in the same commit

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
