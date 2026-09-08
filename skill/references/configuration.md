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
orchestrator: a frontier model (Opus)
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
| `verify.ui_command` | Heavier command run instead when the diff touches UI. `null` to skip. |

Make `verify.command` the same thing CI runs. The point of the gate is that the machine,
not a model, decides whether the work compiles and passes.

## Context routing

```yaml
context:
  digest_gate_logs_over: 200
  raw_log_after_rounds: 2
```

| Key | Meaning |
|---|---|
| `digest_gate_logs_over` | Above this many lines, the verify log goes through `roles.reader` and the orchestrator works from `20-gates-summary.md` instead. `0` turns it off. |
| `raw_log_after_rounds` | Once the same failure has survived this many rounds, the implementer gets the raw log. Two digests that did not unblock it mean the digest is not the obstacle. |

A verify log is mostly noise that looks like signal: hundreds of passing lines, coverage
tables, and stack frames through `node_modules` and the test runner. The forty lines that
matter are buried in it, and it is not paid once — fix rounds share the implementer's
terminal, so each round's log stacks up in the same context and the stale ones still read
as current.

The full log always stays at `.orca-run/20-gates.log` and the summary carries line numbers
into it. Nothing is lost; the worst case is one targeted read.

## Tracker

| Key | Meaning |
|---|---|
| `tracker` | `linear`, `github` or `none`. Chooses how the issue is read and closed out. |
| `issue_prefix` | Key prefix, e.g. `IDL` for `IDL-86`. `null` when there is none. |

With `none`, the orchestrator takes the brief from the chat and skips phase 12.

## Review policy

| Key | Meaning |
|---|---|
| `deep_review_paths` | Globs that always earn the deep reviewer, whatever the diff size. Put auth, crypto, migrations and anything multi-tenant here. |
| `deep_review_lines` | Any diff bigger than this also gets the deep reviewer. |
| `adversarial_topics` | Subjects that additionally earn the adversarial reviewer. |
| `max_review_rounds` | Fix rounds before the orchestrator stops and escalates to you. |

## Roles

Pick a ready-made roster at install time, or one model per role. Re-pick either way, at any
time, with:

```bash
npx orca-issue-flow roles
```

That rewrites the roles section and nothing else — every edit you made above it survives,
which is why the section is last in the file.

### The packs

| Pack | For | Trades |
|---|---|---|
| **Budget** | Small, reversible issues at volume | Weaker planning and review; still keeps the judge off the bottom shelf |
| **Balanced** | The default | Strong planners and judge, cheap hygiene passes |
| **Frontier** | Auth, migrations, billing, tenant isolation | Costs the most; nothing in the roster is a compromise |

Two positions hold across all three. The judge is never the cheapest thing in the roster —
it writes the plan that actually gets built — and it never shares a family with a planner,
because it would find the plan that reasons like it does the more persuasive one. And no
reviewer shares the implementer's family, because a reviewer that thinks like the
implementer approves the implementer.

Every pack is checked against the independence rules below before it ships, and so is
anything you assemble by hand — the wizard tells you which overlaps cost you something and
lets you go back.

**A roster it cannot resolve is reported, not passed.** Model families are matched on the
model name with the provider prefix stripped, so `opencode/glm-5.3` and
`opencode-go/glm-5.3` land on the same vendor. The table in `src/presets.mjs` will always
be incomplete, so a name it does not recognise — or a role with no model at all — comes
back as "cannot check", loudly, naming the roles it could not verify. Silence there would
read as a pass, which is the one thing a checker must never do.

```yaml
roles:
  plan_a:
    label: Plan A
    launch: orca orchestration worker-start --agent claude --model claude-fable-5-1 --effort medium
    fallback: orca orchestration worker-start --agent claude --model claude-opus-4-8
```

`launch` is the command fragment the orchestrator runs; it appends `--task`, `--worktree`
and `--json` itself. Two shapes are supported:

- `orca orchestration worker-start …` — dispatched directly.
- `orca terminal create --command "…"` — the orchestrator creates the terminal, waits for
  `tui-idle`, then dispatches into it with `--inject`.

`fallback` is used for that one task when a model reports being at capacity or over its
limit. Set it to `null` to have the orchestrator escalate instead.

### `roles.reader`

The tenth entry, and the only one that is not a panelist. It reads machine output — verify
logs above all — and writes back an extraction: the failures, verbatim, with the repo's own
stack frames and line numbers into the original. It does not diagnose and it does not
propose.

Because it has no opinion, the independence rules below do not apply to it: it may share a
family with any other role. Pick the cheapest model whose context window fits your logs. The
default is Haiku through the `claude` launcher, which needs no auth you do not already have.
If what you are short of is quota rather than context, move it to a provider outside the
family carrying the rest of the roster.

### Choosing the roster

The flow's value does not come from any particular model. It comes from the roles being
**independent**:

- **Plan A and Plan B** must come from different model families. Two planners that think
  alike give you one plan with extra steps, and the judge has nothing to arbitrate.
- **The gap hunter** should be a third family. Its whole job is to see what both planners
  missed, which it cannot do if it shares their priors.
- **The judge** must differ from both planners. It exists to arbitrate between two plans,
  and a judge sharing a planner's family finds that planner's reasoning the more natural of
  the two.
- **The reviewers** should not all match the implementer. A reviewer from the implementer's
  own family tends to accept the implementer's assumptions.
- **The adversarial reviewer** must differ from every other reviewer. It is the only one
  asked to assume the rest are wrong.

Beyond that, spend effort where mistakes are expensive: a cheap model is fine for light
review 1, and the judge and the deep reviewer are worth the good one.
