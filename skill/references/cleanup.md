# Run-scoped environment cleanup

The cheap `roles.janitor` service runs at phase boundaries, before long owner waits and
on run exit, including failure/cancellation. Respect cleanup.enabled, after_each_phase and
on_run_exit. It inventories and cleans only proven ephemeral run resources. It never
edits product code, resets coordination, prunes globally, deletes volumes/worktrees, kills
by process name/PID alone, or closes user-kept work. This is a skill workflow with a
collector/planner, not a continuously running cleanup daemon.

## Register resources at creation

Use a unique Run ID and preserve creation receipts in per-worker
`.orca-run/resources.d/<role>-<dispatch>.json`; the coordinator merges the ledger, avoiding
concurrent appends. Every resource has kind, immutable id, execution host, ownerRunId,
createdByRun:true, creationReceipt, ephemeral:true, keepOpen:false, all consuming Task IDs,
and retainUntilRunEnd:false (or true for resources intentionally kept through final review).
Unregistered/unlabelled older resources are reported, not adopted by name and deleted.

- **Containers:** Create with BOTH labels `dev.orca.issue-flow.run=<run-id>` and
  `dev.orca.issue-flow.keep=false`. Record the full 64-character ID returned by Docker.
  To preserve for the owner, set the ledger's keepOpen or update the keep label; never
  assume a missing label means disposable. Volumes/data are not removed automatically.
- **Workers:** Record exact Task/Dispatch/Run, host and coordinator custody from Orca's
  receipt. Do not use --keep-open for temporary critics; preserve user-taken-over sessions.
- **Processes:** Use an exact registered supervisor/job handle and start identity. There
  is no portable built-in collector for arbitrary unmanaged processes. A supervisor adapter
  may supply verified observations; otherwise retain/report them, never synthesize proof
  from a PID or matching name.

A resource can be considered for cleanup only after ALL consuming Tasks have settled and
its retention boundary has passed. Shared fixtures in parallel reviews remain while any
consumer is active. Preview resources retained by the owner are not cleanup failures.

## Deterministic collection, not model-transcribed runtime fields

Use `scripts/collect-observations.mjs` on the VERIFIED execution host. Split the ledger
into batches of at most 3 local container/worker records so probes cannot expire while a
large inventory is collected. Keep the same runId, settledTasks and finalizeRun for a
batch. Collect and plan in one invocation, writing the output to the run log:

```text
node <installed-skill>/scripts/collect-observations.mjs <batch.json> --host <exact-host-id> --plan
```

Without --plan it returns the observed batch for inspection. Collection is read-only and
uses execFile/spawn arguments, not interpolated shell commands. It queries only records
whose host matches the explicit host; it does NOT route to that host remotely. Execute
from that host's trusted context; never relabel local Docker state as remote evidence.

The collector runs `docker container inspect <full-id>` and records only facts Docker
actually returns: id, state, run label, keep label, exists and probe time. It never invents
observed.ownerRunId. A missing container produces `{id,host,exists:false,source:
"docker-inspect",measuredAt}` with no fictional labels/keep state. A daemon connection
failure is an error, not absence. Unknown/malformed responses fail closed. Ledger ownership
and creation proof remain required; confirmed absence alone does not prove prior ownership.

For workers the collector runs `orca orchestration worker-show --dispatch <id> --json
--full` and retains the native record. A successful exact query plus settled consumers
produces only `request_guarded_worker_release`, NOT an invented releaseEligible flag or
proof that the session is disposable. The CURRENT coordinator runs the native guarded
release, which owns custody/keep-open/state checks. Never translate a refusal into terminal
close. If an older integration supplies normalized observations, source/proof and freshness
are checked conservatively; explicit retained/pending/unknown release overrides eligibility.

For registered supervised processes, retain a verified supervisor observation with the
same handle/start identity; cleanup-plan refuses raw PID-only observations. Missing adapter
means retained, not "cleaned". Do not let an LLM fabricate a runtime observation to pass
these checks. The collector cannot authenticate a forged ledger or caller host claim;
creation receipts and actual command execution remain part of the coordinator's evidence.

## Execute and verify exact actions

Before each mutation, recheck identity, ownership labels, consumers and preservation intent:

- Janitor: gracefully stop an eligible running container, wait for exit, inspect again,
  then remove that exact container WITHOUT --volumes. Already exited/created/dead eligible
  containers can be removed directly. Unknown/removing states are retained/re-observed.
  Command acceptance is not proof of stop. No Docker/system/volume prune or broad Compose down.
- Coordinator: `orca orchestration worker-release --dispatch <exact-id> --json`, following
  current version-matched recovery guidance and receipt actions. An active, user-kept or
  unproven worker must be refused/preserved; the Janitor cannot take sibling custody.
  Account for retained/release_pending/release_unknown separately. Re-observe once after
  failure or ambiguity and report; do not repeat blindly or widen the scope.
- Janitor: stop registered supervised processes only through their exact supervisor
  handle, recheck start identity and confirm exit. Never fall back to bulk/raw PID killing.

No automatic cancellation of active/unsettled workers, including human permission waits.
Explicit cancellation of an exact owned assignment uses the coordinator and current Orca
recovery procedure, preserving circuit-breaker/keep-open decisions. Silence is not authority.

Write `61-cleanup-<checkpoint>.md`: host/id, before/after proof, proposed/executed actions,
confirmed completed resources, retained resources/reasons and failures. The planner's
completed output needs fresh absence/release/exit evidence. Do not convert requested
release or accepted stop into completed status. After worker_done, the coordinator also
releases the settled Janitor and records the receipt; it never kills its own coordinator.
Preserve receipts/logs/checkpoints. Cleanup errors do not overwrite the original task failure.

The context policy applies to the Janitor: enforced mode requires the adapter; instructed
mode uses bounded inventories and explicitly reports that the target is not guaranteed.
