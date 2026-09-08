# orca-issue-flow

A multi-agent workflow for taking one issue from brief to pull request inside
[Orca](https://orca.computer), installed as an agent skill.

Instead of handing an issue to a single agent and hoping, it runs a panel:

```
  context + acceptance criteria          ← you
        │
        ├─ Plan A ──┐                    two independent plans, in parallel,
        └─ Plan B ──┤                    neither able to see the other
                    ▼
              Gap hunter                 a third family: only what both missed
                    ▼
                 Judge                   merges them into one final plan
                    ▼
        ╔═══════════════════╗
        ║  YOU APPROVE      ║            gate 1 — nothing is built before this
        ╚═══════════════════╝
                    ▼
             Implementer                 the only worker that touches product code
                    ▼
           Deterministic gates           your verify command, run by the machine
                    ▼
            Tiered review                2 light, + deep, + adversarial when earned
                    ▼
             Validation                  criteria table + a plain-language summary
                    ▼
        ╔═══════════════════╗
        ║  YOU APPROVE      ║            gate 2 — nothing reaches GitHub before this
        ╚═══════════════════╝
                    ▼
            push · PR · close out
```

Two properties make it worth the tokens:

- **Two human gates.** The orchestrator stops on the plan and stops again before it pushes.
  GitHub stays read-only for the first ten phases — no `push`, no `pr create`, no comments.
- **Independence between roles.** The planners never see each other, the gap hunter comes
  from a third model family, and the adversarial reviewer is asked to assume everyone else
  is wrong. Consensus between agents that think alike is worthless; this is set up to avoid
  buying it.

## Install

```bash
npx orca-issue-flow
```

The wizard detects your base branch, package manager and verify script, asks what it cannot
work out, and lets you pick the agent and model for each of the nine roles. It writes:

- `.orca-flow.yml` at the repo root — everything project-specific, meant to be edited
- `.agents/skills/orca-issue-flow/` (or `.claude/skills/…`) — the skill itself
- `.orca-run/` added to `.gitignore` — where each run leaves its artefacts

Then, from a session in your main checkout:

```
run issue ABC-123
```

## What you need

- [Orca](https://orca.computer) with the `orca` CLI on your PATH, and the `orchestration`
  skill available (`orca skills get orchestration`).
- At least two agent CLIs Orca can launch, from different model families. The defaults
  assume Claude Code, Codex, Grok and OpenCode; any mix works — see
  [Choosing the roster](skill/references/configuration.md#choosing-the-roster).
- `gh`, authenticated, for the last two phases.
- Linear, GitHub Issues, or nothing — the flow adapts.

## Configuration

Everything lives in `.orca-flow.yml`, documented in
[`skill/references/configuration.md`](skill/references/configuration.md). The parts you will
actually revisit:

```yaml
verify:
  command: pnpm verify        # a red gate stops the flow; make this what CI runs

deep_review_paths:            # these always get the deep reviewer, whatever the diff size
  - auth*
  - "**/migrations/**"

roles:
  plan_a:
    launch: orca orchestration worker-start --agent claude --model claude-fable-5-1 --effort medium
    fallback: orca orchestration worker-start --agent claude --model claude-opus-4-8
```

Re-run `npx orca-issue-flow` any time to redo the wizard.

## The nine roles

| Role | Does | Never does |
|---|---|---|
| Plan A | An independent implementation plan | See plan B |
| Plan B | The second independent plan | See plan A |
| Gap hunter | Only what neither plan considered, with evidence | Propose a plan |
| Judge | One self-sufficient final plan out of A, B and the gaps | Touch code |
| Implementer | Follows the approved plan, commits, runs the gates | Push |
| Light review ×2 | Cheap passes: hygiene, consistency, docs, sanity | Modify files |
| Deep review | Security, correctness, edge cases, test quality | Modify files |
| Adversarial review | Tries to break it, assuming the others are wrong | Modify files |

Each writes to its own file in `.orca-run/`, so a finished run leaves an audit trail: both
plans, the gaps, the verdict, the gate log, every review, and the final validation.

## Cost

A full run is nine agent invocations plus fix rounds. It is aimed at issues where being
wrong is expensive — auth, migrations, billing, anything multi-tenant — not at typo fixes.
For small changes, the deep and adversarial reviewers simply do not trigger, and the run is
four agents plus two light reviews.

## Prior art

This grew out of a working orchestration flow in a private production repo, generalised so
the project-specific parts live in config rather than in the prompts.

## License

MIT
