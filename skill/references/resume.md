# Resume an issue safely

Trigger: `resume issue ISSUE` or `resume ISSUE`. Do not treat resume as phase 0 and create
a new worktree or duplicate Tasks. Save incremental orchestrator state before 50% context
usage or any long wait, including Run ID, execution host, coordinator identity, worktree,
phase, HEAD/base/criteria/verdict hashes, Task/Dispatch IDs and states, current delivery
manifest, owner-gate receipts, outstanding questions, resource ledger and next actions.
Write a bounded checkpoint under `.orca-run/checkpoints/` and keep original evidence.

1. Locate the existing issue worktree and latest checkpoint. Read config and the installed
   runtime's orchestration guide; apply its context mode. Verify paths, HEAD/base and all
   hashes against the checkpoint. A mismatch invalidates the relevant reviews/approvals;
   recompute from actual state rather than replaying the transcript.
2. Establish the CURRENT caller's runtime identity and compare it with the checkpoint's
   coordinator. Never use another pane's `--from` to impersonate it. If ORCA_TERMINAL_HANDLE
   or the chat identity is unavailable, report the identity blocker; do not secretly fall
   back to an unsupervised worker while claiming native orchestration.
3. Inspect the recorded Run and workers on the exact execution host. Orca 1.4.256 help:

   ```text
   orca orchestration run-show --id <recorded-run-id> --json
   orca orchestration worker-list --run <recorded-run-id> --include-remote --json
   orca orchestration run-use --id <recorded-run-id> --json
   ```

   Use run-use only as the legitimate coordinator and only after understanding the receipt.
   A worker cannot bind its own/ancestor Run. `--takeover-legacy` is NOT a general transfer
   mechanism: use it only when the current runtime explicitly authorizes that recovery.
4. Follow any durable request/recovery actions. Reconcile active, waiting, failed, completed,
   retained and released attempts from runtime evidence. Pending workers still belong to
   their original coordinator unless the runtime confirms an ownership transfer. If a
   fresh conversation cannot acquire that custody, resume in the original coordinator
   surface or stop with the exact blocker; do not duplicate assignments to route around it.
5. Restore inbox/question/gate state using the current guide, not saved message text alone.
   Capture new results once, release eligible settled workers and run the Janitor for
   settled consumers. Resume only ready Tasks and the recorded next phase; preserve all
   existing cancellation/keep-open decisions and circuit-breaker history.

A fresh agent conversation is not proof of a fresh token budget or transferred ownership.
Remeasure context and verify custody before new requests. Prefer handoff at a settled phase
boundary so there are no active writers to overlap. The checkpoint is a resume aid, not a
copyable authorization token, model usage estimate or substitute for a runtime adapter.
