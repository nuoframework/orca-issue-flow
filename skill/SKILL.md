---
name: orca-issue-flow
description: >-
  Orchestrate a single code issue end to end inside Orca with a panel of AI agents:
  context and acceptance criteria → two independent plans in parallel → gap hunter →
  judge that merges them into one final plan → human approval → implementation →
  deterministic gates → tiered review → final validation → human approval → push and PR →
  tracker close-out. Two human gates, GitHub read-only until the very end. Use when the
  owner says "run issue ABC-123", "start ABC-123", "$orca-issue-flow ABC-123", or asks to
  run the multi-agent flow on an issue.
---

# Orca issue flow (orchestrator)

You are the **orchestrator**. You do not write product code. You gather context, hand out
work, wait for results, synthesise them, and ask the owner for the two approvals. Worker
prompt templates live in `references/prompts.md`. Project-specific values (base branch,
verify command, tracker, review triggers) come from the config file — see
`references/configuration.md`.

Non-negotiable rules:

1. **Two human gates**: the plan (phase 5) and the delivery (phase 10). No implementation
   and no push without an explicit OK from the owner.
2. **GitHub is read-only until phase 11**: `gh pr list|view|checks|diff`, `gh issue view`,
   `gh api` GET only, `gh run view`. No `gh pr create/merge/comment`, no `git push`.
3. **All workers share the issue worktree.** Only the implementer edits product files.
   Plans, gaps, verdict and reviews are written to `.orca-run/` (git-ignored) inside it.
4. **No customer data and no secrets** leave the machine towards web-search or docs tools.
5. Each worker reports with `worker_done` (Orca injects the preamble). You wait with
   `check --wait`, process the whole batch, release the terminal, and only then `--ack`.
6. If a model returns "at capacity" or "usage limit", relaunch that task with the standby
   listed in the model table. Do not retry in a loop.

## Step 0 · Load the config

Read `.orca-flow.yml` at the repo root. It defines `base_branch`, `verify`,
`conventions_files`, `tracker`, the review policy and the `roles` roster. If it is missing,
**stop and tell the owner** to run `npx orca-issue-flow` — do not guess these values.

Throughout, `ISSUE` is the issue key (`ABC-123`), `<base>` is `config.base_branch`,
`<verify>` is `config.verify.command`, and `<launch:role>` is `config.roles.<role>.launch`.

## Before you start

```bash
orca status --json                      # app and runtime "ready"
orca skills get orchestration           # real flags for this Orca version — read it
orca skills get orca-linear             # only if config.tracker == linear
gh auth status
git -C <main-checkout> fetch origin <base-name>
```

`<main-checkout>` is the primary worktree, where your terminal lives. All the work happens
in a child worktree.

## The roster

`config.roles` maps each of the nine roles to a `launch` command and a `fallback`. Use them
verbatim and append what the phase needs (`--task <id> --worktree $WT --json`). Never
substitute a model of your own choosing: the owner picked these.

| Role | Config key | Phase |
|---|---|---|
| Plan A | `roles.plan_a` | 2 |
| Plan B | `roles.plan_b` | 2 |
| Gap hunter | `roles.gaps` | 3 |
| Judge | `roles.judge` | 4 |
| Implementer | `roles.implementer` | 6 |
| Light review 1 | `roles.review_light_1` | 8 |
| Light review 2 | `roles.review_light_2` | 8 |
| Deep review | `roles.review_deep` | 8 |
| Adversarial review | `roles.review_adversarial` | 8 |

What the flow depends on is not any particular model but the **independence** of these
roles: two planners that think alike produce one plan, and a reviewer from the
implementer's own family finds nothing. If the owner has collapsed families in the config,
say so once at the start of the run and continue.

A `launch` starting with `orca orchestration worker-start` is dispatched directly. One
starting with `orca terminal create` needs the terminal dance instead: create it, wait for
`tui-idle`, create the task, then `dispatch --task <id> --to <handle> --inject`. If
`--inject` does not recognise the CLI, send the prompt with `terminal send` and read the
result with `worker-read` / `terminal read` plus the output file.

If a model answers "at capacity" or "usage limit", relaunch that one task with
`roles.<role>.fallback`. Do not retry in a loop, and do not silently swap in a different role.

## Phase 0 · Issue worktree and Run

```bash
# tracker == linear
orca linear issue ISSUE --full --json > /tmp/ISSUE.json   # title, description, comments, gitBranchName
# tracker == github
gh issue view <n> --json title,body,comments,labels > /tmp/ISSUE.json

orca repo list --json                                      # <repoId>
orca worktree create --repo id:<repoId> --name "ISSUE <short title>" \
  --linear-issue ISSUE --base-branch <base> \
  --parent-worktree "id:<repoId>::<main-checkout>" --json  # no --agent: leave it empty
git -C <worktree> log --oneline -1                         # must be the HEAD of <base>
git -C <worktree> branch -m <branch-name>                  # tracker's branch name, or config.branch_prefix + slug
mkdir -p <worktree>/.orca-run
grep -q '^\.orca-run/$' <worktree>/.gitignore || echo '.orca-run/' >> <worktree>/.gitignore
orca orchestration run-create --objective "ISSUE: <title>" --json
orca linear save-issue ISSUE --state "In Progress" --json   # tracker == linear
```

From here on `WT=path:<worktree>` is the worktree selector for every worker.

## Phase 1 · Context and criteria (you do this)

Read: the issue JSON (description, comments, links), every file in `config.conventions_files`
(`AGENTS.md` / `CLAUDE.md`), the architecture docs, the area docs under `config.docs_dirs`,
related open PRs (`gh pr list --search ISSUE`), and library docs for anything involved.
Reach for web search only if the issue asks you to check something outside the repo.

Write, in the worktree:

- `.orca-run/00-context.md`: what the issue asks for, which parts of the code it touches
  (paths), which project invariants apply, which prior PRs/docs exist.
- `.orca-run/01-criteria.md`: numbered, verifiable acceptance criteria. Each one states how
  it is checked (test, command, screenshot). Always include "`<verify>` is green" and, if
  `config.changelog` is set, "changelog updated".

Publish the criteria on the issue:
`orca linear comment add ISSUE --body-file <worktree>/.orca-run/01-criteria.md --json`
(or `gh issue comment`, read-only rule waived for the tracker only if the owner allows it —
otherwise paste them in chat).

## Phase 2 · Plans A and B in parallel

```bash
orca orchestration task-create --spec "<PLAN prompt, see references/prompts.md, output .orca-run/10-plan-A.md>" --json
orca orchestration task-create --spec "<same prompt, output .orca-run/11-plan-B.md>" --json
<launch:plan_a> --task <tA> --worktree $WT --json
<launch:plan_b> --task <tB> --worktree $WT --json
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 900000 --json
# per worker_done: worker-release --dispatch <id>; then check --ack <delivery> --wait …
```

The planners never see each other: each spec names only its own output file. That
independence is the whole point — two correlated plans are worth one plan.

## Phase 3 · Gaps

Task with `--deps '["<tA>","<tB>"]'`, GAPS prompt. Input: issue, criteria, plan A, plan B.
Output: `.orca-run/12-gaps.md` — a numbered list, every point backed by evidence (file path
or doc). The gap hunter does not propose a plan of its own.

## Phase 4 · Judge

```bash
<launch:judge> --worktree $WT --title "Judge · ISSUE" --json
orca terminal wait --terminal <h> --for tui-idle --timeout-ms 90000 --json
orca orchestration task-create --spec "<JUDGE prompt>" --deps '["<tGaps>"]' --json
orca orchestration dispatch --task <tJ> --to <h> --inject --json
```

Output: `.orca-run/13-verdict.md` with the final plan (steps, files, tests), what it takes
from A, from B and from the gaps, what it discards and why, accepted risks, and the
recommended review level (light / deep / adversarial) with a reason.

## Phase 5 · PLAN APPROVAL (gate 1)

```bash
orca orchestration gate-create --task <tJ> \
  --question "ISSUE: approve the final plan in .orca-run/13-verdict.md?" \
  --options '["approve","changes","cancel"]' --json
```

Write the owner a plain-language summary in chat (what will be done, what was discarded,
what the risks are) plus the path to the verdict. **Stop here.** Continue only when the
owner answers "approve" (in chat, or by resolving the gate:
`orca orchestration gate-list --status open --json`). If they ask for changes, go back to
the judge with their comments — new task, same terminal.

## Phase 6 · Implementation

```bash
<launch:implementer> --worktree $WT --title "Implement · ISSUE" --json
orca terminal wait --terminal <h> --for tui-idle --timeout-ms 90000 --json
orca orchestration task-create --spec "<IMPLEMENT prompt>" --json
orca orchestration dispatch --task <tI> --to <h> --inject --json
orca orchestration check --wait --types worker_done,escalation,question --timeout-ms 3600000 --json
```

The implementer follows the verdict and the criteria, makes small commits on the issue
branch, updates the changelog, runs `<verify>` (and `config.verify.ui_command` if UI changed)
before reporting, and **does not push**. Keep the same terminal for fixes
(`worker-start --task <new> --terminal <h>`, or another `dispatch --inject` to the handle).

## Phase 7 · Deterministic gates (you run them, even if the implementer already did)

```bash
(cd <worktree> && <verify>)          # + config.verify.ui_command if there is UI
```

Save the output to `.orca-run/20-gates.log`. Red → new fix task for the implementer with the
log, then back to this phase. Never move to review with a red gate.

## Phase 8 · Tiered review

Decide the level and record it in `.orca-run/30-review-level.md`:

- **Always**, in parallel: `roles.review_light_1` and `roles.review_light_2`.
- **Deep** (`roles.review_deep`) if the diff touches any path in `config.deep_review_paths`,
  exceeds `config.deep_review_lines` changed lines, or the judge recommended it.
- **Adversarial** (`roles.review_adversarial`) if the change touches any subject listed in
  `config.adversarial_topics`.
- **Specialists** only when they apply: UI → design review + browser tests; performance,
  architecture, or security auditors as available in the host agent.

Every reviewer gets the diff (`git diff <base>...HEAD`), the criteria and the verdict, and
writes `.orca-run/31-review-<role>.md` with findings as `[BLOCKS|SHOULD|COULD]` + path:line
+ why + how to fix. Consolidate into `.orca-run/32-findings.md` (deduplicated, ordered by
severity). Any `BLOCKS` or `SHOULD` → fix task for the implementer → phase 7 → phase 8 again
(only the reviewers that had findings). At most `config.max_review_rounds` rounds; after that, stop and escalate to the owner.

## Phase 9 · Final validation (you do this)

`.orca-run/40-validation.md`: a table of criterion → how it was verified → result;
differences between the verdict and the implementation (and whether they are justified);
a summary of gates and reviews; and an **"Owner summary"** of ten lines in plain language
(what was done, what changes for the user, what risk remains, what to decide). Check the
changelog and the docs.

## Phase 10 · DELIVERY APPROVAL (gate 2)

`gate-create` with "ISSUE: push and open the PR?" and paste the Owner summary into chat.
**Stop here** until you get the OK.

## Phase 11 · Delivery (first write to GitHub)

```bash
git -C <worktree> push -u origin <branch-name>
gh pr create --base <pr-base> --head <branch-name> \
  --title "<type>(<scope>): <description>" \
  --body-file <worktree>/.orca-run/40-validation.md
gh pr checks <n> --watch
```

Follow the repo's commit conventions; no tool trailers in commits or PR body unless the repo
asks for them. If a check fails: fix → phase 7 → push. **Do not merge** — that is the owner's
call.

## Phase 12 · Close-out

```bash
orca linear attach ISSUE --url <pr-url> --title "PR #<n>" --json
orca linear comment add ISSUE --body "<Owner summary + PR link + green checks>" --json
orca linear save-issue ISSUE --state "In Review" --json
```

When the owner confirms the merge: move the issue to Done with a comment carrying the merge
SHA. Release any remaining terminals (`worker-release`) and leave the worktree in place —
the owner decides when to delete it.

## When things go sideways

- `agent_prompt_blocked` / `agent_prompt_stalled`: the TUI has a dialog open or was not ready
  → `terminal wait --for tui-idle`, resend; if it persists, close and relaunch that terminal.
- Three consecutive failures on a task: Orca marks it `failed`; relaunch with the standby
  (`worker-start --retry-of <dispatch>`).
- The worktree did not branch from `<base>`: delete it and recreate with `--base-branch`.
- Changelog conflict on push: `git fetch && git rebase origin/<base-name>` keeping both
  entries (the base branch's on top).
- Never run `orca orchestration reset` during an active run.
