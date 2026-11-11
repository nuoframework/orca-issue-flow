# Revision-bound reviews and owner decisions

Each report records role, reviewedHead, criteriaHash, verdictHash (the approved plan),
coverageComplete, verdict, and its concrete file/dependency scope. The manifest selects
one authoritative report per role. File lists are resolved paths, not unexpanded globs. Equivalent ./ paths are normalized;
directory prefixes conservatively overlap descendants. Empty/root/traversal paths and
trailing slashes are rejected, and conflicting duplicate role/revision reports block delivery.

## After a fix

Run deterministic gates at the new HEAD. Rerun any critic with findings or whose files or
dependencies changed. If dependency impact is unknown, rerun all relevant critics.
Adjudication and adversarial review always rerun after product edits.

An unchanged-scope report may be carried only with a NEW attestation by that reviewer or
the adjudicator. Preserve the original report and SHA; never rename it as if it reviewed
the new commit. Record in the manifest:

- fromHead and toHead; unchanged criteriaHash/verdictHash;
- all paths in `git diff --name-status -z <from> <to>`, including both sides of renames;
- original concrete `scope.files`, `scope.dependencies` and `scope.complete: true`;
- `diffEvidence` path and `attestation: {by, evidence, reason}` explaining why the scope is
  unaffected. Missing dependency knowledge means no carry, even if filenames look unrelated.

`scripts/review-state.mjs` exports `carryReview` to validate these records. The attestation
is evidence supplied by an accountable actor, not an authenticated signature or automatic
dependency analysis. No carry for review_final/review_adversarial, changed criteria/plan,
changed scoped paths, incomplete reports or missing evidence. Direct reports and valid
carry attestations together establish coverage for final HEAD. A later change needs a new
attestation from the originally reviewed SHA or a new report, never an implicit chain.

## Disputed findings and missing coverage

The ledger retains stable IDs, severity, author, trigger/evidence and disposition:
open, disputed, fixed, refuted, or owner_accepted. Fixed/refuted needs evidence revalidated
at final HEAD. A reviewer cannot close its own objection by majority vote or confidence.

After max_review_rounds, present the remaining evidence and let the owner choose: request
a focused fix, cancel, or accept SPECIFIC named findings/coverage gaps. Phase 9 may produce
`needs_owner_decision`; that is permitted to reach delivery gate 2 as a decision request,
not as green verification. Do not push while the decision is pending.

Owner acceptance must name finding IDs and/or `coverage:<role>`, exact HEAD, criteriaHash,
verdictHash, reason and source of the owner's explicit message/gate receipt. A generic
"approve" without the listed exceptions does not accept unresolved risks. The coordinator
captures this receipt; a worker's claimed owner approval is not sufficient. Re-run the
state check after recording the decision. Mark accepted issues owner_accepted and show
`ready_with_accepted_risks` in the delivery summary/PR; never relabel them fixed or tested.
Changed HEAD, criteria or plan invalidates that acceptance. Acceptance is not automatic
permission for unrelated follow-ups, scope expansion or merge.

Red deterministic gates, missing current revision evidence and unavailable/breached STRICT
context admission remain blocking. The owner cannot waive them via a finding disposition.
Changing context mode requires the explicit configured opt-in described in context.md,
recorded before a new run/resume, not silently at delivery.

## Machine-readable final check

`scripts/review-state.mjs` accepts a JSON object with head, criteriaHash, verdictHash,
verifyGreen, gateEvidence, context, requiredRoles, reports, findings and optional
ownerAcceptance. Reports use the fields above plus an optional `carry` object. Findings
use id, severity, status, evidence and resolvedAtHead. The current context records either
`{enforcement: "enforced", adapterVerified: true, breaches: 0}` or
`{enforcement: "instructed", explicitOptIn: true, disclosed: true}`.

Results: blocked, needs_owner_decision, ready, or ready_with_accepted_risks. CLI exit 0 is
only returned for the last two states. This validates the ledger supplied by the caller;
it does not run tests, authenticate an owner's identity or intercept runtime model calls.
