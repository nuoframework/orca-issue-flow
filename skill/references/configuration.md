# `.orca-flow.yml` reference

Written by `npx orca-issue-flow`, then edited by hand. The skill reads it at the start of
every run and stops if it is missing.

## Repository

| Key | Meaning |
|---|---|
| `base_branch` | Remote ref every issue worktree is cut from, e.g. `origin/beta`. Also the diff base for reviewers. |
| `pr_base` | Branch the PR targets — usually `base_branch` without the remote. |
| `branch_prefix` | Used when the tracker does not supply a branch name. |
| `conventions_files` | Files carrying the project's rules. Every worker is told to read them first. Put your invariants here, not in the prompts. |
| `docs_dirs` | Read for context in phase 1, checked again in phase 9. |
| `changelog` | Path, or `null` if the project has none. |

## Orchestrator

```yaml
orchestrator: a capable model for coordination and evidence synthesis
```

A note to yourself, not a launcher: the orchestrator is whatever session you run the skill
from, so no config can start it. The skill reads this at step 0 and says something once if
you are driving twelve phases of dispatch and synthesis from a small model.

It sits up here rather than with the roster, so `npx orca-issue-flow roles` never
overwrites it. Changing packs prints what the new one would suggest and leaves your line
alone.

## Language

```yaml
language: Spanish
```

Governs everything the owner reads: the acceptance criteria, the plain-language summary at
the plan gate, both gate questions, the findings the orchestrator relays and the final
validation.

It governs nothing else, and the distinction is load-bearing. Code, identifiers, code
comments, commit messages, branch names and the PR title and body follow the repo's own
convention — which is usually English even on a team that does not work in it. A Spanish
commit message in an English codebase is a regression that outlives the run.

## Gates

| Key | Meaning |
|---|---|
| `verify.command` | Must be green before review and again before the PR. A red gate stops the flow — it never reviews broken code. |
| `verify.ui_command` | Additional command when the diff touches UI. `null` to skip. |

Make `verify.command` the same thing CI runs. The point of the gate is that the machine,
not a model, decides whether the work compiles and passes.

## Context routing and explicit enforcement mode

```yaml
context:
  enforcement: enforced       # strict default; requires a real adapter
  max_window_percent: 60
  handoff_at_percent: 50
  max_tool_output_tokens: 4000
  max_packet_tokens: 12000
  digest_gate_logs_over: 200
  raw_log_after_rounds: 2
```

The installer explicitly offers enforced or instructed. Enforced blocks unsupported runtimes;
instructed is an owner-selected target WITHOUT a 60% guarantee, disclosed at both gates,
validation and PR. Migration defaults enforced and never silently relaxes it. The legacy
require_measured_usage field is deprecated; the explicit mode governs. See [context.md](context.md)
for measurements, cache accounting, reservations and checkpoint semantics.

Line routing can be disabled with digest_gate_logs_over:0, but read/tool budgets still
apply. After raw_log_after_rounds, request targeted raw excerpts with original line ranges,
never inject the full log. Original logs stay on disk. The Reader obeys the same context mode.

## Tracker

| Key | Meaning |
|---|---|
| `tracker` | `linear`, `github` or `none`. Chooses how the issue is read and closed out. |
| `issue_prefix` | Key prefix, e.g. `IDL` for `IDL-86`. `null` when there is none. |

With `none`, the orchestrator takes the brief from the chat and skips phase 12.

## Review policy

| Key | Meaning |
|---|---|
| `deep_review_paths` | Legacy key retained: matching paths now force all seven specialists; each irrelevant area must justify N/A. |
| `deep_review_lines` | Changed-line threshold that also forces all specialists. |
| `adversarial_topics` | Expand the threat matrix; adversarial review always runs. |
| `max_review_rounds` | Fix rounds before escalation with unresolved evidence. |
| `review_policy.family_policy` | `native_priority`: Claude/Codex preferred; planner separation and opposite-family security/final gates required. Other overlaps are recorded, with fresh blind sessions. |
| `review_policy.mode` | `critical_specialists`; independent critics, adjudication, final attack. |
| `review_policy.adversarial` | `always`; cannot be waived by the judge. |
| `review_policy.execution` | `sequential` = one by one; `parallel` = all applicable specialists; `batched` = bounded groups, the default. Final critics keep their dependencies. |
| `review_policy.max_parallel` | Batch size only for `batched`, default 3. Rendered as 1 for sequential and null for all-at-once. |
| `review_policy.require_evidence` | `true`; no speculative blockers or unverified approve verdicts. |

Security, architecture, tests and QA are mandatory. UI, performance and documentation are
selected by actual scope. Every decision is recorded in the review manifest. All reports
refer to the exact reviewed SHA; fixes invalidate affected reports and both final sign-offs.
Missing mandatory coverage means incomplete. [review-validity.md](review-validity.md)
defines explicit unaffected-scope carries and named, revision-bound owner_accepted risks.
These never relabel coverage as tested or waive red gates/strict admission.

## Roles and packs

`npx orca-issue-flow roles` replaces only the roles YAML mapping, preserving surrounding
bytes/comments and any settings after it. It refuses an outdated installed skill/config;
run upgrade first. Every generated reserve is checked against the primary roster, and the
runtime rechecks actual agent choices after fallback. See [the dated model rationale](models.md).

| Pack | Difference |
|---|---|
| Budget | Low-effort Terra for Plan B/implementation on small reversible work; critical reviewers unchanged. |
| Balanced | Cost-aware native roles: Terra implementer, lighter specialist models, Opus for judge/security; OpenCode economy reserve. |
| Frontier | Sol planning/implementation and Opus documentation review. |

```yaml
roles:
  plan_a:
    label: Plan A
    launch: orca orchestration worker-start --agent claude --model claude-sonnet-5-5 --effort medium
    fallback: orca orchestration worker-start --agent claude --model claude-opus-5-5 --effort medium
    fallback_2: orca orchestration worker-start --agent claude --model claude-haiku-5-5 --effort medium
```

All defaults use supervised workers. Append `--task`, `--worktree` and `--json`; provide
multiline specs through files. Orca 1.4.253 supports OpenCode model selection in an existing
worktree when the execution host's verified CLI exposes that model. No OpenCode effort
flag is supported. Balanced planning, implementation and substantive critics use medium; UI, documentation,
QA execution and Reader use low. Native reserves follow the same role-level effort. No pack
uses high/xhigh/max by default. These choices prioritize practical cost/latency; the captured
AA effort-specific results are historical evidence, not measured scores for this new setup.
The reader uses Codex Luna low, then Haiku low or OpenCode GLM Flash.
Codex and Grok now accept explicit models and effort through worker-start. Verify model
access on the execution host; the presence of a CLI does not grant every listed model.

`launch`, `fallback`, `fallback_2` are an ordered three-choice chain. The wizard and role
reconfiguration write all three, including pack overrides and custom primaries. Try each
at most once after preflight; skip unsupported, unauthenticated, quota-exhausted or
independence-breaking candidates with a recorded reason. Stop when no eligible choice
remains. Unknown launch outcomes require Orca recovery before another attempt. A null
legacy fallback means no candidate in that position. A CLI switch may share the same
provider quota: do not treat it as guaranteed availability.

### Janitor and cleanup

`roles.janitor` is a non-voting service role, default Haiku 5.5 low, with Luna low and an
OpenCode GLM Flash reserve. The coordinator invokes it after phase completion and on run
exit, including failure/cancellation and long approval waits. Read [cleanup.md](cleanup.md).

```yaml
cleanup:
  enabled: true
  after_each_phase: true
  on_run_exit: true
  remove_volumes: false
```

Only resource identities registered as created by this Run and corroborated by live
observations are eligible. Preserve still-consumed fixtures, user-kept workers and unknown
processes. Settled worker release stays with the coordinator's custody; the Janitor reports
action candidates. No global prune, bulk kill or volume deletion. Logs retain proof and
unresolved leftovers; accepted cleanup commands are not proof of cleanup.

### Choosing review execution

```yaml
review_policy:
  execution: sequential  # or parallel (all at once), or batched
  max_parallel: 3        # used only with batched
```

The installer asks for this mode and the batch size when relevant. Sequential critics
still write blind initial reports. Parallel starts all applicable specialists, so resource
usage and provider concurrency can be higher; it does not skip the later adjudication and
adversarial dependencies. `scripts/review-batches.mjs` validates and expands the 8a schedule.

### Reader

`roles.reader` extracts failures verbatim with repo stack frames and original log ranges.
It has no review vote and may share any model family. Default: Codex GPT-6 Luna, low effort; reserves are Claude Haiku 5.5 low and OpenCode GLM-5.3-Flash with runtime-default effort.
Do not send it all logs at once merely because it advertises a large window.

### Independence and native preference

OpenCode is now an allowed economy implementation reserve as well as docs/log/cleanup
support. The default implementation is native Codex Terra medium; stronger Sol is the
repair route for difficult steps. See [prices and model decisions](models.md).

Plan A/B must use different families. Security and final adjudication must differ from the
actual implementer. The judge, gap hunter, other specialists and adversarial reserves may
share a family under native_priority; record the overlap and keep fresh sessions, initially
hidden reports, and reproducible counterexamples. Hide plan author/model labels from the
judge's packet. The wizard reports these correlation notes without asking the owner to
reapprove an already requested native preference. Unknown families and violated closure
rules still require correction. Three distinct model/CLI options do not promise three
independent vendors or independent quotas.

### Upgrade and migration (schema 2 / package 0.2.0)

```bash
npx orca-issue-flow upgrade
npx orca-issue-flow roles
```

Upgrade backs up the original config and installed skill folders under .orca-run/upgrade-*,
then updates the skill and adds missing schema fields while preserving existing values,
unknown keys and YAML comments. It finds recorded skill_directories and existing .agents/
.claude installations. For a custom directory use `upgrade --skills-path <directory>`; this ADDS that location
and also updates all recorded/detected installations. Existing path strings, absolute
paths and comments are preserved, never replaced by a filtered single-target list.
`upgrade --skill-only` refreshes files without changing config bytes; it is not a schema
migration. It cannot be combined with --context-mode.

Existing legacy role keys are preserved but ignored, and reported with launcher/migration
warnings. Incompatible/unverifiable preserved roster commands set roles.__requires_review,
a blocking marker checked before starting a Run. Existing custom launch commands are not
silently replaced. Repick roles after
upgrade to create three verified compatible choices. Runtime preflight still verifies auth,
actual family selection, tools and strict adapters; schema migration is not a runtime test.

`upgrade --context-mode instructed` is an explicit owner mode change, never automatic.
Without that option a missing mode becomes enforced. A known conflicting legacy value is
preserved and reported, not treated as a waiver. Do not use init to migrate hand-edited
configuration: init intentionally regenerates it. Never delete old data to route around a
migration error; upgrade keeps backups and rolls skill folders back if applying it fails.

For interrupted runs, use `resume issue ISSUE` and [resume.md](resume.md), not a new issue
run. Actual coordinator custody and review/approval hashes must be reconciled first.
