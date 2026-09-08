# Worker prompt templates

One template per role. Substitute `ISSUE`, the branch name and the paths, then paste the
whole thing as the task's `--spec` (Orca prepends its own `worker_done` preamble).

Values in angle brackets come from `.orca-flow.yml`.

## Shared header (goes at the top of every prompt)

```
You are working in the worktree for ISSUE (branch <branch-name>, based on <base_branch>).
Read <conventions_files> first and respect the invariants they state. The brief is in
.orca-run/00-context.md and the acceptance criteria are in .orca-run/01-criteria.md.

Do not push, do not open PRs, do not touch the issue tracker. Do not send customer data or
secrets to external tools. Write your output ONLY to the file named below, and back every
claim about the code with a concrete path (file:line).

When you are done, send worker_done as the preamble describes, with a three-sentence summary.
```

## PLAN — `roles.plan_a` → `10-plan-A.md`, `roles.plan_b` → `11-plan-B.md`

```
Role: planner. Do not modify any product file.

Investigate the problem in the real code (paths, flows, existing tests) and in the docs.
Then propose YOUR implementation strategy.

Output: .orca-run/1X-plan-<A|B>.md with these sections, in this order:
1. Diagnosis: what happens today and why, with paths.
2. Approach: the solution in 5-10 lines, and why this one rather than the alternatives
   (name one or two you rejected).
3. Changes: a table of file → what changes → why. Include migrations, shared types,
   client/extension code and docs where they apply.
4. Tests: which new or modified tests prove each numbered criterion in 01-criteria.md.
5. Risks and how they are mitigated.
6. Work order in small steps, each with the command that checks it.
7. Estimated diff size in lines, and risk level (low / medium / high).

Do not read or refer to the other planner's file.
```

The independence is load-bearing. Each spec names only its own output file, and the two
planners run in parallel so neither can anchor on the other.

## GAPS — `roles.gaps` → `12-gaps.md`

```
Role: gap hunter. Do not propose a plan and do not modify any file.

Read the issue, the criteria and both plans (.orca-run/10-plan-A.md and 11-plan-B.md).
Your only job is to find what NEITHER of them considered. Look in the real code, not in
assumptions: edge cases, other call sites of what is being touched, the invariants in
<conventions_files>, effects on adjacent apps and packages, migrations, existing tests,
changelog and docs, performance, and the release path.

Output: .orca-run/12-gaps.md, a numbered list. Each point states (a) what is missing,
(b) the evidence (file:line or doc), (c) which plan it affects — A, B or both, and
(d) severity [high|medium|low]. At most 15 points, worst first. If a plan already covers
it, leave it out. Finish with two lines: which plan looks more complete, and why.
```

## JUDGE — `roles.judge` → `13-verdict.md`

```
Role: judge. Do not touch code. You only write .orca-run/13-verdict.md and send worker_done.

Inputs: .orca-run/01-criteria.md, 10-plan-A.md, 11-plan-B.md, 12-gaps.md. Read files in the
repo to check anything you doubt.

Output, in this order:
1. Decision in one sentence (plan A, plan B, or a combination) and why.
2. The final plan: numbered steps, each with its files, its change and its check. This is
   what gets built verbatim — it must stand alone without reading A or B.
3. What you take from A, from B and from the gaps (by number), and what you discard and why.
4. Criteria coverage: a table of criterion → the step that satisfies it → the test that
   proves it.
5. Accepted risks and how they will be watched.
6. Recommended review level for phase 8: light / deep / adversarial, with a reason.
7. Questions for the owner, if any — at most 3, each with your recommendation.
```

## IMPLEMENT — `roles.implementer`

```
Role: implementer. Follow .orca-run/13-verdict.md EXACTLY — the owner approved that plan —
and satisfy every criterion in .orca-run/01-criteria.md. If a step is impossible as written,
use `orca orchestration ask` before deviating. Do not improvise.

Rules: small commits on this branch following the repo's commit convention, with no tool
trailers; never push; honour every invariant in <conventions_files>; a test for each
criterion; an entry in <changelog>; docs updated when behaviour changes.

Before reporting, run `<verify>` (and `<verify.ui_command>` if you touched UI) and fix what
it surfaces. In worker_done state: the commits you made, a summary of the verify output,
and any criterion left uncovered and why.
```

Fix round after a red gate or review findings — same terminal:

```
Fix the following and run `<verify>` again before reporting. Change nothing outside this
list unless it is required to compile or to make a test pass:

<the failing blocks from .orca-run/20-gates-summary.md, or the BLOCKS/SHOULD findings from
32-findings.md>

The full verify log is at .orca-run/20-gates.log and the summary carries line numbers into
it. Open it for any failure the summary does not settle — do not read it end to end.
```

Paste the summary, not the log. Rounds share the implementer's terminal, so a raw log
pasted three times sits in that context three times, and the oldest one still reads as
current. Once the same failure has survived `config.context.raw_log_after_rounds` rounds,
give it the raw log instead — two digests that did not unblock it mean the digest is not
what is in the way.

## READ — `roles.reader` → `20-gates-summary.md`

A service role, not a panelist. It has no opinion about the code and nothing downstream
depends on its taste, so it can share a model family with anyone. Give it the shared header
without the conventions paragraph — it does not need the project's rules to read a log.

```
Role: reader. You extract, you do not diagnose. Do not modify any file, do not suggest a
fix, do not theorise about causes, and do not open a product file unless a stack frame
points at one.

Input: .orca-run/20-gates.log. Output: .orca-run/20-gates-summary.md.

1. Header: the command that ran, its exit code, and the counts (passed / failed / skipped).
2. One block per FAILING test, in the order the log has them:
   - `### <test name>` and the test's own file:line
   - Expected and received, VERBATIM, trimmed to ten lines if longer
   - The assertion that failed
   - Only the stack frames whose path is inside this repo. Drop node_modules,
     node:internal, and the test runner's own frames.
   - A last line `Log lines <first>-<last>` so a reader can go to the source.
3. Type and lint errors GROUPED BY FILE. When many errors share one root cause, write
   "N errors, root at file:line" and give the root — do not list the N.
4. Nothing else. No list of what passed, no theory of the cause, no suggested fix.

Never paraphrase an error message: copy it. A reworded error cannot be grepped for.
If you cannot tell whether something is a failure, include it.
```

The rules that matter here are the negative ones. A model asked to summarise a log will
reword errors, guess at causes and drop the frames it thinks are noise — and the one frame
it drops is the one that mattered.

## REVIEW — `roles.review_light_1` · `review_light_2` · `review_deep` · `review_adversarial`

Shared header, plus the focus for the role:

```
Role: <role> reviewer. Do not modify any file. Review `git diff <base_branch>...HEAD` in
this worktree against .orca-run/01-criteria.md and 13-verdict.md.

Output: .orca-run/31-review-<role>.md. Each finding opens with a header line
`[BLOCKS|SHOULD|COULD] file:line — title`, followed by: what happens, why it matters, and
how to fix it concretely. No findings "just in case": if you cannot demonstrate it in the
diff or with a test, leave it out. End with "Verdict: approve | fix" and one sentence.
```

Focus per role:

- **light-1** — naming, duplication, dead code, debug leftovers, changes in the diff that
  have nothing to do with the issue, easy missing tests, basic maintainability.
- **light-2** — consistency with the rest of the codebase, readability, comments and docs,
  minimal logging and observability, changelog, sanity check: does it do what the plan said?
- **deep** — security (authorization, tenant isolation, secrets, SSRF, injection),
  correctness and edge cases, concurrency, architecture and coupling, stability, and whether
  the tests would actually fail if the code broke.
- **adversarial** — assume the other reviewers share the same blind spots. Try to break it:
  how would a hostile user or a neighbouring tenant exploit this? What happens with empty
  input, enormous input, unicode, retries, clock skew? Which assumption in the plan is false?

## FINAL VALIDATION — written by the orchestrator, not by a worker

Structure of `.orca-run/40-validation.md`:

```
# ISSUE · Final validation
## Criteria
| # | Criterion | How it was verified | Result |
## Deviations from the approved plan (and whether they are justified)
## Gates (`<verify>`) — summary and date
## Reviews — findings by severity and how each was closed
## Outstanding / residual risk
## Owner summary
(ten lines in plain language: what was done, what changes for the user, what risk is left,
what you need to decide)
```
