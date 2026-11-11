# Context target, enforcement modes, cache and handoff

The target is 60% of the effective configured model window, including cached input and
reservations for next input, generation/reasoning and tool output. Checkpoint at 50% when
usage is measured. These percentages are policy targets; do not substitute lifetime billed
tokens or model-generated token estimates for current occupancy.

## Explicit mode selection

`context.enforcement` is either `enforced` or `instructed`. The installer asks explicitly;
strict `enforced` remains the default and migration never silently selects instructed mode.

- **enforced:** A verified pre-request runtime adapter is REQUIRED for every worker AND
  the orchestrator. Missing telemetry/adapter is `context_enforcement_unavailable`: stop
  dependent work. No waiver at delivery and no silent model fallback can weaken this rule.
- **instructed:** An owner explicitly selected a bounded-work target WITHOUT a hard runtime
  guarantee. The flow may run using bounded packets, targeted reads, frequent persistent
  checkpoints and fresh sessions. Record "60% target NOT enforced" in 02-capabilities.md,
  the review manifest, BOTH owner gates, final validation and PR. Never report guaranteed
  compliance, zero breaches or a measured peak if telemetry is unavailable. Existing
  enforced configuration does not turn into instructed mode because launch was blocked.

This package installs an admission checker and contracts, NOT universal runtime interception.
The inspected Orca CLI has no universal cap flag. Strict mode becomes usable only after
an execution host supplies an enforcing adapter; instructed mode is a conscious alternative,
not a fix that claims to enforce 60%. The legacy require_measured_usage setting is deprecated:
the explicit enforcement mode governs. A contradictory legacy setting is not an exemption.

## Strict admission contract

Before dispatch, record runtime/model/effort, configured window, measurement source, output
caps and the tested adapter/hook in `.orca-run/02-capabilities.md`. Require the same for
the orchestrator. The adapter must, before EVERY request:

1. Measure all occupied tokens: system, tool schemas, history, image representations and
   cache hits, using runtime telemetry or a tokenizer upper bound covering ALL input.
2. Reserve next input, maximum output/reasoning and maximum aggregate tool results. Large
   outputs stay on disk with bounded previews. `toolsEnabled: false` is required to admit
   a request with zero tool reserve. Otherwise zero tool reserve is denied.
3. Run `node <installed-skill>/scripts/context-guard.mjs <sample.json>` and deny submission
   on exit 2. Bind sample sessionId/requestId to that exact payload, reject replay and
   remeasure after tools or compaction. Samples expire after 60 seconds. The checker is
   stateless; identity binding/replay protection belongs to the adapter.
4. At 50% projected use, persist a bounded checkpoint and start no new work in that session.
   Before projected use exceeds 60%, deny the request and replace the session. If closure
   itself does not fit, use the last incremental checkpoint instead of another model call.
   Already occupied >=60% is a breach: report it and submit no further request.

Example (refresh IDs/time for the actual request):

```json
{
  "sessionId": "runtime-session-id",
  "requestId": "unique-request-id",
  "measurement": "runtime",
  "measuredAt": "2026-11-11T12:00:00Z",
  "effectiveWindowTokens": 200000,
  "occupiedTokens": 70000,
  "nextInputTokens": 3000,
  "reservedOutputTokens": 8000,
  "reservedToolTokens": 4000,
  "toolsEnabled": true
}
```

## Bounded work and resume

Give each task a small criteria/verdict packet, role scope, exact revision and file index,
not an entire conversation. Default packet budget is 12k tokens and tool output 4k; reduce
further for smaller windows. Every agent, including Reader/Janitor, persists progress and
source references incrementally. Readers chunk logs with original line offsets.

Checkpoints include HEAD/hashes, completed work, open finding IDs, commands/results,
pending Task/Dispatch/gates and exact next actions. Follow [resume.md](resume.md) for an
orchestrator handoff: a new conversation does not automatically inherit coordinator custody.
Only one implementer writes at a time; a replacement waits for proven predecessor exit.
Compaction is not proof of a fresh window: remeasure. Reviews may carry only through the
explicit unaffected-scope attestation in [review-validity.md](review-validity.md); product,
criteria or plan changes never inherit approvals implicitly.

## Cache strategy

Keep a byte-stable prefix of role rules, conventions and immutable issue criteria, then
versioned verdict/context, then changing diffs/findings. Keep task IDs/timestamps out of
that prefix. Partition caches by provider/model and confidentiality boundary; never expose
one planner's private report to another for cache reuse.

Use only runtime-supported caching mechanisms, never API-only flags invented for Orca.
Measure cache read/write usage and actual cost when exposed. Short tasks may not amortize
cache writes, TTL/provider pricing varies, and a CLI may manage caching internally. Cache
saves repeated processing, NOT occupied tokens; fresh sessions/bounded retrieval control
occupancy. Reference: [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
